'use client';

import { useState } from 'react';
import { Application, extend } from '@pixi/react';
import { Graphics, Container } from 'pixi.js';
import Navigation from '../components/navigation';

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

const RingTossGame = () => {
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
  
  const drawRing = (g: Graphics, color: number, fillColor: number) => {
    g.clear();
    g.lineStyle(8, color);
    g.beginFill(fillColor);
    g.drawCircle(0, 0, RING_RADIUS);
    g.endFill();
  };

  const drawCone = (g: Graphics) => {
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
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-indigo-900 text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Navigation />
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Ring Toss
          </h1>
          <div className="text-2xl text-blue-300 mb-4">
            Score: {score}
            {showScore && <span className="ml-2 text-green-500 animate-bounce">+1!</span>}
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl">
          <div
            className="rounded-lg cursor-pointer overflow-hidden w-full h-full flex items-center justify-center"
            onClick={(e: React.MouseEvent<HTMLDivElement>) => {
              const bounds = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - bounds.left;
              const y = e.clientY - bounds.top;
              throwRing({ global: { x, y } });
            }}
          >
            <Application
              width={600}
              height={500}
              backgroundColor={0x1a1b2e}
            >
              <pixiContainer>
                <pixiContainer sortableChildren={true}>
                  <pixiGraphics
                    draw={drawCone}
                    x={targetPosition.x}
                    y={targetPosition.y}
                    zIndex={1}
                  />
                  {rings.map(ring => (
                    <pixiGraphics
                      key={ring.id}
                      draw={(g: Graphics) => drawRing(g, ring.color, 0x1a1b2e)}
                      x={ring.x}
                      y={ring.y}
                      rotation={ring.rotation}
                      zIndex={0}
                    />
                  ))}
                </pixiContainer>
              </pixiContainer>
            </Application>
          </div>
          <p className="mt-4 text-center text-blue-300/80 text-lg">
            Click anywhere to throw the ring!
          </p>
        </div>
      </div>
    </div>
  );
};

export default RingTossGame;
