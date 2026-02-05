export const HexagramIcon = () => {
  return (
    <svg
      className="w-full h-full"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Hexagram lines - from top to bottom */}
      {/* Line 6 - solid */}
      <rect x="20" y="10" width="60" height="6" rx="3" fill="currentColor" className="text-space-purple" />

      {/* Line 5 - broken */}
      <rect x="20" y="24" width="26" height="6" rx="3" fill="currentColor" className="text-space-purple" />
      <rect x="54" y="24" width="26" height="6" rx="3" fill="currentColor" className="text-space-purple" />

      {/* Line 4 - solid */}
      <rect x="20" y="38" width="60" height="6" rx="3" fill="currentColor" className="text-space-purple" />

      {/* Line 3 - broken */}
      <rect x="20" y="52" width="26" height="6" rx="3" fill="currentColor" className="text-space-purple" />
      <rect x="54" y="52" width="26" height="6" rx="3" fill="currentColor" className="text-space-purple" />

      {/* Line 2 - solid */}
      <rect x="20" y="66" width="60" height="6" rx="3" fill="currentColor" className="text-space-purple" />

      {/* Line 1 - solid */}
      <rect x="20" y="80" width="60" height="6" rx="3" fill="currentColor" className="text-space-purple" />

      {/* Decorative circles on the sides */}
      <circle cx="10" cy="45" r="3" fill="currentColor" className="text-space-purple opacity-50" />
      <circle cx="90" cy="45" r="3" fill="currentColor" className="text-space-purple opacity-50" />
    </svg>
  )
}
