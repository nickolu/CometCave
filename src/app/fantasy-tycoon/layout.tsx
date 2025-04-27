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
    <main className={`${geistSans.variable} ${geistMono.variable} bg-gradient-to-br from-green-50 to-blue-100 min-h-screen flex flex-col items-center py-8`}>
      <div className="w-full max-w-lg bg-white/90 rounded-xl shadow-lg p-6 border border-gray-200">
        <h1 className="text-3xl font-bold mb-4 text-center text-green-700 font-geist-sans">Fantasy Tycoon</h1>
        {children}
      </div>
    </main>
  );
}
