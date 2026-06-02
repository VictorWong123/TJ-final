/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dna, 
  Activity, 
  RotateCcw, 
  Trophy,
  Maximize2,
  Minimize2,
  Loader2
} from 'lucide-react';

import GameMode from './components/GameMode';
import { BodyPart } from './types';
import { InteractiveScene } from './components/InteractiveScene';
import { DraggableLabel } from './components/DraggableLabel';
import timelineData from '../timeline.json';

const TIMELINE_ID_MAP: Record<string, string> = {
  brain: 'brain',
  heart: 'heart_chest',
  shoulder_left: 'left_shoulder',
  shoulder_right: 'right_shoulder',
  hand_left: 'left_hand_wrist',
  hand_right: 'right_hand_wrist',
  knee_left: 'left_knee',
  knee_right: 'right_knee',
  foot_left: 'left_foot_ankle',
  foot_right: 'right_foot_ankle',
};

// --- Data ---

const BODY_PARTS: BodyPart[] = [
  {
    id: 'brain',
    name: 'Brain',
    description: 'MRI can show brain tumors, strokes, bleeding, swelling, and nerve-related conditions.',
    position: [0.0474, 9.0564, 1.0559]
  },
  {
    id: 'shoulder_left',
    name: 'Left Shoulder',
    description: 'MRI can show rotator cuff tears, ligament injuries, inflammation, and joint damage in the left shoulder.',
    position: [1.5872, 6.7088, -0.0081]
  },
  {
    id: 'shoulder_right',
    name: 'Right Shoulder',
    description: 'MRI can show rotator cuff tears, ligament injuries, inflammation, and joint damage in the right shoulder.',
    position: [-1.1677, 6.8612, 0.0004]
  },
  {
    id: 'heart',
    name: 'Heart/Chest',
    description: 'MRI can help doctors see heart structure, blood flow, and tissue damage.',
    position: [0.0734, 6.3777, 0.4784]
  },
  {
    id: 'hand_left',
    name: 'Left Hand/Wrist',
    description: 'MRI can show ligament tears, tendon injuries, fractures, and arthritis in the left hand and wrist.',
    position: [4.9850, 1.3666, -0.1964]
  },
  {
    id: 'hand_right',
    name: 'Right Hand/Wrist',
    description: 'MRI can show ligament tears, tendon injuries, fractures, and arthritis in the right hand and wrist.',
    position: [-4.9850, 1.3666, -0.1964]
  },
  {
    id: 'knee_left',
    name: 'Left Knee',
    description: 'MRI is often used to find ACL tears, meniscus injuries, cartilage damage, and swelling in the left knee.',
    position: [1.5228, -4.1809, 0.5681]
  },
  {
    id: 'knee_right',
    name: 'Right Knee',
    description: 'MRI is often used to find ACL tears, meniscus injuries, cartilage damage, and swelling in the right knee.',
    position: [-1.5228, -4.1809, 0.5681]
  },
  {
    id: 'foot_left',
    name: 'Left Foot/Ankle',
    description: 'MRI can show tendon injuries, stress fractures, ligament tears, and inflammation in the left foot and ankle.',
    position: [1.8337, -9.4137, 0.4527]
  },
  {
    id: 'foot_right',
    name: 'Right Foot/Ankle',
    description: 'MRI can show tendon injuries, stress fractures, ligament tears, and inflammation in the right foot and ankle.',
    position: [-2.1542, -9.5377, 0.3139]
  }
];

export default function App() {
  const [currentView, setCurrentView] = useState<'student' | 'game'>('student');
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [parts, setParts] = useState<BodyPart[]>(BODY_PARTS);
  const [placedParts, setPlacedParts] = useState<string[]>([]);
  const [showInfo, setShowInfo] = useState<BodyPart | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [complete, setComplete] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const hotspotPositionsRef = useRef<Record<string, { x: number, y: number, clientX: number, clientY: number }>>({});
  const [activeCalibrate, setActiveCalibrate] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<string>('brain');
  const [selectedEra, setSelectedEra] = useState<string>("modern_mri");
  const [copied, setCopied] = useState(false);
  const [lastClickedPoint, setLastClickedPoint] = useState<[number, number, number] | null>(null);
  const [copiedClicked, setCopiedClicked] = useState(false);

  const selectedPart = useMemo(() => {
    return parts.find(p => p.id === selectedPartId) || parts[0];
  }, [parts, selectedPartId]);

  const isSelectedPartPlaced = useMemo(() => {
    return selectedPart ? placedParts.includes(selectedPart.id) : false;
  }, [selectedPart, placedParts]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeCalibrate) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'SELECT') {
        return;
      }

      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '[', ']'];
      if (!keys.includes(e.key)) return;

      e.preventDefault();

      const step = e.shiftKey ? 0.01 : 0.001;

      setParts(prevParts => prevParts.map(p => {
        if (p.id !== selectedPartId) return p;
        const [x, y, z] = p.position;

        let nextX = x;
        let nextY = y;
        let nextZ = z;

        if (e.key === 'ArrowLeft') nextX -= step;
        if (e.key === 'ArrowRight') nextX += step;
        if (e.key === 'ArrowUp') nextY += step;
        if (e.key === 'ArrowDown') nextY -= step;
        if (e.key === '[') nextZ -= step;
        if (e.key === ']') nextZ += step;

        return {
          ...p,
          position: [
            parseFloat(nextX.toFixed(4)),
            parseFloat(nextY.toFixed(4)),
            parseFloat(nextZ.toFixed(4))
          ]
        };
      }));
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCalibrate, selectedPartId]);

  const serializedCode = useMemo(() => {
    return `const BODY_PARTS: BodyPart[] = [
${parts.map(p => `  {
    id: '${p.id}',
    name: '${p.name}',
    description: '${p.description}',
    position: [${p.position[0]}, ${p.position[1]}, ${p.position[2]}]
  }`).join(',\n')}
];`;
  }, [parts]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(serializedCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  };

  const handleCorrectDrop = (part: BodyPart) => {
    if (!placedParts.includes(part.id)) {
      const newPlaced = [...placedParts, part.id];
      setPlacedParts(newPlaced);
      setShowInfo(part);
      setSelectedPartId(part.id);
      setSelectedEra("modern_mri");
      
      if (newPlaced.length === parts.length) {
        setTimeout(() => setComplete(true), 1500);
      }
    }
  };

  const handleScreenPosUpdate = (id: string, x: number, y: number, clientX: number, clientY: number) => {
    hotspotPositionsRef.current[id] = { x, y, clientX, clientY };
  };

  const resetActivity = () => {
    setPlacedParts([]);
    setComplete(false);
    setShowInfo(null);
  };

  return (
    <div className="h-screen w-screen bg-bg text-[#e0e0e0] font-sans flex flex-col overflow-hidden select-none">
      {/* Header */}
      <header className="h-[48px] border-b border-[#2a2d35] flex items-center justify-between px-6 bg-panel/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 bg-accent rounded shadow-[0_0_10px_#00f2ff]" />
          <h1 className="font-mono text-xs tracking-[1.5px] uppercase text-accent">3D Aether-Scan Diagnostic System</h1>
        </div>

        {/* Mode Toggle Button Group */}
        <div className="flex items-center gap-1.5 bg-[#0d0f13] border border-[#2a2d35] p-1 rounded-lg">
          <button 
            id="btn-mode-student"
            onClick={() => {
              setCurrentView('student');
              setActiveCalibrate(false);
            }} 
            className={`px-3 py-1 font-mono text-[10px] uppercase rounded transition-all cursor-pointer ${
              currentView === 'student'
                ? 'bg-accent text-bg font-extrabold shadow-[0_0_8px_rgba(0,242,255,0.4)]' 
                : 'text-text-dim hover:text-white'
            }`}
          >
            Student Mode
          </button>
          <button 
            id="btn-mode-game"
            onClick={() => setCurrentView('game')} 
            className={`px-3 py-1 font-mono text-[10px] uppercase rounded transition-all cursor-pointer ${
              currentView === 'game' 
                ? 'bg-accent text-bg font-extrabold shadow-[0_0_8px_rgba(0,242,255,0.4)]' 
                : 'text-text-dim hover:text-white'
            }`}
          >
            Game Mode
          </button>
        </div>

        <div className="font-mono text-[11px] text-text-dim flex items-center gap-4">
          <span>PATIENT ID: 8842-X</span>
          <span className="w-[1px] h-3 bg-[#2a2d35]" />
          <span className="animate-pulse">STATUS: {complete ? 'ANALYSIS COMPLETE' : 'SCANNING...'}</span>
          <span className="w-[1px] h-3 bg-[#2a2d35]" />
          <span>{currentTime}</span>
        </div>
      </header>

      {/* Main Grid */}
      {currentView === 'game' ? (
        <GameMode onBackToStudent={() => setCurrentView('student')} />
      ) : (
        <div className="flex-1 grid grid-cols-[260px_1fr_380px] overflow-hidden" ref={containerRef}>
        
        {/* Left Sidebar: Diagnostic Labels */}
        <aside className="bg-panel border-r border-[#2a2d35] p-5 flex flex-col gap-6 overflow-visible z-30">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-dim mb-4">Diagnostic Labels</div>
            <div className="flex flex-col gap-3">
              {parts.map(part => (
                <DraggableLabel 
                  key={part.id} 
                  part={part} 
                  onCorrectDrop={() => handleCorrectDrop(part)} 
                  isCorrect={placedParts.includes(part.id)}
                  hotspotPositionsRef={hotspotPositionsRef}
                  containerRef={containerRef}
                  isSelected={part.id === selectedPartId}
                  onClick={() => setSelectedPartId(part.id)}
                />
              ))}
              {placedParts.length === parts.length && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-6 text-center text-success/60 italic text-xs font-mono"
                >
                  [ ALL NODES VALIDATED ]
                </motion.div>
              )}
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-4">
            <button 
              onClick={resetActivity}
              className="w-full py-2 bg-[#1e2128] border border-[#2a2d35] hover:border-accent hover:text-accent transition-all rounded font-mono text-[10px] uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3 h-3" />
              Re-initialize Scanning
            </button>

            <div className="bg-[#0d0f13]/60 border border-[#2a2d35] border-dashed p-4 rounded-lg">
              <p className="text-[11px] leading-relaxed text-text-dim">
                Rotate the 3D specimen to locate hidden diagnostic nodes. 
                Drag labels from the left pane and release them directly over the glowing coordinate points.
              </p>
            </div>
          </div>
        </aside>

        {/* Center: 3D Scanner View */}
        <main className="relative bg-[radial-gradient(circle_at_center,#11141a_0%,#0a0b0e_100%)] overflow-hidden">
          {/* Scan lines UI overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_49%,rgba(0,242,255,0.03)_50%,transparent_51%)] bg-[size:100%_40px] pointer-events-none z-10" />
          
          {/* Visual Loader Overlay */}
          {!isModelLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_center,#11141a_0%,#0a0b0e_100%)] z-20">
              <Loader2 className="w-10 h-10 animate-spin text-accent" />
              <span className="font-mono text-[10px] text-accent uppercase tracking-widest animate-pulse">Initializing 3D Scanning Engine...</span>
            </div>
          )}
          
          <Canvas shadows>
            <PerspectiveCamera makeDefault position={[0, 0, 9]} fov={70} />
            <OrbitControls 
              enablePan={false} 
              minDistance={7} 
              maxDistance={16}
              target={[0, 0, 0]}
              maxPolarAngle={Math.PI / 1.1}
              minPolarAngle={Math.PI / 6}
            />
            
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />

            <Suspense fallback={null}>
              <InteractiveScene
                url="/model.glb"
                parts={parts}
                placedParts={placedParts}
                selectedPartId={selectedPartId}
                activeCalibrate={activeCalibrate}
                onSelectPart={setSelectedPartId}
                onSetLastClickedPoint={setLastClickedPoint}
                onScreenPosUpdate={handleScreenPosUpdate}
                onLoad={() => setIsModelLoaded(true)}
              />

              <Environment preset="night" />
            </Suspense>
          </Canvas>

          {/* Snapped Labels UI is now rendered beautifully inside Hotspot3D via responsive <Html> components */}
        </main>

        {/* Right Sidebar: Real-time Metrics / Calibration Controls */}
        <aside className="bg-panel border-l border-[#2a2d35] p-5 flex flex-col gap-6 overflow-y-auto w-[380px]">
          {!activeCalibrate ? (
            <div className="flex flex-col gap-6 h-full">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-dim mb-4">Diagnostic Context</div>
                <div className="flex flex-col gap-4">
                  <div className="bg-[#0d0f13] border border-[#2a2d35] p-4 rounded-lg">
                    <div className="flex justify-between text-[11px] mb-2">
                      <span>Reconstruction %</span>
                      <span className="text-accent font-mono">{Math.round((placedParts.length/parts.length)*100)}%</span>
                    </div>
                    <div className="h-1 bg-[#2a2d35] rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-accent shadow-[0_0_10px_#00f2ff]"
                        animate={{ width: `${(placedParts.length/parts.length)*100}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-[#0d0f13] border border-[#2a2d35] p-4 rounded-lg flex flex-col gap-3">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-text-dim uppercase tracking-wider">Nodes Active</span>
                      <span className="text-accent font-mono">{placedParts.length}/{parts.length}</span>
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {parts.map(p => (
                        <div 
                          key={p.id} 
                          className={`h-2 rounded-sm transition-colors duration-500 ${placedParts.includes(p.id) ? 'bg-success shadow-[0_0_5px_#00ff9d]' : 'bg-[#2a2d35]'}`} 
                        />
                      ))}
                    </div>
                  </div>

                  {/* Active Selected Node Info / Timeline Card */}
                  {selectedPart && isSelectedPartPlaced ? (
                    (() => {
                      const timelineId = TIMELINE_ID_MAP[selectedPart.id] || selectedPart.id;
                      const timelinePart = timelineData.bodyParts.find((p: any) => p.id === timelineId);

                      if (!timelinePart) {
                        return (
                          <div className="bg-[#0b0c10] border border-danger/30 rounded-lg p-4 font-mono text-[10px] text-danger">
                            No timeline data available for this body part.
                          </div>
                        );
                      }

                      const currentEraData = timelinePart.eraInfo[selectedEra as keyof typeof timelinePart.eraInfo];

                      return (
                        <motion.div 
                          key={`${selectedPart.id}-${selectedEra}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-[#0d0f13] border border-[#2a2d35] rounded-lg p-4 flex flex-col gap-3.5 relative overflow-hidden animate-none duration-150"
                        >
                          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_95%,rgba(0,242,255,0.02)_5%),linear-gradient(to_right,transparent_95%,rgba(0,242,255,0.02)_5%)] bg-[size:16px_16px] pointer-events-none" />
                          
                          {/* Top: Body-part name and status */}
                          <div className="flex items-center justify-between border-b border-[#2a2d35] pb-2 z-10">
                            <span className="font-mono text-[9px] uppercase tracking-[1px] text-accent font-bold">Chronological Archive</span>
                            <span className="font-mono text-[8px] px-1.5 py-0.5 rounded font-extrabold tracking-widest bg-success/20 text-success border border-success/30 shadow-[0_0_8px_rgba(0,255,157,0.15)] flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-success animate-pulse" />
                              VERIFIED
                            </span>
                          </div>

                          {/* Body Part Label */}
                          <div className="z-10">
                            <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-accent animate-pulse" />
                              {timelinePart.label}
                            </h3>
                          </div>

                          {/* Era Toggle Buttons */}
                          <div className="grid grid-cols-3 gap-1 z-10 bg-[#07090c] p-0.5 rounded border border-[#1f2229]">
                            {[
                              { id: 'pre_mri', label: 'PRE-MRI' },
                              { id: 'early_mri_1980s', label: '1980s ERA' },
                              { id: 'modern_mri', label: 'MODERN' }
                            ].map(era => {
                              const isActive = selectedEra === era.id;
                              return (
                                <button
                                  key={era.id}
                                  onClick={() => setSelectedEra(era.id)}
                                  className={`py-1 rounded transition-all cursor-pointer font-mono text-[8px] uppercase tracking-wider font-extrabold text-center ${
                                    isActive
                                      ? 'bg-accent text-bg shadow-[0_0_8px_rgba(0,242,255,0.3)]'
                                      : 'text-text-dim hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  {era.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* Era descriptive summary box */}
                          <div className="z-10 bg-[#07090c]/60 rounded-md border border-[#1f2229] p-3 flex flex-col gap-2">
                            <div className="flex items-center gap-1.5 text-accent/80 font-mono text-[8px] uppercase tracking-wider font-bold">
                              <span>ERA TARGET:</span>
                              <span className="text-white">
                                {selectedEra === 'pre_mri' ? 'Pre-MRI Era' : selectedEra === 'early_mri_1980s' ? 'Early MRI Era' : 'Modern MRI Era'}
                              </span>
                            </div>
                            
                            {currentEraData ? (
                              <>
                                <p className="text-[11px] leading-relaxed text-accent font-mono border-l border-accent/20 pl-2">
                                  {currentEraData.summary}
                                </p>

                                <div className="h-[1px] bg-[#1f2229] my-1" />

                                {/* Era detailed bullet points */}
                                <ul className="flex flex-col gap-1.5">
                                  {currentEraData.details.map((detail: string, i: number) => (
                                    <li key={i} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-[#b0b4be]">
                                      <span className="text-accent font-bold">&#8250;</span>
                                      <span className="font-sans font-medium">{detail}</span>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            ) : (
                              <p className="text-[10px] leading-relaxed text-danger font-mono">
                                No timeline info available for this era.
                              </p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })()
                  ) : (
                    /* PENDING PLACEMENT / EMPTY STATE */
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-[#000]/30 border border-[#2a2d35] border-dashed rounded-lg p-5 flex flex-col items-center justify-center text-center h-[260px] relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,242,255,0.02)_0%,transparent_70%)] pointer-events-none" />
                      <div className="w-8 h-8 rounded-full border border-[#2a2d35] border-dashed flex items-center justify-center mb-3">
                        <Dna className="w-4 h-4 text-accent/40 animate-pulse" />
                      </div>
                      <h4 className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1 font-bold">Aether-Scan Pending</h4>
                      <p className="text-[10px] text-text-dim leading-relaxed max-w-[180px] font-sans font-normal">
                        Verify diagnostic node by dropping <span className="text-white font-mono font-bold">[{selectedPart?.name || 'label'}]</span> onto the anatomical coordinate.
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-amber-500">Calibration Dashboard</span>
                <span className="bg-amber-500/20 text-amber-400 font-mono text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest animate-pulse">ACTIVE</span>
              </div>

              {/* Target Dropdown */}
              <div className="flex flex-col gap-1.5 bg-[#0d0f13] border border-[#2a2d35] p-3 rounded-md">
                <label className="font-mono text-[9px] uppercase text-text-dim">Active Target Node</label>
                <select 
                  value={selectedPartId}
                  onChange={(e) => setSelectedPartId(e.target.value)}
                  className="bg-bg text-white border border-[#2a2d35] rounded px-2.5 py-1.5 text-xs font-mono outline-none focus:border-amber-500 cursor-pointer"
                >
                  {parts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-[9px] text-text-dim font-mono italic mt-1">Tip: You can also click the nodes directly in the 3D scene!</p>
              </div>

              {/* Click Coordinates Widget */}
              <div className="flex flex-col gap-2 bg-[#090b0e] border border-dashed border-cyan-500/30 p-3 rounded-md">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase text-cyan-400 font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Last Clicked Point
                  </span>
                  {lastClickedPoint && (
                    <button
                      onClick={() => {
                        const coordsStr = `[${lastClickedPoint.map(n => n.toFixed(4)).join(', ')}]`;
                        navigator.clipboard.writeText(coordsStr).then(() => {
                          setCopiedClicked(true);
                          setTimeout(() => setCopiedClicked(false), 2000);
                        });
                      }}
                      className="font-mono text-[9px] uppercase text-cyan-400 hover:underline cursor-pointer"
                    >
                      {copiedClicked ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
                
                {lastClickedPoint ? (
                  <div className="flex flex-col gap-2">
                    <div className="bg-[#000] border border-[#2a2d35] p-2 rounded flex flex-col gap-1 text-[11px] font-mono text-cyan-300">
                      <div className="flex justify-between">
                        <span>X: {lastClickedPoint[0].toFixed(4)}</span>
                        <span>Y: {lastClickedPoint[1].toFixed(4)}</span>
                        <span>Z: {lastClickedPoint[2].toFixed(4)}</span>
                      </div>
                      <div className="text-[9px] text-text-dim text-right font-normal">
                        [{lastClickedPoint.map(n => n.toFixed(4)).join(', ')}]
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setParts(prev => prev.map(p => {
                          if (p.id !== selectedPartId) return p;
                          return {
                            ...p,
                            position: [
                              parseFloat(lastClickedPoint[0].toFixed(4)),
                              parseFloat(lastClickedPoint[1].toFixed(4)),
                              parseFloat(lastClickedPoint[2].toFixed(4))
                            ]
                          };
                        }));
                      }}
                      className="w-full py-1.5 bg-cyan-950/40 hover:bg-cyan-900 border border-cyan-500/35 text-cyan-400 text-[10px] font-mono font-bold uppercase rounded cursor-pointer transition-all active:scale-[0.98] text-center"
                    >
                      Assign to {parts.find(p => p.id === selectedPartId)?.name || 'Active Node'}
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-text-dim font-mono italic leading-normal">
                    Click anywhere on the 3D specimen to instantly map coordinates!
                  </p>
                )}
              </div>

              {/* Adjusters */}
              {parts.map(p => {
                if (p.id !== selectedPartId) return null;
                const [x, y, z] = p.position;

                const adjustCoord = (axisIndex: number, delta: number) => {
                  setParts(prev => prev.map(item => {
                    if (item.id !== p.id) return item;
                    const newPos = [...item.position] as [number, number, number];
                    newPos[axisIndex] = parseFloat((newPos[axisIndex] + delta).toFixed(4));
                    return { ...item, position: newPos };
                  }));
                };

                return (
                  <div key={p.id} className="flex flex-col gap-3 bg-[#0d0f13] border border-amber-500/20 p-4 rounded-lg">
                    <div className="text-center font-mono text-[11px] font-bold text-amber-400 border-b border-[#2a2d35] pb-2 uppercase tracking-wide">
                      {p.name} Node Coordinates
                    </div>

                    {[
                      { label: 'X Axis (Left / Right)', val: x, idx: 0 },
                      { label: 'Y Axis (Up / Down)', val: y, idx: 1 },
                      { label: 'Z Axis (Depth)', val: z, idx: 2 }
                    ].map(axis => (
                      <div key={axis.label} className="flex flex-col gap-1">
                        <div className="flex justify-between font-mono text-[9px] text-[#888]">
                          <span>{axis.label}</span>
                          <span className="text-amber-500 font-bold">{axis.val.toFixed(4)}</span>
                        </div>
                        
                        <div className="grid grid-cols-6 gap-0.5">
                          <button 
                            onClick={() => adjustCoord(axis.idx, -0.1)} 
                            className="px-1 py-1 bg-[#1e2128] border border-[#2a2d35] text-[9px] rounded text-white font-mono hover:bg-[#252932] active:bg-amber-500 active:text-bg cursor-pointer"
                            title="-0.10"
                          >-0.1</button>
                          <button 
                            onClick={() => adjustCoord(axis.idx, -0.01)} 
                            className="px-1 py-1 bg-[#1e2128] border border-[#2a2d35] text-[9px] rounded text-white font-mono hover:bg-[#252932] active:bg-amber-500 active:text-bg cursor-pointer"
                            title="-0.01"
                          >-0.01</button>
                          <button 
                            onClick={() => adjustCoord(axis.idx, -0.001)} 
                            className="px-1 py-1 bg-[#1e2128] border border-[#2a2d35] text-[9px] rounded text-white font-mono hover:bg-[#252932] active:bg-amber-500 active:text-bg cursor-pointer"
                            title="-0.001"
                          >-0.001</button>
                          <button 
                            onClick={() => adjustCoord(axis.idx, 0.001)} 
                            className="px-1 py-1 bg-[#1e2128] border border-[#2a2d35] text-[9px] rounded text-white font-mono hover:bg-[#252932] active:bg-amber-500 active:text-bg cursor-pointer"
                            title="+0.001"
                          >+0.001</button>
                          <button 
                            onClick={() => adjustCoord(axis.idx, 0.01)} 
                            className="px-1 py-1 bg-[#1e2128] border border-[#2a2d35] text-[9px] rounded text-white font-mono hover:bg-[#252932] active:bg-amber-500 active:text-bg cursor-pointer"
                            title="+0.01"
                          >+0.01</button>
                          <button 
                            onClick={() => adjustCoord(axis.idx, 0.1)} 
                            className="px-1 py-1 bg-[#1e2128] border border-[#2a2d35] text-[9px] rounded text-white font-mono hover:bg-[#252932] active:bg-amber-500 active:text-bg cursor-pointer"
                            title="+0.1"
                          >+0.1</button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Keyboard nudges instruction */}
              <div className="bg-[#0f1115] border border-dashed border-[#2a2d35] p-3 rounded text-[10px] text-[#aaa] font-mono leading-normal">
                <div className="font-bold text-amber-500/80 mb-1 uppercase text-[9px]">Keyboard Nudges</div>
                <div><span className="text-white">← / →</span> : move chosen part on X</div>
                <div><span className="text-white">↑ / ↓</span> : move chosen part on Y</div>
                <div><span className="text-white">[ / ]</span> : move chosen part on Z</div>
                <div className="mt-1 text-amber-400/70 border-t border-[#1a1c22] pt-1">
                  Hold <span className="text-white">SHIFT</span> for 10x larger steps!
                </div>
              </div>

              {/* Exporter Block */}
              <div className="mt-auto flex flex-col gap-2">
                <label className="font-mono text-[9px] uppercase text-text-dim">Config Output (PASTE INTO BODY_PARTS)</label>
                <textarea 
                  readOnly
                  value={serializedCode}
                  className="w-full h-24 bg-bg border border-[#2a2d35] rounded p-2 text-[8px] font-mono text-cyan-400 overflow-y-auto selection:bg-amber-500/30 selection:text-amber-200 resize-none outline-none focus:border-amber-500"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <button 
                  onClick={copyToClipboard}
                  className={`w-full py-2 rounded text-[11px] font-mono font-bold uppercase transition-all shadow-md cursor-pointer ${
                    copied 
                      ? 'bg-success text-bg shadow-[0_0_10px_rgba(0,255,157,0.4)]' 
                      : 'bg-amber-500 text-bg hover:opacity-90 active:scale-95'
                  }`}
                >
                  {copied ? 'Copied to Clipboard!' : 'Copy Config Array'}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
      )}

      {/* Footer */}
      <footer className="h-[40px] bg-panel border-t border-[#2a2d35] flex items-center justify-between px-6 font-mono text-[10px] text-text-dim">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${complete ? 'bg-success shadow-[0_0_5px_#00ff9d]' : 'bg-accent animate-pulse shadow-[0_0_5px_#00f2ff]'}`} />
          <span>3D RENDER ENGINE: VULKAN CORE v9</span>
        </div>
        <div className="flex items-center gap-1">
          {[...Array(7)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ height: [4, 16, 4] }}
              transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
              className="w-1 bg-accent/40 rounded-full"
            />
          ))}
        </div>
        <div>© 2024 BIOTECH-OS CORP.</div>
      </footer>

      {/* Overlays */}
      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm"
            onClick={() => setShowInfo(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-panel border border-[#2a2d35] p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-[60px] -mr-16 -mt-16" />
              
              <div className="font-mono text-[10px] text-accent uppercase tracking-[2px] mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Voxel Data Confirmed
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">{showInfo.name} Validated</h2>
              <div className="h-[1px] w-full bg-[#2a2d35] mb-6" />
              
              <p className="text-text-dim text-sm leading-relaxed mb-8 font-mono">
                {showInfo.description}
              </p>
              
              <button 
                onClick={() => setShowInfo(null)}
                className="w-full py-3 bg-accent text-bg font-bold uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)]"
              >
                Return to Scanning
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {complete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-bg/95 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center max-w-xl"
            >
              <div className="mb-8 inline-block relative">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                  className="absolute -inset-8 border border-dashed border-accent/20 rounded-full"
                />
                <Trophy className="w-20 h-20 text-accent mx-auto" />
              </div>
              
              <h2 className="text-5xl font-black text-white mb-3 italic uppercase tracking-tighter text-glow">Diagnostic Match</h2>
              <div className="text-accent text-sm font-mono tracking-[0.4em] mb-8 font-bold">ALL RADIOLOGICAL NODES VALIDATED</div>
              
              <p className="text-text-dim text-lg mb-10 leading-relaxed font-mono max-w-md mx-auto">
                3D Diagnostic sequence complete. The specimen anatomy has been fully mapped and cross-referenced with medical archives.
              </p>

              <button 
                onClick={resetActivity}
                className="group relative inline-flex items-center gap-4 py-4 px-10 bg-accent text-bg font-black uppercase tracking-widest text-sm hover:scale-105 active:scale-95 transition-all"
              >
                INITIALIZE NEW SCAN
                <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-all duration-700" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .text-glow {
          text-shadow: 0 0 15px rgba(0, 242, 255, 0.4);
        }
      `}} />
    </div>
  );
}
