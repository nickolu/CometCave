'use client'

/**
 * The theatre: the fixed frame around the stage.
 *
 *   top band      identity · placards · controls
 *   the house     [left wing: story log] [proscenium: scenery + actors + apron] [right wing: drawer stubs]
 *   footlights    WALK bar · brass plate
 *
 * The frame never moves; only what is on the stage changes. Drawers open as
 * a sheet over the house (right side on desktop, bottom on phones) so the
 * stage never reflows. The cave's shell above owns exit; there is no second
 * "back" here.
 */
import Link from 'next/link'
import * as React from 'react'

import type { WeatherId } from '@/app/tap-tap-adventure/config/weather'
import { useDialogFocus } from '@/app/tap-tap-adventure/lib/useDialogFocus'
import { cn } from '@/lib/utils'


import { CaveIcon, CloseIcon } from './icons'
import { TicketStub } from './Playbill'
import { Scenery } from './Scenery'

import type { TimeOfDay } from './time'

export interface DrawerTab {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  disabled?: boolean
  title?: string
}

export interface TheatreProps {
  regionId: string
  timeOfDay: TimeOfDay
  weather: WeatherId
  sceneKey?: string | number
  stepKey?: number
  /** Top band. */
  identity: React.ReactNode
  placards?: React.ReactNode
  controls?: React.ReactNode
  /** Left wing (desktop) / below the footlights (phones). */
  log?: React.ReactNode
  /** Actors over the scenery. */
  actors?: React.ReactNode
  /** The apron: the playbill strip, or combat, shop, town. */
  apron: React.ReactNode
  /** Footlights row. */
  footlights?: React.ReactNode
  plate?: React.ReactNode
  /** Drawers. */
  tabs: DrawerTab[]
  activeTab: string | null
  onTab: (id: string) => void
  sheetTitle?: string
  sheet?: React.ReactNode
  onCloseSheet: () => void
  /** Hide the stage view (scenery + actors) and give the apron the whole proscenium. */
  curtain?: boolean
}

/** The way out. Every game owns its window, so this is the cave's door (interaction model 2). */
export function CaveExit() {
  return (
    <Link
      href="/"
      aria-label="Return to the cave"
      title="Return to the cave"
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-[3px] border-2 border-ps-brass-deep px-2 font-label text-xs font-bold uppercase tracking-widest text-ps-brass-light transition-colors hover:bg-ps-lacquer-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
    >
      <CaveIcon />
      <span className="hidden sm:inline">Cave</span>
    </Link>
  )
}

export function TopBand({
  identity,
  placards,
  controls,
}: {
  identity: React.ReactNode
  placards?: React.ReactNode
  controls?: React.ReactNode
}) {
  return (
    <div role="banner" className="flex min-h-[56px] shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b-4 border-ps-brass-deep bg-ps-lacquer-ink px-3 py-2 sm:px-4">
      <CaveExit />
      <div className="flex min-w-0 shrink-0 items-center gap-3">{identity}</div>
      {controls && <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:order-last">{controls}</div>}
      {placards && <div className="flex min-w-0 basis-full flex-wrap items-center gap-1.5 sm:flex-1 sm:basis-auto">{placards}</div>}
    </div>
  )
}

export function Theatre({
  regionId,
  timeOfDay,
  weather,
  sceneKey,
  stepKey,
  identity,
  placards,
  controls,
  log,
  actors,
  apron,
  footlights,
  plate,
  tabs,
  activeTab,
  onTab,
  sheetTitle,
  sheet,
  onCloseSheet,
  curtain = false,
}: TheatreProps) {
  return (
    <div
      data-region={regionId}
      data-time={timeOfDay}
      className="relative flex h-[100dvh] w-full flex-col overflow-clip bg-ps-house text-on-surface"
    >
      <TopBand identity={identity} placards={placards} controls={controls} />

      {/* the house */}
      <div
        className={cn(
          'grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-0',
          sheet && activeTab
            ? 'md:grid-cols-[220px_minmax(0,1fr)_440px] lg:grid-cols-[260px_minmax(0,1fr)_480px]'
            : 'md:grid-cols-[220px_minmax(0,1fr)_200px] lg:grid-cols-[260px_minmax(0,1fr)_210px]'
        )}
      >
        <aside className="hidden min-h-0 flex-col overflow-hidden border-r-4 border-ps-brass-deep bg-ps-lacquer-ink/70 p-3 md:flex" aria-label="Story so far">
          {log}
        </aside>

        {/* the proscenium */}
        <section
          className="relative flex min-h-0 flex-col border-x-[10px] border-ps-lacquer bg-ps-cobalt-deep sm:border-x-[14px]"
          aria-label="The stage"
        >
          {/* brass inner trim */}
          <div className="pointer-events-none absolute inset-0 z-20 border-[5px] border-ps-brass" aria-hidden />
          {/* the pelmet */}
          <div className="relative z-10 h-6 border-b-4 border-ps-brass bg-ps-lacquer sm:h-8" aria-hidden>
            <div className="absolute inset-x-0 top-0 h-full bg-[repeating-linear-gradient(90deg,transparent_0_18px,rgba(0,0,0,0.18)_18px_36px)]" />
          </div>

          {!curtain && (
            <div className="relative min-h-[150px] flex-1 overflow-hidden">
              <Scenery
                regionId={regionId}
                timeOfDay={timeOfDay}
                weather={weather}
                changeKey={sceneKey}
                stepKey={stepKey}
                className="absolute inset-0 h-full w-full"
              />
              <div className="absolute inset-x-0 bottom-[6px] z-10 flex items-end justify-center gap-6 px-6 sm:gap-10">{actors}</div>
            </div>
          )}

          {/* the apron: a stage floor the playbill lies on */}
          <div
            className={cn(
              'ps-scroll relative z-10 max-h-[70%] shrink-0 overflow-y-auto bg-ps-lacquer-ink p-3 sm:p-4 md:max-h-[64%]',
              'bg-[repeating-linear-gradient(90deg,transparent_0_46px,rgba(0,0,0,0.22)_46px_48px)]',
              curtain && 'pt-6'
            )}
          >
            {apron}
            {/* phones: the story so far folds under the bill */}
            {log && <div className="mt-4 md:hidden">{log}</div>}
          </div>
        </section>

        <aside className="hidden min-h-0 flex-col overflow-hidden border-l-4 border-ps-brass-deep bg-ps-lacquer-ink/70 md:flex" aria-label="Drawers">
          <div className={cn('flex gap-2 p-3', sheet && activeTab ? 'flex-row flex-wrap' : 'flex-col')}>
            {tabs.map(t => (
              <TicketStub
                key={t.id}
                active={activeTab === t.id}
                onClick={() => onTab(t.id)}
                badge={t.badge}
                disabled={t.disabled}
                title={t.title}
                icon={t.icon}
                aria-expanded={activeTab === t.id}
                orientation={sheet && activeTab ? 'horizontal' : 'vertical'}
                className={sheet && activeTab ? 'h-11 min-w-[64px] flex-1' : undefined}
              >
                {t.label}
              </TicketStub>
            ))}
          </div>
          {sheet && activeTab && (
            <DockedDrawer title={sheetTitle ?? tabs.find(t => t.id === activeTab)?.label ?? ''} onClose={onCloseSheet}>
              {sheet}
            </DockedDrawer>
          )}
        </aside>
      </div>

      {/* footlights */}
      {(footlights || plate) && (
        <div className="hidden shrink-0 grid-cols-[minmax(0,1fr)_minmax(320px,420px)] items-stretch gap-3 border-t-4 border-ps-brass-deep bg-ps-lacquer-ink p-3 sm:p-4 md:grid">
          <div>{footlights}</div>
          {plate}
        </div>
      )}

      {/* phones: plate, footlights and ticket stubs at the foot of the window */}
      <div className="relative z-30 shrink-0 border-t-4 border-ps-brass-deep bg-ps-lacquer-ink md:hidden">
        {plate && <div className="px-2 pt-2">{plate}</div>}
        {footlights && <div className="px-2 pt-2">{footlights}</div>}
        <nav className="flex h-[54px] gap-1 px-1.5 py-1" aria-label="Drawers">
        {tabs.map(t => (
          <TicketStub
            key={t.id}
            orientation="horizontal"
            active={activeTab === t.id}
            onClick={() => onTab(t.id)}
            badge={t.badge}
            disabled={t.disabled}
            title={t.title}
            icon={t.icon}
            aria-expanded={activeTab === t.id}
          >
            {t.label}
          </TicketStub>
        ))}
        </nav>
      </div>

      {sheet && activeTab && (
        <div className="md:hidden">
          <DrawerSheet title={sheetTitle ?? tabs.find(t => t.id === activeTab)?.label ?? ''} onClose={onCloseSheet}>
            {sheet}
          </DrawerSheet>
        </div>
      )}
    </div>
  )
}

/** Desktop: the drawer docked in the wing, beside the stage. */
export function DockedDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  useDialogFocus(ref)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div ref={ref} role="region" aria-label={title} tabIndex={-1} className="ps-paper-flat ps-print-in mx-3 mb-3 flex min-h-0 flex-1 flex-col rounded-[3px] border-2 border-ps-ink text-ps-ink">
      <div className="flex items-center justify-between gap-3 border-b-2 border-ps-ink px-4 py-2.5">
        <h2 className="font-playbill text-lg uppercase tracking-widest">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ps-ink text-ps-ink transition-colors hover:bg-ps-ink hover:text-ps-playbill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
          aria-label="Close drawer"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="ps-scroll min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  )
}

/** Phones: the drawer rises as a sheet over the stage. */
export function DrawerSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  useDialogFocus(ref)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="absolute inset-x-0 bottom-[calc(54px+64px+58px)] top-0 z-20">
      <button type="button" className="absolute inset-0 cursor-default bg-ps-house/55" aria-label="Close drawer" onClick={onClose} tabIndex={-1} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="ps-paper-flat ps-print-in absolute inset-x-0 bottom-0 flex max-h-[88%] flex-col rounded-t-[6px] border-x-2 border-t-2 border-ps-ink text-ps-ink"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-ps-ink px-4 py-2.5">
          <h2 className="font-playbill text-lg uppercase tracking-widest">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ps-ink text-ps-ink transition-colors hover:bg-ps-ink hover:text-ps-playbill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
            aria-label="Close drawer"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="ps-scroll min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
