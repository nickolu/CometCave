'use client';

import { useState, useCallback } from 'react';
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

extend({
  Graphics,
  Container,
});

function useRingTossGame() {
    const [score, setScore] = useState(0);
    const [isThrowingRing, setIsThrowingRing] = useState(false);
    const [rings, setRings] = useState<Ring[]>([
      { id: 1, x: 100, y: 400, rotation: 0, isActive: true, color: 0xff0000 }
    ]);
    const [scoredColors, setScoredColors] = useState<number[]>([]);
    const [showScore, setShowScore] = useState(false);
    const targetPosition = { x: 300, y: 250 };
  
    const RING_RADIUS = 25;
    const CONE_HEIGHT = 120;
    const CONE_BASE_WIDTH = 40;
    const CONE_TIP_Y = -CONE_HEIGHT;
    const STRIPE_HEIGHT = 15;
    const POLE_WIDTH = 40;  // Same as cone base center width
    const POLE_HEIGHT = 120;
    
    const drawRing = useCallback((g: Graphics, color: number, fillColor: number) => {
      g.clear();
      g.lineStyle(8, color);
      g.beginFill(fillColor);
      g.drawCircle(0, 0, RING_RADIUS);
      g.endFill();
    }, [RING_RADIUS]);
  
    const drawCone = useCallback((g: Graphics) => {
      g.clear();
      
      // Draw pole
      g.beginFill(0x4a4a4a);
      g.drawRect(-POLE_WIDTH/2, 0, POLE_WIDTH, POLE_HEIGHT);
      g.endFill();
      
      // Calculate stripe positions
      const stripePositions = scoredColors.map((_, i) => 
        CONE_HEIGHT - (i + 1) * STRIPE_HEIGHT
      );
  
      // Draw cone base
      g.lineStyle(0);
      g.beginFill(0x8B4513);
      g.moveTo(-CONE_BASE_WIDTH/2, 0);  // base left
      g.lineTo(CONE_BASE_WIDTH/2, 0);   // base right
      g.lineTo(0, -CONE_HEIGHT);  // tip
      g.lineTo(-CONE_BASE_WIDTH/2, 0);  // back to base left
      g.endFill();
  
      // Draw colored stripes
      scoredColors.forEach((color, i) => {
        const y = stripePositions[i];
        const width = CONE_BASE_WIDTH * (y + CONE_HEIGHT) / CONE_HEIGHT; // Width proportional to height
        g.beginFill(color);
        g.drawRect(-width/2, y, width, STRIPE_HEIGHT);
        g.endFill();
      });
    }, [scoredColors, POLE_WIDTH, POLE_HEIGHT, CONE_HEIGHT, CONE_BASE_WIDTH, STRIPE_HEIGHT]);
  
    const getActiveRing = () => rings.find(r => r.isActive);
  
    const throwRing = (e: { global: { x: number; y: number } }) => {
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
        const distance = Math.sqrt(
          Math.pow(newX - tipX, 2) +
          Math.pow(newY - tipY, 2)
        );
  
        if (distance <= RING_RADIUS) {
          // Ring hit the cone tip
          setIsThrowingRing(false);
          // Add the ring's color to scored colors
          setScoredColors(prev => [...prev, activeRing.color]);
          
          // Create a new ring with a new random color
          const newColor = Math.floor(Math.random() * 0xFFFFFF);
          setRings([
            { 
              id: activeRing.id + 1, 
              x: 100, 
              y: 400, 
              rotation: 0, 
              isActive: true, 
              color: newColor
            }
          ]);
          setScore(prev => prev + 1);
          setShowScore(true);
          setTimeout(() => setShowScore(false), 1000);
          return;
        }
  
        if (t >= 1) {
          // Ring missed the cone
          setIsThrowingRing(false);
          setRings(prevRings => 
            prevRings.map(r => 
              r.id === activeRing.id 
                ? { ...r, x: 100, y: 400, rotation: 0 }
                : r
            )
          );
          return;
        }
  
        // Update ring position
        setRings(prevRings => 
          prevRings.map(r => 
            r.id === activeRing.id 
              ? { ...r, x: newX, y: newY, rotation: t * Math.PI * 4 }
              : r
          )
        );  
  
        requestAnimationFrame(animate);
      };
  
      animate();
    };

  const handleApplicationClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
    throwRing({ global: { x, y } });
  };

  return {
    score,
    isThrowingRing,
    rings,
    scoredColors,
    showScore,
    drawCone,
    drawRing,
    targetPosition,
    handleApplicationClick,
  };
}

export { useRingTossGame };