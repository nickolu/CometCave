export default function TapTapAdventureLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full md:min-h-[700px] md:shadow-2xl fixed md:relative inset-0 md:inset-auto z-40 md:z-auto bg-space-black md:bg-transparent overflow-y-auto">
      {children}
    </div>
  )
}
