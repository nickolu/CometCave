'use client';

import { GamePageTemplate } from './components/page-templates/GamePageTemplate';

export default function Home() {
  return (
    <GamePageTemplate title="CometCave">
      <div className="text-center mb-16">
        <p className="text-xl text-gray-300 italic">
          Like a comet... in a cave!
        </p>
      </div>
        
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-2xl">
        <h2 className="text-3xl font-semibold mb-6 text-center text-blue-300">
          Games
        </h2>
        <ul className="space-y-4">
          <li className="transition-all hover:translate-x-2">
            <a 
              href="/ring-toss"
              className="block p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
            >
              <h3 className="text-xl font-medium text-blue-300 mb-2">Ring Toss</h3>
              <p className="text-gray-300">Test your aim in this classic carnival game!</p>
            </a>
          </li>
          <li className="transition-all hover:translate-x-2">
            <a 
              href="/chat-room-of-infinity"
              className="block p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
            >
              <h3 className="text-xl font-medium text-blue-300 mb-2">Chat Room of Infinity</h3>
              <p className="text-gray-300">Chat with fictional characters in a chat room!</p>
            </a>
          </li>
        </ul>
      </div>
    </GamePageTemplate>
  );
}
