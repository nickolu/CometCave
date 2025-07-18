'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Graphics, Container } from 'pixi.js';
import { extend } from '@pixi/react';

type Ring = {
  id: number;
  x: number;
  y: number;
  rotation: number;
  isActive: boolean;
  color: number;
};

type ConfettiPiece = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  life: number; // frames remaining
};

extend({
  Graphics,
  Container,
});

function useRingTossGame() {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [level, setLevel] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isThrowingRing, setIsThrowingRing] = useState(false);
  const [rings, setRings] = useState<Ring[]>([
    { id: 1, x: 100, y: 400, rotation: 0, isActive: true, color: 0xff0000 },
  ]);
  const [scoredColors, setScoredColors] = useState<number[]>([]);
  const [showScore, setShowScore] = useState(false);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  const [targetPosition, setTargetPosition] = useState({ x: 300, y: 250 });

  const directionRef = useRef(1); // 1 => right, -1 => left

  const RING_RADIUS = 25;
  const CONE_HEIGHT = 120;
  const CONE_BASE_WIDTH = 40;
  const CONE_TIP_Y = -CONE_HEIGHT;
  const STRIPE_HEIGHT = 15;
  const POLE_WIDTH = 40; // Same as cone base center width
  const POLE_HEIGHT = 120;

  const CONFETTI_COLORS = [0xff3838, 0xff9f1c, 0xffc300, 0x48bf91, 0x2ec4b6, 0x0c7b93, 0x6a4c93];
  const CONFETTI_LIFE = 100; // frames

  const drawRing = useCallback(
    (g: Graphics, color: number, fillColor: number) => {
      g.clear();
      g.lineStyle(8, color);
      g.beginFill(fillColor);
      g.drawCircle(0, 0, RING_RADIUS);
      g.endFill();
    },
    [RING_RADIUS]
  );

  const drawConfettiPiece = useCallback((g: Graphics, piece: ConfettiPiece) => {
    g.clear();
    g.beginFill(piece.color);
    g.drawRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
    g.endFill();
  }, []);

  const drawCone = useCallback(
    (g: Graphics) => {
      g.clear();

      // Draw pole
      g.beginFill(0x4a4a4a);
      g.drawRect(-POLE_WIDTH / 2, 0, POLE_WIDTH, POLE_HEIGHT);
      g.endFill();

      // Calculate stripe positions
      const stripePositions = scoredColors.map((_, i) => CONE_HEIGHT - (i + 1) * STRIPE_HEIGHT);

      // Draw cone base
      g.lineStyle(0);
      g.beginFill(0x8b4513);
      g.moveTo(-CONE_BASE_WIDTH / 2, 0); // base left
      g.lineTo(CONE_BASE_WIDTH / 2, 0); // base right
      g.lineTo(0, -CONE_HEIGHT); // tip
      g.lineTo(-CONE_BASE_WIDTH / 2, 0); // back to base left
      g.endFill();

      // Draw colored stripes
      scoredColors.forEach((color, i) => {
        const y = stripePositions[i];
        const width = (CONE_BASE_WIDTH * (y + CONE_HEIGHT)) / CONE_HEIGHT; // Width proportional to height
        g.beginFill(color);
        g.drawRect(-width / 2, y, width, STRIPE_HEIGHT);
        g.endFill();
      });
    },
    [scoredColors, POLE_WIDTH, POLE_HEIGHT, CONE_HEIGHT, CONE_BASE_WIDTH, STRIPE_HEIGHT]
  );

  const getActiveRing = () => rings.find(r => r.isActive);

  // Load high score from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hs = window.localStorage.getItem('ringTossHighScore');
    if (hs) setHighScore(parseInt(hs, 10));
  }, []);

  // Save high score whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('ringTossHighScore', highScore.toString());
  }, [highScore]);

  // Target movement & confetti update
  useEffect(() => {
    let animationId: number;
    const speed = 1 + level * 0.5; // increase with level
    const animate = () => {
      setTargetPosition(prev => {
        let newX = prev.x + speed * directionRef.current;
        if (newX > 560) {
          // right boundary (width - margin)
          newX = 560;
          directionRef.current = -1;
        } else if (newX < 40) {
          // left boundary
          newX = 40;
          directionRef.current = 1;
        }
        return { ...prev, x: newX };
      });

      // Update confetti pieces
      setConfetti(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            life: p.life - 1,
          }))
          .filter(p => p.life > 0)
      );

      animationId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationId);
  }, [level]);

  const throwRing = (e: { global: { x: number; y: number } }) => {
    if (isGameOver) return;
    const pos = e.global;
    const activeRing = getActiveRing();
    if (isThrowingRing || !activeRing) return;

    setIsThrowingRing(true);
    const startX = activeRing.x;
    const startY = activeRing.y;
    const targetX = pos.x;
    const targetY = pos.y;

    let t = 0;
    const animate = () => {
      t += 0.015;

      // Calculate new position
      const newX = startX + (targetX - startX) * t * 1.5;
      const newY = startY + (targetY - startY) * t * 1.5 - 250 * Math.sin(Math.PI * t);

      // Check for collision with cone tip
      const tipX = targetPosition.x;
      const tipY = targetPosition.y + CONE_TIP_Y;
      const distance = Math.sqrt(Math.pow(newX - tipX, 2) + Math.pow(newY - tipY, 2));

      if (distance <= RING_RADIUS) {
        // Ring hit the cone tip
        setIsThrowingRing(false);
        // Add the ring's color to scored colors
        setScoredColors(prev => [...prev, activeRing.color]);

        // Spawn confetti pieces at hit location
        const newPieces: ConfettiPiece[] = Array.from({ length: 25 }).map((_, idx) => ({
          id: Date.now() + idx,
          x: tipX,
          y: tipY,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          size: 4 + Math.random() * 4,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          life: CONFETTI_LIFE,
        }));
        setConfetti(prev => [...prev, ...newPieces]);

        // Create a new ring with a new random color
        const newColor = Math.floor(Math.random() * 0xffffff);
        setRings([
          {
            id: activeRing.id + 1,
            x: 100,
            y: 400,
            rotation: 0,
            isActive: true,
            color: newColor,
          },
        ]);
        setScore(prev => {
          const newScore = prev + 1;
          // Level up every 5 points
          if (newScore % 5 === 0) {
            setLevel(lv => lv + 1);
          }
          if (newScore > highScore) setHighScore(newScore);
          return newScore;
        });
        setShowScore(true);
        setTimeout(() => setShowScore(false), 1000);
        return;
      }

      if (t >= 1) {
        // Ring missed the cone
        setIsThrowingRing(false);
        // Missed - lose a life
        setLives(prevLives => {
          const newLives = prevLives - 1;
          if (newLives <= 0) {
            setIsGameOver(true);
          }
          return newLives;
        });
        setRings(prevRings =>
          prevRings.map(r => (r.id === activeRing.id ? { ...r, x: 100, y: 400, rotation: 0 } : r))
        );
        return;
      }

      // Update ring position
      setRings(prevRings =>
        prevRings.map(r =>
          r.id === activeRing.id ? { ...r, x: newX, y: newY, rotation: t * Math.PI * 4 } : r
        )
      );

      requestAnimationFrame(animate);
    };

    animate();
  };

  const handleApplicationClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isGameOver) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
    throwRing({ global: { x, y } });
  };

  const restartGame = () => {
    setScore(0);
    setLives(5);
    setLevel(1);
    setScoredColors([]);
    setRings([{ id: 1, x: 100, y: 400, rotation: 0, isActive: true, color: 0xff0000 }]);
    setConfetti([]);
    setIsGameOver(false);
  };

  return {
    score,
    highScore,
    lives,
    level,
    isThrowingRing,
    isGameOver,
    rings,
    scoredColors,
    showScore,
    drawCone,
    drawRing,
    drawConfettiPiece,
    targetPosition,
    handleApplicationClick,
    confetti,
    restartGame,
  };
}

export { useRingTossGame };
