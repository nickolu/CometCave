export default function TapTapAdventureLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Mobile: fullscreen overlay that covers everything */}
      <div className="md:hidden fixed inset-0 z-[100] bg-space-black overflow-y-auto">
        <div className="min-h-full px-4 pt-4 pb-8">
          {children}
        </div>
      </div>
      {/* Desktop: normal layout */}
      <div className="hidden md:block w-full min-h-[700px] shadow-2xl">
        {children}
      </div>
    </>
  )
}
