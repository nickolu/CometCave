import "../globals.css";


export default function FantasyTycoonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full min-h-[700px] shadow-2xl p-8 border border-[var(--border)] bg-white/10 backdrop-blur-lg rounded-2xl">
      {children}
    </div>
  );
}
