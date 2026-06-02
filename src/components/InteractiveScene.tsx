/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Html, Float, Center } from '@react-three/drei';
import * as THREE from 'three';
import { BodyPart } from '../types';

interface InteractiveSceneProps {
  url: string;
  parts: BodyPart[];
  placedParts: string[];
  selectedPartId: string;
  activeCalibrate: boolean;
  onSelectPart: (id: string) => void;
  onSetLastClickedPoint: (point: [number, number, number]) => void;
  onScreenPosUpdate: (id: string, x: number, y: number, clientX: number, clientY: number) => void;
  onLoad?: () => void;
}

export const InteractiveScene = ({
  url,
  parts,
  placedParts,
  selectedPartId,
  activeCalibrate,
  onSelectPart,
  onSetLastClickedPoint,
  onScreenPosUpdate,
  onLoad
}: InteractiveSceneProps) => {
  const { scene } = useGLTF(url);

  useEffect(() => {
    if (scene && onLoad) {
      onLoad();
    }
  }, [scene, onLoad]);

  // Compute scale once and apply it to standard scene scale
  const { scale } = useMemo(() => {
    // Reset scale to natural dimensions to calculate correct bounds
    scene.scale.set(1, 1, 1);
    
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // We want the total scale of the scene inside Center to be normalized to 8.0 to fill the viewport nicely
    const calculatedScale = maxDim > 0 ? 8.0 / maxDim : 0.4;
    
    // Apply downscaling directly to the gltf primitive itself to make it normal size
    scene.scale.set(calculatedScale, calculatedScale, calculatedScale);

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: '#00f2ff',
          wireframe: true,
          transparent: true,
          opacity: 0.15,
          emissive: '#004a4d',
          emissiveIntensity: 0.5,
        });
      }
    });

    return { scale: calculatedScale };
  }, [scene]);

  return (
    <>
      {/* Model rendered within Center at optimized/normalized scale size */}
      <Center>
        <primitive 
          object={scene} 
          onClick={activeCalibrate ? (e: any) => {
            e.stopPropagation();
            // Convert clicked world coordinate to the local coordinate of the scene to get unscaled coordinates
            const localPoint = scene.worldToLocal(e.point.clone());
            onSetLastClickedPoint([localPoint.x, localPoint.y, localPoint.z]);
          } : undefined}
        />
      </Center>

      {/* Hotspots rendered beautifully in scaled coordinates, keeping UI size constant and pixel perfect */}
      {parts.map(part => {
        const scaledPosition: [number, number, number] = [
          part.position[0] * scale,
          part.position[1] * scale,
          part.position[2] * scale
        ];
        return (
          <Hotspot3D 
            key={part.id} 
            part={part} 
            position={scaledPosition}
            isPlaced={placedParts.includes(part.id)}
            isSelected={part.id === selectedPartId}
            activeCalibrate={activeCalibrate}
            onSelect={() => onSelectPart(part.id)}
            onScreenPosUpdate={onScreenPosUpdate}
          />
        );
      })}
    </>
  );
};

interface Hotspot3DProps {
  part: BodyPart;
  position: [number, number, number];
  isPlaced: boolean;
  isSelected?: boolean;
  activeCalibrate?: boolean;
  onSelect?: () => void;
  onScreenPosUpdate: (id: string, x: number, y: number, clientX: number, clientY: number) => void;
}

const Hotspot3D = ({ 
  part, 
  position,
  isPlaced,
  isSelected,
  activeCalibrate,
  onSelect,
  onScreenPosUpdate
}: Hotspot3DProps) => {
  const ref = useRef<THREE.Group>(null);
  const { camera, size, gl } = useThree();

  useFrame(() => {
    if (ref.current) {
      const vector = new THREE.Vector3();
      ref.current.getWorldPosition(vector);
      vector.project(camera);

      const x = (vector.x * 0.5 + 0.5) * size.width;
      const y = (-(vector.y * 0.5) + 0.5) * size.height;
      
      const rect = gl.domElement.getBoundingClientRect();
      const clientX = rect.left + (vector.x * 0.5 + 0.5) * rect.width;
      const clientY = rect.top + (-(vector.y * 0.5) + 0.5) * rect.height;
      
      onScreenPosUpdate(part.id, x, y, clientX, clientY);
    }
  });

  const shouldHighlightSelected = isSelected && activeCalibrate;

  const hotspotColor = shouldHighlightSelected 
    ? "#fbbf24" 
    : (isPlaced ? "#00ff9d" : "#ff3e3e");

  const ringColor = shouldHighlightSelected 
    ? "#fbbf24" 
    : "#ff3e3e";

  return (
    <group 
      ref={ref} 
      position={position}
      onClick={(e) => {
        if (onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
    >
      <mesh>
        <sphereGeometry args={[shouldHighlightSelected ? 0.05 : 0.035, 16, 16]} />
        <meshStandardMaterial 
          color={hotspotColor} 
          emissive={hotspotColor}
          emissiveIntensity={shouldHighlightSelected ? 4 : isPlaced ? 2 : 4}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* Outer pulsing ring */}
      {(!isPlaced || shouldHighlightSelected) && (
        <Float speed={5} rotationIntensity={0} floatIntensity={0.5}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[shouldHighlightSelected ? 0.1 : 0.07, 0.005, 16, 32]} />
            <meshStandardMaterial 
              color={ringColor} 
              emissive={ringColor} 
              emissiveIntensity={2} 
              transparent 
              opacity={0.5} 
            />
          </mesh>
        </Float>
      )}
      
      {shouldHighlightSelected && (
        <Html distanceFactor={4}>
          <div className="bg-amber-500/90 border border-amber-300 text-bg font-extrabold text-[9px] px-2 py-1 rounded shadow-lg whitespace-nowrap font-mono select-none cursor-pointer">
            {part.name}: [{part.position.map(n => n.toFixed(4)).join(', ')}]
          </div>
        </Html>
      )}
      
      {isPlaced && (
        <Html distanceFactor={4} center>
          <div className="pointer-events-none select-none relative flex flex-col items-center">
            <div className="w-[1px] h-3 bg-accent mb-1" />
            <div className="bg-accent text-bg font-bold text-[9px] px-2 py-0.5 rounded shadow-[0_0_10px_rgba(0,242,255,0.5)] whitespace-nowrap uppercase tracking-wider font-mono">
              {part.name}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};
