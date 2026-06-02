/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MousePointer2 } from 'lucide-react';
import { BodyPart } from '../types';

interface DraggableLabelProps {
  part: BodyPart;
  onCorrectDrop: () => void;
  isCorrect: boolean;
  hotspotPositionsRef: React.RefObject<Record<string, { x: number, y: number, clientX: number, clientY: number }>>;
  containerRef: React.RefObject<HTMLDivElement>;
  isSelected?: boolean;
  onClick?: () => void;
}

export const DraggableLabel = ({ 
  part, 
  onCorrectDrop, 
  isCorrect, 
  hotspotPositionsRef,
  isSelected,
  onClick
}: DraggableLabelProps) => {
  const [isError, setIsError] = useState(false);
  
  const handleDragEnd = (event: any, info: any) => {
    const pos = hotspotPositionsRef.current?.[part.id];
    if (isCorrect || !pos) return;

    // Check distance in screen pixels
    const dist = Math.sqrt(
      Math.pow(info.point.x - pos.clientX, 2) + 
      Math.pow(info.point.y - pos.clientY, 2)
    );

    const threshold = 55; // pixels (slightly larger threshold for highly intuitive drop alignment)

    if (dist < threshold) {
      onCorrectDrop();
    } else {
      setIsError(true);
      setTimeout(() => setIsError(false), 1000);
    }
  };

  return (
    <motion.div
      drag={!isCorrect}
      dragSnapToOrigin
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      onTap={() => {
        if (onClick) onClick();
      }}
      whileDrag={!isCorrect ? { scale: 1.05, zIndex: 1000, rotate: 1 } : undefined}
      whileHover={{ 
        borderColor: isSelected ? '#00f2ff' : (isCorrect ? '#00ff9d' : '#00f2ff'), 
        backgroundColor: '#232a35' 
      }}
      initial={{ opacity: 0, x: -10 }}
      animate={{ 
        opacity: isCorrect && !isSelected ? 0.6 : 1, 
        x: 0,
        borderColor: isError 
          ? '#ff3e3e' 
          : isSelected 
            ? '#00f2ff' 
            : isCorrect 
              ? 'rgba(0, 255, 157, 0.3)' 
              : '#2a2d35'
      }}
      className={`
        relative px-4 py-3 rounded border transition-all duration-200
        flex items-center justify-between select-none font-mono text-xs uppercase tracking-wider
        ${!isCorrect ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
        bg-[#1e2128]
        ${isError ? 'bg-danger/10 shadow-[0_0_15px_rgba(255,62,62,0.3)] font-semibold border-danger' : 'text-[#e0e0e0]'}
        ${isSelected ? 'shadow-[0_0_12px_rgba(0,242,255,0.15)] bg-[#1e2630]' : ''}
      `}
    >
      <span className={`${isCorrect ? 'line-through text-[#a0a0a0]' : ''}`}>
        {part.name}
      </span>
      
      {isCorrect ? (
        <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_5px_#00ff9d]" />
      ) : (
        <MousePointer2 className={`w-3 h-3 ${isError ? 'text-danger animate-pulse' : 'text-accent opacity-50'}`} />
      )}
      
      {isError && (
        <motion.span 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-5 left-0 right-0 text-center text-[8px] text-danger font-bold uppercase tracking-widest z-10"
        >
          Node Mismatch
        </motion.span>
      )}
    </motion.div>
  );
};
