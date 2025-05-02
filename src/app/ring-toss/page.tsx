'use client';

import { Application } from '@pixi/react';
import { Graphics } from 'pixi.js';
import { useRingTossGame } from './useRingTossGame';

const RingTossGame = () => {
  const { score, showScore, drawCone, drawRing, rings, targetPosition, handleApplicationClick } = useRingTossGame();

  return (
    <>
      <div className="text-2xl text-blue-300 mb-4">
        Score: {score}
        {showScore && <span className="ml-2 text-green-500 animate-bounce">+1!</span>}
      </div>
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl">
        <div
            className="rounded-lg cursor-pointer overflow-hidden w-full h-full flex items-center justify-center"
            onClick={handleApplicationClick}
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
    </> 
  );
};

export default RingTossGame;
