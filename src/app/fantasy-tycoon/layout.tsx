import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export default function FantasyTycoonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col items-center justify-center py-8 bg-gradient-to-b from-gray-900 to-indigo-900 text-white`}>
      <div className="w-full max-w-lg shadow-2xl p-8 border border-[var(--border)] bg-white/10 backdrop-blur-lg rounded-2xl">
        <h1 className="text-4xl font-bold mb-6 text-center font-geist-sans bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Fantasy Tycoon</h1>
        {children}
      </div>
    </main>
  );
}
