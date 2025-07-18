'use client';

import { Application } from '@pixi/react';
import { Graphics } from 'pixi.js';
import { useRingTossGame } from './useRingTossGame';

const RingTossGame = () => {
  const {
    score,
    highScore,
    lives,
    level,
    showScore,
    drawCone,
    drawRing,
    drawConfettiPiece,
    rings,
    confetti,
    targetPosition,
    isGameOver,
    restartGame,
    handleApplicationClick,
  } = useRingTossGame();

  return (
    <>
      {/* Scoreboard */}
      <div className="flex flex-wrap gap-4 justify-center md:justify-start mb-4 text-blue-300">
        <div className="text-2xl">
          Score: {score}
          {showScore && <span className="ml-2 text-green-500 animate-bounce">+1!</span>}
        </div>
        <div className="text-2xl">High&nbsp;Score: {highScore}</div>
        <div className="text-2xl">Level: {level}</div>
        <div className="text-2xl">
          Lives:{' '}
          {Array.from({ length: lives }).map((_, idx) => (
            <span key={idx} className="text-red-500 ml-1">
              ❤️
            </span>
          ))}
        </div>
      </div>
      <div className="relative bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-2xl">
        <div
          className="rounded-lg cursor-pointer overflow-hidden w-full h-full flex items-center justify-center"
          onClick={handleApplicationClick}
        >
          <Application width={600} height={500} backgroundColor={0x1a1b2e}>
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
                {/* Confetti pieces */}
                {confetti.map(piece => (
                  <pixiGraphics
                    key={piece.id}
                    draw={(g: Graphics) => drawConfettiPiece(g, piece)}
                    x={piece.x}
                    y={piece.y}
                    zIndex={2}
                  />
                ))}
              </pixiContainer>
            </pixiContainer>
          </Application>
        </div>
        <p className="mt-4 text-center text-blue-300/80 text-lg">
          Click anywhere to throw the ring!
        </p>
        {/* Game Over Overlay */}
        {isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-lg rounded-xl text-center text-blue-100">
            <h2 className="text-4xl mb-4">Game Over</h2>
            <p className="text-2xl mb-6">Final Score: {score}</p>
            <button
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
              onClick={restartGame}
            >
              Restart
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default RingTossGame;
