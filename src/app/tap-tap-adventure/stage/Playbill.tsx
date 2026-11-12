'use client'

/**
 * Paper primitives for the Paper Stage.
 *
 * Everything that carries text in Tap Tap Adventure is printed on playbill
 * cream; numbers sit on brass; drawers hang as ticket stubs. These are the
 * only shapes a panel inside the theatre should be built from. Colour comes
 * from the `.paper-stage` tokens in globals.css (`ps-*` Tailwind classes);
 * Comet Mint is reserved for the WALK bar and never appears here.
 */
import * as React from 'react'

import { cn } from '@/lib/utils'

/* ── Sheets ─────────────────────────────────────────────────────────── */

export function PlaybillSheet({
  className,
  children,
  flat = false,
  as: Tag = 'div',
  ...rest
}: React.HTMLAttributes<HTMLElement> & { flat?: boolean; as?: 'div' | 'section' | 'article' | 'aside' }) {
  return (
    <Tag
      className={cn(
        flat ? 'ps-paper-flat' : 'ps-paper',
        'relative rounded-[3px] border-2 border-ps-ink',
        'before:pointer-events-none before:absolute before:inset-[5px] before:rounded-[2px] before:border before:border-ps-ink/60 before:content-[""]',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** A heading set in the playbill's wood type, ruled above and below. */
export function PlaybillTitle({
  className,
  children,
  size = 'md',
  rules = true,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement> & { size?: 'sm' | 'md' | 'lg'; rules?: boolean }) {
  const sizes = { sm: 'text-sm tracking-widest', md: 'text-lg tracking-widest', lg: 'text-2xl sm:text-3xl tracking-wide' }
  return (
    <h2
      className={cn(
        'font-playbill font-normal uppercase text-ps-ink text-center leading-tight text-balance',
        sizes[size],
        rules && 'border-y-2 border-ps-ink py-1.5 px-3',
        className
      )}
      {...rest}
    >
      {children}
    </h2>
  )
}

/** Small caption line on paper: "DAY 3 · 212 KM · PEBBLE FORD". */
export function PlaybillCaption({ className, children, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft', className)}
      {...rest}
    >
      {children}
    </p>
  )
}

/* ── Lines (the choices printed on a bill) ──────────────────────────── */

export interface PlaybillLineProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Printed numeral at the left; keyboard 1–4 picks it. */
  index?: number
  tone?: 'ink' | 'danger' | 'quiet'
  /** Secondary text under the line. */
  note?: React.ReactNode
  /** Stamps or tags at the right. */
  trailing?: React.ReactNode
}

export const PlaybillLine = React.forwardRef<HTMLButtonElement, PlaybillLineProps>(
  ({ className, index, tone = 'ink', note, trailing, children, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'group flex w-full items-start gap-3 rounded-[3px] border-2 px-3 py-2.5 text-left',
        'font-body text-base leading-snug transition-colors duration-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'ink' && 'border-ps-ink text-ps-ink hover:bg-ps-ink hover:text-ps-playbill',
        tone === 'danger' && 'border-ps-stamp-red text-ps-stamp-red hover:bg-ps-stamp-red hover:text-ps-playbill',
        tone === 'quiet' && 'border-ps-ink/40 text-ps-ink-soft hover:border-ps-ink hover:text-ps-ink',
        className
      )}
      {...rest}
    >
      {index != null && (
        <span
          aria-hidden
          className="mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-current font-playbill text-xs leading-none"
        >
          {index}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block">{children}</span>
        {note && <span className="mt-1 block text-xs opacity-80">{note}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-1">{trailing}</span>}
    </button>
  )
)
PlaybillLine.displayName = 'PlaybillLine'

/* ── Buttons that live on paper (never the press colour) ────────────── */

export interface PaperButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ink' | 'outline' | 'danger' | 'brass'
  size?: 'sm' | 'md'
}

export const PaperButton = React.forwardRef<HTMLButtonElement, PaperButtonProps>(
  ({ className, variant = 'ink', size = 'md', ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-[3px] border-2 font-label font-bold uppercase tracking-widest',
        'transition-[transform,background-color,color] duration-100 active:translate-y-[2px] motion-reduce:active:translate-y-0',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-xs',
        variant === 'ink' && 'border-ps-ink bg-ps-ink text-ps-playbill hover:bg-ps-ink-soft hover:border-ps-ink-soft',
        variant === 'outline' && 'border-ps-ink bg-transparent text-ps-ink hover:bg-ps-ink hover:text-ps-playbill',
        variant === 'danger' && 'border-ps-stamp-red bg-transparent text-ps-stamp-red hover:bg-ps-stamp-red hover:text-ps-playbill',
        variant === 'brass' && 'border-ps-brass-deep bg-ps-brass text-ps-ink hover:bg-ps-brass-light',
        className
      )}
      {...rest}
    />
  )
)
PaperButton.displayName = 'PaperButton'

/* ── Stamps (the printer's one colour ink) ──────────────────────────── */

export type StampTone = 'red' | 'green' | 'blue' | 'violet' | 'gold' | 'ink'

const STAMP_TONE: Record<StampTone, string> = {
  red: 'border-ps-stamp-red text-ps-stamp-red',
  green: 'border-ps-stamp-green text-ps-stamp-green',
  blue: 'border-ps-stamp-blue text-ps-stamp-blue',
  violet: 'border-ps-stamp-violet text-ps-stamp-violet',
  gold: 'border-ps-stamp-gold text-ps-stamp-gold',
  ink: 'border-ps-ink text-ps-ink',
}

export function Stamp({
  tone = 'ink',
  animate = false,
  tilt = true,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: StampTone; animate?: boolean; tilt?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[2px] border-2 px-1.5 py-0.5 font-label text-xs font-bold uppercase leading-none tracking-widest',
        'bg-transparent mix-blend-multiply',
        tilt && '-rotate-3',
        animate && 'ps-stamp',
        STAMP_TONE[tone],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  )
}

/** Pick a stamp colour for a signed number. */
export function deltaTone(value: number): StampTone {
  return value > 0 ? 'green' : value < 0 ? 'red' : 'ink'
}

/* ── Brass ──────────────────────────────────────────────────────────── */

export function BrassPlate({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[4px] border-2 border-ps-brass-deep bg-ps-brass text-ps-ink',
        'shadow-[inset_0_2px_0_0_var(--ps-brass-light),inset_0_-2px_0_0_var(--ps-brass-deep)]',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/** An engraved figure on brass: big number, small label. */
export function BrassFigure({
  label,
  value,
  sub,
  bar,
  barTone = 'ink',
  className,
  title,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  /** 0..1 fill under the figure. */
  bar?: number
  barTone?: 'ink' | 'red' | 'green'
  className?: string
  title?: string
}) {
  const barColor = barTone === 'red' ? 'bg-ps-stamp-red' : barTone === 'green' ? 'bg-ps-stamp-green' : 'bg-ps-ink'
  return (
    <div className={cn('flex min-w-0 flex-col items-center px-2 py-1 text-center md:py-1.5', className)} title={title}>
      <span className="font-playbill text-base leading-none tabular-nums md:text-2xl">{value}</span>
      <span className="mt-1 font-label text-xs font-bold uppercase leading-none tracking-widest text-ps-ink/80">
        {label}
      </span>
      {sub && <span className="mt-0.5 hidden font-body text-xs leading-none text-ps-ink/80 md:block">{sub}</span>}
      {bar != null && (
        <span
          className="mt-1.5 block h-1.5 w-full max-w-[72px] overflow-hidden rounded-full bg-ps-brass-deep/60"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.max(0, Math.min(1, bar)) * 100)}
          aria-label={label}
        >
          <span
            className={cn('block h-full rounded-full transition-[width] duration-300', barColor)}
            style={{ width: `${Math.max(0, Math.min(1, bar)) * 100}%` }}
          />
        </span>
      )}
    </div>
  )
}

/* ── Placards (chips on the house's dark band) ──────────────────────── */

export function Placard({
  tone = 'brass',
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'brass' | 'paper' | 'danger' }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-[3px] border px-2 font-label text-xs font-bold uppercase tracking-widest',
        tone === 'brass' && 'border-ps-brass-deep bg-ps-brass/15 text-ps-brass-light',
        tone === 'paper' && 'border-ps-playbill-edge bg-ps-playbill text-ps-ink',
        tone === 'danger' && 'border-ps-stamp-red bg-ps-stamp-red/20 text-ps-playbill',
        className
      )}
      {...rest}
    >
      {children}
    </span>
  )
}

/* ── Ticket stubs (drawer tabs) ─────────────────────────────────────── */

export interface TicketStubProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  badge?: React.ReactNode
  orientation?: 'vertical' | 'horizontal'
  icon?: React.ReactNode
}

export const TicketStub = React.forwardRef<HTMLButtonElement, TicketStubProps>(
  ({ className, active, badge, orientation = 'vertical', icon, children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'relative flex items-center justify-center gap-2 font-playbill uppercase leading-none transition-[transform,background-color] duration-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary',
        'disabled:cursor-not-allowed disabled:opacity-40',
        orientation === 'vertical'
          ? 'h-12 w-full rounded-[3px] border-2 border-l-[6px] px-3 text-sm tracking-widest'
          : 'h-full min-w-0 flex-1 flex-col gap-1 rounded-[3px] border-2 border-t-[4px] px-1 py-0.5 text-xs tracking-wide',
        active
          ? 'ps-paper-flat border-ps-ink text-ps-ink'
          : 'border-ps-brass-deep bg-ps-lacquer-ink/60 text-ps-brass-light hover:bg-ps-lacquer-deep',
        !active && !disabled && 'hover:-translate-y-[1px] motion-reduce:hover:translate-y-0',
        className
      )}
      {...rest}
    >
      {icon && <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
      <span className="truncate">{children}</span>
      {badge != null && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-ps-playbill bg-ps-stamp-red px-1 font-label text-xs font-bold text-ps-playbill">
          {badge}
        </span>
      )}
    </button>
  )
)
TicketStub.displayName = 'TicketStub'

/* ── A dotted rule between playbill sections ────────────────────────── */

export function PlaybillRule({ className }: { className?: string }) {
  return <hr className={cn('my-3 border-0 border-t-2 border-dotted border-ps-ink/50', className)} />
}

/** A tiny loader: a spinning type ornament rather than a UI spinner. */
export function PrintingDots({ label = 'Printing' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft" role="status">
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-ps-ink border-r-transparent motion-reduce:animate-none" aria-hidden />
      {label}…
    </span>
  )
}
