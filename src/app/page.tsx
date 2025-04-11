
export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-indigo-900 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            CometCave
          </h1>
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
                className="block p-4 rounded-lg bg-white/5 hover:bg-white/20 transition-all
                         flex items-center justify-between group"
              >
                <span className="text-xl font-medium">Ring Toss</span>
                <span className="text-blue-400 group-hover:translate-x-2 transition-transform">
                  →
                </span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
