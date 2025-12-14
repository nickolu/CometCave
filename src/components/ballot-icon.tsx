export function BallotIcon() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" fill="#1E2A4A" />

      {/* Ballot Box */}
      <rect x="60" y="90" width="80" height="60" rx="4" fill="#3D4A66" />
      <rect x="65" y="95" width="70" height="50" rx="2" fill="#2A3A5A" />

      {/* Ballot Box Slot */}
      <rect x="75" y="85" width="50" height="4" rx="2" fill="#1A2440" />

      {/* Ballot Paper being inserted */}
      <rect x="85" y="70" width="30" height="20" rx="1" fill="#F5F2E3" />

      {/* Checkmarks on ballot */}
      <path
        d="M90 76L93 79L98 74"
        stroke="#3D4A66"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M90 82L93 85L98 80"
        stroke="#3D4A66"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Glow effects */}
      <circle cx="100" cy="120" r="15" fill="#F5F2E3" opacity="0.1" />
      <circle cx="100" cy="120" r="25" fill="#F5F2E3" opacity="0.05" />
    </svg>
  )
}
