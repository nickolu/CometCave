export function SecretWordIcon() {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background circle */}
      <circle cx="100" cy="100" r="80" fill="#1E2A4A" />

      {/* Lock body */}
      <rect x="70" y="90" width="60" height="55" rx="8" fill="#3D4A66" />

      {/* Lock shackle */}
      <path
        d="M82 90V74C82 60 118 60 118 74V90"
        stroke="#3D4A66"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* Key-hole */}
      <circle cx="100" cy="115" r="8" fill="#F5F2E3" />
      <rect x="97" y="115" width="6" height="12" fill="#F5F2E3" />

      {/* Subtle glow */}
      <circle cx="100" cy="120" r="18" fill="#F5F2E3" opacity="0.1" />
      <circle cx="100" cy="120" r="28" fill="#F5F2E3" opacity="0.05" />
    </svg>
  )
}
