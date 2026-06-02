import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Activity, 
  RotateCcw, 
  Clock, 
  ShieldAlert, 
  CheckCircle, 
  Sparkles, 
  Play, 
  ChevronRight, 
  Target
} from 'lucide-react';
import bodyDetails from '../../body-details.json';

// --- Types ---
export interface QuizQuestion {
  id: string; // matches body part ID
  partName: string;
  correctInfo: string;
  wrongOptions: string[];
}

// --- Data ---
const GAME_QUESTIONS: QuizQuestion[] = bodyDetails.bodyParts.map((part) => {
  // Get other parts' info as wrong options
  const otherInfos = bodyDetails.bodyParts
    .filter(p => p.id !== part.id)
    .map(p => p.info);
  
  // Randomize wrong options to supply additional distractor nodes
  const wrongOptions = [...otherInfos].sort(() => Math.random() - 0.5).slice(0, 3);

  return {
    id: part.id,
    partName: part.label.toUpperCase(),
    correctInfo: part.info,
    wrongOptions
  };
});

// --- Interface Definitions ---
interface GameNode {
  id: string;
  text: string;
  isCorrect: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  flashSecs: number; // For visual feedback flash
  flashType: 'none' | 'success' | 'fail';
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  life: number;
}

interface GameModeProps {
  onBackToStudent: () => void;
}

export default function GameMode({ onBackToStudent }: GameModeProps) {
  // --- Game State States ---
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'ended'>('lobby');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [successfulHits, setSuccessfulHits] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [shuffledQuestions, setShuffledQuestions] = useState<QuizQuestion[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // References for game loop updates (to prevent React re-renders from killing 60fps)
  const nodesRef = useRef<GameNode[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const timeDeductionFlashRef = useRef(0); // Screen flashes red temporarily on error
  
  // High score tracking (saved in localStorage for arcade feel)
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('mri_arcade_high_score') || '0', 10);
    } catch {
      return 0;
    }
  });

  const activeQuestion = useMemo(() => {
    if (shuffledQuestions.length === 0) return null;
    return shuffledQuestions[currentQuestionIdx] || null;
  }, [shuffledQuestions, currentQuestionIdx]);

  // Calculate Accuracy
  const accuracy = useMemo(() => {
    if (totalAttempts === 0) return 0;
    return Math.round((successfulHits / totalAttempts) * 100);
  }, [totalAttempts, successfulHits]);

  // Rank Definition
  const rankInfo = useMemo(() => {
    const scoreVal = successfulHits;
    if (scoreVal <= 3) return { title: 'Trainee', color: 'text-text-dim text-cyan-500/40 border-cyan-500/20' };
    if (scoreVal <= 6) return { title: 'Med Student', color: 'text-cyan-400 border-cyan-400/30' };
    if (scoreVal <= 9) return { title: 'Radiology Resident', color: 'text-accent border-accent/40 shadow-[0_0_8px_rgba(0,242,255,0.2)]' };
    return { title: 'MRI Expert', color: 'text-success border-success/40 shadow-[0_0_12px_rgba(0,255,157,0.4)] animate-pulse' };
  }, [successfulHits]);

  // --- Start Game ---
  const handleStartGame = () => {
    // Shuffle the questions list and pick exactly 4 to avoid clutter and repetition
    const shuffled = [...GAME_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 4);
    setShuffledQuestions(shuffled);
    setCurrentQuestionIdx(0);
    setScore(0);
    setTimeLeft(60);
    setTotalAttempts(0);
    setSuccessfulHits(0);
    setGameState('playing');
    
    // Clear physics ref arrays
    nodesRef.current = [];
    bulletsRef.current = [];
    particlesRef.current = [];
  };

  // --- Reset Game (Back to Lobby) ---
  const handleReset = () => {
    setGameState('lobby');
  };

  // Timer Countdown Effect
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameState('ended');
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState]);

  // Check Game End Condition (all questions answered)
  useEffect(() => {
    if (gameState === 'playing' && shuffledQuestions.length > 0 && currentQuestionIdx >= shuffledQuestions.length) {
      setGameState('ended');
    }
  }, [currentQuestionIdx, shuffledQuestions, gameState]);

  // Update high score on game end
  useEffect(() => {
    if (gameState === 'ended') {
      if (score > highScore) {
        setHighScore(score);
        try {
          localStorage.setItem('mri_arcade_high_score', score.toString());
        } catch (e) {
          console.warn('Unable to save high score to localStorage:', e);
        }
      }
    }
  }, [gameState, score, highScore]);

  // Helper to spawn floating nodes for the current active questions at the start
  const spawnInitialNodes = (questions: QuizQuestion[], canvasWidth: number, canvasHeight: number) => {
    const padding = 120;
    const items: GameNode[] = [];
    const HUD_HEIGHT = 100;

    questions.forEach((question, index) => {
      const r = 75; // circle radius fits descriptions nicely
      // Distribute spawn positions reasonably across upper half of the screen
      const x = padding + (index * (canvasWidth - padding * 2)) / Math.max(1, questions.length - 1);
      // Position safety from HUD (which is about 90px high now) and bottom canon
      const y = HUD_HEIGHT + r + 15 + Math.random() * Math.max(30, canvasHeight - HUD_HEIGHT - r - 150);

      // Random velocities
      const speedScale = 0.8; // slightly relaxed for better tracking and reading
      const angle = Math.random() * Math.PI * 2;
      const vx = Math.cos(angle) * speedScale;
      const vy = Math.sin(angle) * speedScale;

      items.push({
        id: question.id,
        text: question.correctInfo,
        isCorrect: false, // resolved dynamically now based on activeQuestion.id
        x,
        y,
        vx,
        vy,
        r,
        flashSecs: 0,
        flashType: 'none'
      });
    });

    nodesRef.current = items;
  };

  // Spawn initial nodes once when entering the playing state with loaded questions
  useEffect(() => {
    if (gameState !== 'playing' || shuffledQuestions.length === 0 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    spawnInitialNodes(shuffledQuestions, canvas.clientWidth, canvas.clientHeight);
  }, [gameState, shuffledQuestions]);

  // --- Mouse Movement Handler ---
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mousePosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // --- Tap / Click Trigger Fire ---
  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameState !== 'playing' || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const width = rect.width;
    const height = rect.height;

    // Cannon base location
    const cannonX = width / 2;
    const cannonY = height - 25;

    // Direct angle calculation
    const dx = clickX - cannonX;
    const dy = clickY - cannonY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return;

    // Setup bullet direction components with faster projectile speed
    const speed = 18;
    const vx = (dx / distance) * speed;
    const vy = (dy / distance) * speed;

    bulletsRef.current.push({
      x: cannonX + (dx / distance) * 45, // starts at tip of barrel
      y: cannonY + (dy / distance) * 45,
      vx,
      vy,
      r: 6
    });

    // Fire sound effect or minor flash
    // Spawn subtle exhaust sparks
    for (let i = 0; i < 5; i++) {
      particlesRef.current.push({
        x: cannonX + (dx / distance) * 45,
        y: cannonY + (dy / distance) * 45,
        vx: (dx / distance) * 5 + (Math.random() - 0.5) * 3,
        vy: (dy / distance) * 5 + (Math.random() - 0.5) * 3,
        color: '#00f2ff',
        alpha: 1.0,
        life: 15 + Math.random() * 15
      });
    }
  };

  // --- Game Processing Engine (Animation Loop) ---
  useEffect(() => {
    if (gameState !== 'playing' || !canvasRef.current) return;

    let animId: number;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle canvas dimensions match client rect (helps prevent stretching)
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 500;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Text Wrap Helper Function
    const wrapAndRenderText = (
      context: CanvasRenderingContext2D, 
      text: string, 
      cx: number, 
      cy: number, 
      maxWidth: number, 
      lh: number
    ) => {
      context.font = '10px "JetBrains Mono", Courier, monospace';
      context.fillStyle = '#ffffff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      const words = text.split(' ');
      let line = '';
      const lines: string[] = [];

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          lines.push(line);
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      const totalHeight = lines.length * lh;
      let startY = cy - totalHeight / 2 + lh / 2;
      for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i].trim(), cx, startY);
        startY += lh;
      }
    };

    // Main Update logic frame
    const loop = () => {
      const width = canvas.width;
      const height = canvas.height;

      // 1. Clear Frame & background scan effect
      ctx.clearRect(0, 0, width, height);

      // Dark cyber slate background gradient
      const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width);
      bgGrad.addColorStop(0, '#0c0f14');
      bgGrad.addColorStop(1, '#05070a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Render matrix grids
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.025)';
      ctx.lineWidth = 1;
      const gridSize = 32;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw screen warning tint border on error
      if (timeDeductionFlashRef.current > 0) {
        timeDeductionFlashRef.current -= 1.5;
        ctx.strokeStyle = `rgba(255, 62, 62, ${Math.min(0.3, timeDeductionFlashRef.current / 60)})`;
        ctx.lineWidth = 15;
        ctx.strokeRect(0, 0, width, height);
        ctx.lineWidth = 1;
      }

      // 2. Physics & Logic: project variables
      const nodes = nodesRef.current;
      const bullets = bulletsRef.current;
      const particles = particlesRef.current;

      // Nodes updates (Slow float inside limits)
      nodes.forEach((node) => {
        // Position update
        node.x += node.vx;
        node.y += node.vy;

        // Bouncing logic boundaries
        if (node.x - node.r < 10) {
          node.x = node.r + 10;
          node.vx = Math.abs(node.vx);
        } else if (node.x + node.r > width - 10) {
          node.x = width - node.r - 10;
          node.vx = -Math.abs(node.vx);
        }

        // Bouncing top and lower height threshold (stops overlap with cannon setup and HUD overlay)
        const HUD_HEIGHT = 110;
        if (node.y - node.r < HUD_HEIGHT) {
          node.y = node.r + HUD_HEIGHT;
          node.vy = Math.abs(node.vy);
        } else if (node.y + node.r > height - 120) {
          node.y = height - 120 - node.r;
          node.vy = -Math.abs(node.vy);
        }

        // Handle flash timer
        if (node.flashSecs > 0) {
          node.flashSecs -= 1.5;
          if (node.flashSecs <= 0) {
            node.flashType = 'none';
          }
        }

        // Node drawings
        ctx.save();
        
        // Circular mask background
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.fill();

        // Node glow selection styles
        ctx.shadowBlur = 10;
        if (node.flashType === 'success') {
          ctx.strokeStyle = '#00ff9d';
          ctx.shadowColor = '#00ff9d';
          // Render extra glowing circular pulses
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.r + (45 - node.flashSecs) * 0.7, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 255, 157, ${node.flashSecs / 45})`;
          ctx.stroke();
        } else if (node.flashType === 'fail') {
          ctx.strokeStyle = '#ff3e3e';
          ctx.shadowColor = '#ff3e3e';
        } else {
          ctx.strokeStyle = 'rgba(0, 242, 255, 0.25)';
          ctx.shadowColor = 'rgba(0, 242, 255, 0.15)';
        }

        // Standard stroke circle
        ctx.beginPath();
        ctx.lineWidth = node.flashType !== 'none' ? 3 : 1.5;
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Compass crosshairs ticks on the float nodes
        ctx.strokeStyle = 'rgba(0, 242, 255, 0.15)';
        ctx.beginPath();
        ctx.moveTo(node.x - node.r - 5, node.y);
        ctx.lineTo(node.x - node.r, node.y);
        ctx.moveTo(node.x + node.r, node.y);
        ctx.lineTo(node.x + node.r + 5, node.y);
        ctx.moveTo(node.x, node.y - node.r - 5);
        ctx.lineTo(node.x, node.y - node.r);
        ctx.moveTo(node.x, node.y + node.r);
        ctx.lineTo(node.x, node.y + node.r + 5);
        ctx.stroke();

        // Write content wrapping text
        wrapAndRenderText(ctx, node.text, node.x, node.y, node.r * 1.6, 14);
      });

      // Bullets mechanics
      for (let b = bullets.length - 1; b >= 0; b--) {
        const bullet = bullets[b];
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        // Draw bullet glowing projectile
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f2ff';
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
        ctx.fill();

        // Bullet Tail trail
        ctx.strokeStyle = 'rgba(0, 242, 255, 0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(bullet.x - bullet.vx * 1.5, bullet.y - bullet.vy * 1.5);
        ctx.stroke();
        ctx.restore();

        // Boundary cull offscreen
        if (
          bullet.x < -20 || 
          bullet.x > width + 20 || 
          bullet.y < -20 || 
          bullet.y > height + 20
        ) {
          bullets.splice(b, 1);
          continue;
        }

        // Collision Check (Line/Point to circle)
        let didHit = false;
        for (let n = 0; n < nodes.length; n++) {
          const node = nodes[n];
          const dist = Math.sqrt(Math.pow(bullet.x - node.x, 2) + Math.pow(bullet.y - node.y, 2));

          if (dist < node.r + bullet.r) {
            // Hit detected!
            didHit = true;
            bullets.splice(b, 1);

            setTotalAttempts(prev => prev + 1);

            if (activeQuestion && node.id === activeQuestion.id) {
              // CORRECT TARGET HIT
              setScore(prev => prev + 100);
              setSuccessfulHits(prev => prev + 1);

              // Correct sound visual burst (spawn gorgeous green-teal particles)
              for (let kp = 0; kp < 25; kp++) {
                const pAngle = Math.random() * Math.PI * 2;
                const pSpeed = 2 + Math.random() * 5;
                particles.push({
                  x: bullet.x,
                  y: bullet.y,
                  vx: Math.cos(pAngle) * pSpeed,
                  vy: Math.sin(pAngle) * pSpeed,
                  color: '#00ff9d',
                  alpha: 1.0,
                  life: 30 + Math.random() * 20
                });
              }

              // Remove the correct node from array immediately to disappear
              const matchedId = node.id;
              nodesRef.current = nodesRef.current.filter(n => n.id !== matchedId);

              // Shift round trigger to next question immediately
              setCurrentQuestionIdx(prev => prev + 1);

            } else {
              // WRONG NODE HIT
              node.flashSecs = 30;
              node.flashType = 'fail';
              setScore(prev => Math.max(0, prev - 50));
              setTimeLeft(prev => Math.max(0, prev - 5)); // Minus 5 seconds
              timeDeductionFlashRef.current = 24; // trigger frame flash

              // Incorrect sound visual burst (red-flushed warning particles)
              for (let fp = 0; fp < 20; fp++) {
                const pAngle = Math.random() * Math.PI * 2;
                const pSpeed = 3 + Math.random() * 4;
                particles.push({
                  x: bullet.x,
                  y: bullet.y,
                  vx: Math.cos(pAngle) * pSpeed,
                  vy: Math.sin(pAngle) * pSpeed,
                  color: '#ff3e3e',
                  alpha: 1.0,
                  life: 25 + Math.random() * 15
                });
              }
            }

            break; // Stop nested cycle checking for this single bullet
          }
        }
        if (didHit) continue;
      }

      // Spark Particles updates
      for (let p = particles.length - 1; p >= 0; p--) {
        const part = particles[p];
        part.x += part.vx;
        part.y += part.vy;
        part.vx *= 0.98; // speed drag
        part.vy *= 0.98;
        part.life--;

        // Draw particle dot
        ctx.fillStyle = part.color;
        ctx.globalAlpha = part.life / 30;
        ctx.beginPath();
        ctx.arc(part.x, part.y, 2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        if (part.life <= 0) {
          particles.splice(p, 1);
        }
      }

      // 3. Draw Cyber Scanner Cannon (Center Bottom)
      const cannonX = width / 2;
      const cannonY = height - 25;

      // Rotate angle matches current mouse coordinates pointer
      const mDx = mousePosRef.current.x - cannonX;
      const mDy = mousePosRef.current.y - cannonY;
      const targetAngle = Math.atan2(mDy, mDx);

      ctx.save();
      ctx.translate(cannonX, cannonY);
      ctx.rotate(targetAngle);

      // Draw Turret Barrel Pointer (Futuristic medical laser design)
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#00f2ff';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#00f2ff';

      // Laser guide line indicator (Subtle dashed aim guide line)
      ctx.save();
      ctx.setLineDash([5, 8]);
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, 0);
      ctx.lineTo(800, 0);
      ctx.stroke();
      ctx.restore();

      // Barrel outline
      ctx.fillStyle = '#0a0d13';
      ctx.strokeStyle = '#00f2ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.rect(0, -9, 45, 18);
      ctx.fill();
      ctx.stroke();

      // Laser central nozzle core
      ctx.fillStyle = '#00ff9d';
      ctx.beginPath();
      ctx.rect(40, -4, 5, 8);
      ctx.fill();

      // Barrel glowing strips
      ctx.strokeStyle = '#00f2ff';
      ctx.beginPath();
      ctx.moveTo(10, -5);
      ctx.lineTo(35, -5);
      ctx.moveTo(10, 5);
      ctx.lineTo(35, 5);
      ctx.stroke();

      ctx.restore();

      // Cannon Base Ring mounts (drawn non-rotating)
      ctx.save();
      ctx.translate(cannonX, cannonY);
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00f2ff';
      ctx.fillStyle = '#0d0f14';
      ctx.strokeStyle = '#004a4d';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI, true);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI, true);
      ctx.fillStyle = '#00f2ff';
      ctx.fill();
      ctx.restore();

      // Recursively trigger loop drawing
      animId = requestAnimationFrame(loop);
    };

    // Begin Loop trigger
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [gameState, currentQuestionIdx]);

  return (
    <div 
      ref={containerRef} 
      className="flex-1 flex flex-col relative bg-bg overflow-hidden"
      onMouseMove={handleMouseMove}
      onClick={handleTap}
    >
      {/* Scan patterns background scanner mesh lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_49%,rgba(0,242,255,0.015)_50%,transparent_51%)] bg-[size:100%_28px] pointer-events-none z-10" />

      {/* RENDER VIEW SWAP CONTROLLERS */}
      <AnimatePresence mode="wait">
        
        {/* State: LOBBY PAGE VIEW */}
        {gameState === 'lobby' && (
          <motion.div 
            key="lobby"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="absolute inset-0 flex items-center justify-center p-6 z-20"
          >
            <div className="max-w-2xl w-full bg-[#0d1016]/95 border border-[#1e242f] rounded-xl p-8 shadow-[0_0_50px_rgba(0,242,255,0.06)] relative overflow-hidden flex flex-col gap-6">
              
              {/* Corner Cyber Accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-accent" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-accent" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-accent" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-accent" />

              <div className="text-center flex flex-col items-center gap-1">
                <div className="px-3 py-1 bg-accent/10 border border-accent/20 rounded font-mono text-[9px] uppercase tracking-[3px] text-accent animate-pulse">
                  SYSTEM ARCADE QUIZ RUN-TIME
                </div>
                <h2 className="text-3xl font-black italic tracking-tighter text-white mt-3 uppercase flex items-center gap-3">
                  <Activity className="w-8 h-8 text-accent animate-pulse" />
                  SPECTRAL SHOOTER
                </h2>
                <p className="text-xs text-text-dim max-w-sm mt-1.5 font-mono leading-relaxed">
                  Cyber-medical scanning calibration test. Align the medical laser turret and validate the correct nuclear descriptors.
                </p>
              </div>

              {/* Grid instructions */}
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="bg-[#080a0e] border border-[#1d222b] p-4 rounded-lg flex flex-col gap-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-accent flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-accent" />
                    How to play
                  </span>
                  <ul className="text-[11px] text-text-dim flex flex-col gap-1.5 font-mono list-disc pl-3 leading-relaxed">
                    <li>Rotate the central scanner cannon by moving your cursor anywhere.</li>
                    <li>Click or tap anywhere on screen to shoot light-speed scanning pulses.</li>
                    <li>Match the active body part targeted in the top scanning deck.</li>
                  </ul>
                </div>

                <div className="bg-[#080a0e] border border-[#1d222b] p-4 rounded-lg flex flex-col gap-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-amber-500 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                    Arcade Mechanics
                  </span>
                  <ul className="text-[11px] text-text-dim flex flex-col gap-1.5 font-mono list-disc pl-3 leading-relaxed">
                    <li>Shoot the correct anatomical description and it explodes on verification (+100 pts).</li>
                    <li>Hitting an incorrect site flashes red and triggers a <strong>-5 second time decay</strong>.</li>
                    <li>Correct consecutive matches increase sequence integrity.</li>
                  </ul>
                </div>
              </div>

              {/* Stats Bar */}
              {highScore > 0 && (
                <div className="bg-[#121620]/80 border border-accent/10 py-2.5 px-4 rounded-md flex items-center justify-between font-mono text-[11px]">
                  <span className="text-text-dim flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    ESTABLISHED STATION RECORD
                  </span>
                  <span className="text-accent font-extrabold tracking-widest">{highScore} SYSTEM POINTS</span>
                </div>
              )}

              {/* Play buttons */}
              <div className="flex gap-3 justify-end mt-4">
                <button 
                  onClick={onBackToStudent}
                  className="px-5 py-3 border border-[#2a303d] hover:border-[#414b5e] hover:text-white rounded transition-all font-mono text-xs uppercase cursor-pointer"
                >
                  Return to Learning Board
                </button>
                <button 
                  onClick={handleStartGame}
                  className="px-8 py-3 bg-accent text-bg hover:opacity-90 active:scale-95 text-xs font-black uppercase tracking-widest shadow-[0_0_15px_rgba(0,242,255,0.4)] transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  INITIATE SCAN
                </button>
              </div>

            </div>
          </motion.div>
        )}

        {/* State: PLAYING GAME SCREEN */}
        {gameState === 'playing' && activeQuestion && (
          <motion.div 
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col justify-between pointer-events-none z-20"
          >
            {/* HUD Header overlay panel */}
            <div className="w-full bg-[#0a0c10]/95 border-b border-[#1e232d] py-2.5 px-6 flex flex-col gap-1 pointer-events-auto shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
              <div className="flex justify-between items-center max-w-7xl mx-auto w-full">
                
                {/* Score panel */}
                <div className="flex flex-col gap-0.5 min-w-[130px]">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-text-dim">Sequence Integrity</span>
                  <span className="font-mono text-base font-black text-white flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-accent animate-pulse" />
                    {score} <span className="text-[9px] text-text-dim font-normal">PTS</span>
                  </span>
                </div>

                {/* Target Prompt Central display */}
                <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-4">
                  <div className="flex items-center gap-1.5 text-accent/80 font-mono text-[9px] uppercase tracking-[3px] font-extrabold mb-0.5">
                    <Target className="w-3 r-3 text-accent animate-spin animate-none" style={{ animationDuration: '6s' }} />
                    Anatomical Target
                  </div>
                  <h3 className="text-lg font-black italic tracking-wide text-glow text-white uppercase px-4 py-0.5 bg-accent/5 border border-accent/20 rounded-md text-center max-w-full">
                    {activeQuestion.partName}
                  </h3>
                </div>

                {/* Timer Clock panel */}
                <div className="flex flex-col gap-0.5 items-end min-w-[130px]">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-text-dim">Chronology Sync</span>
                  <span className={`font-mono text-base font-black flex items-center gap-1.5 ${timeLeft <= 10 ? 'text-danger animate-pulse' : 'text-accent'}`}>
                    <Clock className="w-3.5 h-3.5" />
                    {timeLeft}s
                  </span>
                </div>

              </div>

              {/* Progress and status indicators bar */}
              <div className="max-w-7xl mx-auto w-full border-t border-[#1a1e27] pt-1.5 mt-0.5 flex justify-between items-center text-[8.5px] font-mono text-text-dim">
                <div className="flex items-center gap-1.5">
                  <span>SCANNING MATRIX STATE:</span>
                  <span className="text-accent uppercase">ACTIVE</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[9px] tracking-widest font-black uppercase">
                    CYCLE: {currentQuestionIdx + 1} / {shuffledQuestions.length}
                  </span>
                  <div className="flex gap-1">
                    {shuffledQuestions.map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-3.5 h-1.5 rounded-sm transition-colors ${
                          i < currentQuestionIdx 
                            ? 'bg-success' 
                            : i === currentQuestionIdx 
                              ? 'bg-accent shadow-[0_0_5px_#00f2ff] animate-pulse' 
                              : 'bg-[#181c25]'
                        }`} 
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>STATION RECORD:</span>
                  <span className="text-amber-500">{highScore} PTS</span>
                </div>
              </div>

            </div>

            {/* Floating visual alert on minus timer */}
            <AnimatePresence>
              {timeDeductionFlashRef.current > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-danger/90 border border-danger p-3 rounded font-mono text-white text-xs font-bold tracking-widest uppercase shadow-[0_0_30px_rgba(255,62,62,0.4)] z-50 flex items-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4 text-white animate-bounce" />
                  ERROR: CANNON DEVIATION detected (-5s)
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tiny mouse aim crosshairs helper overlay */}
            <div 
              style={{ left: mousePosRef.current.x - 10, top: mousePosRef.current.y - 10, animationDuration: '4s' }}
              className="absolute w-5 h-5 border border-dashed border-accent/40 rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2 animate-spin z-0" 
            />

            {/* Footer scan details panel */}
            <div className="w-full p-4 flex justify-between items-center font-mono text-[9px] text-[#5c687e] bg-gradient-to-t from-[#05070a]/80 to-transparent">
              <span>SCAN TARGETING CORE V9.12 ONLINE</span>
              <span>CURSOR POSITION LOCK ENABLED</span>
              <span>TAP ANYWHERE ON SPECTRUM TO FIRE</span>
            </div>

          </motion.div>
        )}

        {/* State: GAME OVER / SCORE REPORT CARD SCREEN */}
        {gameState === 'ended' && (
          <motion.div 
            key="ended"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center p-6 z-20"
          >
            <div className="max-w-xl w-full bg-[#0d1016]/95 border border-[#1e242f] rounded-xl p-8 shadow-[0_0_50px_rgba(0,242,255,0.06)] relative overflow-hidden flex flex-col gap-6">
              
              {/* Corner Cyber Accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-accent" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-accent" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-accent" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-accent" />

              <div className="text-center flex flex-col items-center gap-2">
                <Trophy className="w-16 h-16 text-amber-500 animate-bounce" />
                <h2 className="text-3xl font-black italic text-glow tracking-tighter text-white uppercase mt-2">
                  Validation Complete
                </h2>
                <p className="text-xs text-text-dim font-mono max-w-sm leading-relaxed">
                  The medical scanner calibration sequences have resolved. Analysis diagnostics generated below.
                </p>
              </div>

              {/* Analysis Score layout */}
              <div className="grid grid-cols-2 gap-4 mt-2">
                
                {/* Score results card */}
                <div className="bg-[#080a0e] border border-[#1d222b] p-4 rounded-lg flex flex-col items-center justify-center gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-text-dim">TOTAL SCORE</span>
                  <span className="font-mono text-3xl font-black text-accent mt-0.5">{score}</span>
                  <span className="font-mono text-[8px] text-text-dim uppercase mt-1">Integrity Calibration</span>
                </div>

                {/* Accuracy results card */}
                <div className="bg-[#080a0e] border border-[#1d222b] p-4 rounded-lg flex flex-col items-center justify-center gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-text-dim">AIM ACCURACY</span>
                  <span className={`font-mono text-3xl font-black mt-0.5 ${accuracy >= 75 ? 'text-success' : 'text-amber-500'}`}>
                    {accuracy}%
                  </span>
                  <span className="font-mono text-[8px] text-text-dim uppercase mt-1">
                    {successfulHits} of {totalAttempts} shots hit
                  </span>
                </div>

              </div>

              {/* Ranks badge block */}
              <div className="bg-[#0c0f14]/90 border border-[#1a212e] rounded-lg p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[9px] uppercase text-text-dim tracking-wider">Professional License Assigned</span>
                  <span className="font-mono text-[8px] text-accent">BIOTECH-OS CORP</span>
                </div>
                <div className={`p-4 rounded-md border text-center font-mono font-extrabold tracking-widest text-lg bg-accent/5 uppercase ${rankInfo.color}`}>
                  {rankInfo.title}
                </div>
                <p className="text-[10px] text-text-dim italic font-mono text-center mt-1">
                  License level evaluated based on {successfulHits} validated body part nodes.
                </p>
              </div>

              {/* Control Action footer */}
              <div className="flex justify-between items-center border-t border-[#1e242f] pt-4 mt-2">
                <button 
                  onClick={onBackToStudent}
                  className="font-mono text-[11px] text-accent/80 hover:text-accent hover:underline cursor-pointer flex items-center gap-1 uppercase"
                >
                  Student Learning Mode
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <div className="flex gap-2">
                  <button 
                    onClick={handleReset}
                    className="px-4 py-2 border border-[#2a303d] hover:border-[#414b5e] hover:text-white rounded transition-all font-mono text-[10px] uppercase cursor-pointer"
                  >
                    Main Lobby
                  </button>
                  <button 
                    onClick={handleStartGame}
                    className="px-6 py-2 bg-accent text-bg hover:opacity-90 active:scale-95 text-[10px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(0,242,255,0.3)] transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    RE-VALIDATE CAPABILITIES
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Main Action Game Canvas */}
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block cursor-crosshair z-0" 
      />
    </div>
  );
}
