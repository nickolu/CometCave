/**
 * The theatre's small icon set: one stroke, one weight, drawn here so the
 * chrome never leans on emoji. Game data (NPC glyphs, landmark glyphs) keeps
 * its own glyphs; these are for controls only.
 */
import * as React from 'react'

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 16, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...rest,
  }
}

export const SoundOnIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 10v4h4l5 4V6L8 10H4z" /><path d="M16 9a4 4 0 0 1 0 6" /><path d="M18.5 6.5a8 8 0 0 1 0 11" /></svg>
)
export const SoundOffIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 10v4h4l5 4V6L8 10H4z" /><path d="M16 9l5 6M21 9l-5 6" /></svg>
)
export const HelpIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7" /><path d="M12 17h.01" /></svg>
)
export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const PackIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
)
export const GearIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 20l5-5" /><path d="M14 4l6 6-8 8-6-6z" /><path d="M16 2l2 2M20 6l2 2" /></svg>
)
export const QuestIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M7 3h10v18l-5-3-5 3V3z" /></svg>
)
export const MapIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" /><path d="M9 4v14M15 6v14" /></svg>
)
export const PartyIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M14 20a4.5 4.5 0 0 1 7 0" /></svg>
)
export const TownIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 21h18" /><path d="M5 21V11l7-6 7 6v10" /><path d="M10 21v-6h4v6" /></svg>
)
export const CharactersIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="3" width="16" height="18" rx="1" /><circle cx="12" cy="10" r="3" /><path d="M7 19a5 5 0 0 1 10 0" /></svg>
)
export const StageIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 5h18v3H3z" /><path d="M5 8v12h14V8" /><path d="M9 20V12M15 20V12" /></svg>
)
export const CaveIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 21V11a9 9 0 0 1 18 0v10" /><path d="M8 21v-5a4 4 0 0 1 8 0v5" /><path d="M3 21h18" /></svg>
)
export const ChevronIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>
)
export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
)
