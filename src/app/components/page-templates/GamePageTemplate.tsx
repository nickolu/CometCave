'use client';

import { Navigation } from "@/app/components/navigation";

const GamePageTemplate = ({ title, children }: { title: string; children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-indigo-900 text-white sm:px-6">
        <div className="max-w-4xl mx-auto">
            <Navigation />
            <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                {title}
            </h1>
            {children}
        </div>
    </div>
  );
};

export { GamePageTemplate };

    