/**
 * Drawn glyphs for the game's fixed sets: regions, weather, town doors and
 * resources. Same stroke and weight as icons.tsx so a placard, a door and a
 * stamp all read as one printer's set. Generated things (an NPC, a landmark
 * from a template, a mount) keep the glyph their data carries, as text.
 */
import * as React from 'react'

type GlyphProps = React.SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 14, children, ...rest }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className="inline-block shrink-0 align-[-2px]"
      {...rest}
    >
      {children}
    </svg>
  )
}

const REGION: Record<string, React.ReactNode> = {
  green_meadows: <><path d="M3 18c3-4 6-4 9 0s6 4 9 0" /><path d="M12 14V7" /><path d="M9 9c1-2 5-2 6 0" /></>,
  dark_forest: <><path d="M12 3l5 8h-3l4 6H6l4-6H7z" /><path d="M12 17v4" /></>,
  crystal_caves: <><path d="M8 20l-4-7 5-9 4 5 3-3 4 7-3 7z" /><path d="M9 4l3 16" /></>,
  scorched_wastes: <><path d="M3 17c4-3 7-3 9 0s5 3 9 0" /><circle cx="17" cy="7" r="3" /></>,
  frozen_peaks: <><path d="M3 20l6-11 4 6 2-3 6 8z" /><path d="M9 9l2 3" /></>,
  shadow_realm: <><path d="M4 20c0-8 4-12 8-12s8 4 8 12" /><path d="M9 14h.01M15 14h.01" /></>,
  sky_citadel: <><path d="M5 17a4 4 0 0 1 1-8 5 5 0 0 1 10 0 4 4 0 0 1 1 8z" /><path d="M12 9V4l2 1" /></>,
  abyssal_depths: <><path d="M4 7c3 0 3 3 6 3s3-3 6-3 3 3 4 3" /><path d="M4 13c3 0 3 3 6 3s3-3 6-3 3 3 4 3" /><path d="M4 19h16" /></>,
  celestial_throne: <><path d="M6 20V8l6-4 6 4v12" /><path d="M9 20v-5h6v5" /><path d="M12 2v2" /></>,
  sunken_ruins: <><path d="M4 20h16" /><path d="M7 20V10M12 20V7M17 20V11" /><path d="M5 10h4M10 7h4M15 11h4" /></>,
  volcanic_forge: <><path d="M3 20l7-13 2 4 2-4 7 13z" /><path d="M10 7l2-4 2 4" /></>,
}

const WEATHER: Record<string, React.ReactNode> = {
  clear: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></>,
  rain: <><path d="M6 14a4 4 0 0 1 1-8 5 5 0 0 1 10 0 4 4 0 0 1 1 8" /><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" /></>,
  storm: <><path d="M6 13a4 4 0 0 1 1-8 5 5 0 0 1 10 0 4 4 0 0 1 1 8" /><path d="M13 12l-3 5h4l-3 5" /></>,
  fog: <><path d="M4 9h14M3 13h18M5 17h14" /></>,
  blizzard: <><path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18" /></>,
  sandstorm: <><path d="M3 8c3-2 5 2 8 0s5 2 8 0" /><path d="M3 13c3-2 5 2 8 0s5 2 8 0" /><path d="M3 18c3-2 5 2 8 0s5 2 8 0" /></>,
  heat_wave: <><circle cx="12" cy="9" r="4" /><path d="M4 17c3-2 5 2 8 0s5 2 8 0" /><path d="M4 21c3-2 5 2 8 0s5 2 8 0" /></>,
}

const DOOR: Record<string, React.ReactNode> = {
  'visit-shop': <><path d="M4 10l2-5h12l2 5" /><path d="M4 10h16v10H4z" /><path d="M10 20v-6h4v6" /></>,
  'rest-at-inn': <><path d="M4 18V8l8-4 8 4v10" /><path d="M4 18h16" /><path d="M9 18v-5h6v5" /><path d="M12 7v3" /></>,
  'hire-transport': <><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /><path d="M5 17V9h11l3 5v3" /><path d="M16 9v5h3" /></>,
  'visit-stable': <><path d="M4 20v-8l8-7 8 7v8" /><path d="M9 20v-5h6v5" /><path d="M4 12h16" /></>,
  'check-mailbox': <><path d="M3 7h18v12H3z" /><path d="M3 7l9 7 9-7" /></>,
  'visit-notice-board': <><path d="M5 4h14v12H5z" /><path d="M8 8h8M8 12h5" /><path d="M12 16v4M9 20h6" /></>,
  'visit-blacksmith': <><path d="M4 20l7-7" /><path d="M9 11l4 4" /><path d="M11 5l8 8-3 3-8-8z" /></>,
  'visit-waypoints': <><path d="M12 21s-6-5-6-11a6 6 0 0 1 12 0c0 6-6 11-6 11z" /><circle cx="12" cy="10" r="2" /></>,
  'leave-town': <><path d="M5 4h8v16H5z" /><path d="M13 12h7" /><path d="M17 9l3 3-3 3" /></>,
  'visit-stable-alt': null,
}

const RESOURCE: Record<string, React.ReactNode> = {
  gold: <><circle cx="12" cy="12" r="8" /><path d="M12 7v10M9.5 9.5h3.5a2 2 0 0 1 0 4h-3a2 2 0 0 0 0 4h4" /></>,
  reputation: <><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" /></>,
  item: <><path d="M4 8h16v12H4z" /><path d="M4 8l2-4h12l2 4" /><path d="M12 8v12" /></>,
  mount: <><path d="M4 18v-6l4-4h6l4-3v5l-2 2v6" /><path d="M8 18v-4M14 18v-4" /></>,
  mercenary: <><path d="M4 20l6-6" /><path d="M8 12l4 4" /><path d="M10 10l9-7v5l-7 7z" /></>,
  place: <><path d="M12 21s-6-5-6-11a6 6 0 0 1 12 0c0 6-6 11-6 11z" /><circle cx="12" cy="10" r="2" /></>,
  legendary: <><path d="M12 2l2 6 6 .5-4.5 4 1.5 6-5-3.5L7 18.5l1.5-6L4 8.5 10 8z" /></>,
}

export function RegionGlyph({ id, ...rest }: GlyphProps & { id: string }) {
  return <Svg {...rest}>{REGION[id] ?? RESOURCE.place}</Svg>
}
export function WeatherGlyph({ id, ...rest }: GlyphProps & { id: string }) {
  return <Svg {...rest}>{WEATHER[id] ?? WEATHER.clear}</Svg>
}
export function DoorGlyph({ id, ...rest }: GlyphProps & { id: string }) {
  return <Svg {...rest}>{DOOR[id] ?? RESOURCE.place}</Svg>
}
export function ResourceGlyph({ kind, ...rest }: GlyphProps & { kind: keyof typeof RESOURCE }) {
  return <Svg {...rest}>{RESOURCE[kind]}</Svg>
}
