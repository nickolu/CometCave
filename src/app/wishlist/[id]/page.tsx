'use client'

import { useParams } from 'next/navigation'
import { type CSSProperties, type ReactNode, useMemo, useRef, useState } from 'react'

import type { Marks, WishlistItem } from '@/lib/wishlist/store'

import { type SyncState, useWishlist } from './use-wishlist'

type Sort = 'fav' | 'new' | 'low' | 'high'

const SORTS: { value: Sort; label: string }[] = [
  { value: 'fav', label: 'Favorites first' },
  { value: 'new', label: 'Newest in the shop' },
  { value: 'low', label: 'Price, low to high' },
  { value: 'high', label: 'Price, high to low' },
]

/** One accent per shopper, cycling; the shop colors its shoppers the same way. */
const ACCENTS = ['--wl-blue', '--wl-pink', '--wl-green', '--wl-purple', '--wl-amber']

const PREFS_KEY = 'wishlist-prefs-v1'

interface Prefs {
  by: string
  showBought: boolean
  sort: Sort
  tab: Record<string, string>
}

const DEFAULT_PREFS: Prefs = { by: '', showBought: false, sort: 'fav', tab: {} }

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      by: typeof parsed.by === 'string' ? parsed.by.slice(0, 40) : '',
      showBought: parsed.showBought === true,
      sort: SORTS.some(s => s.value === parsed.sort) ? (parsed.sort as Sort) : 'fav',
      tab: typeof parsed.tab === 'object' && parsed.tab ? parsed.tab : {},
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function writePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Private browsing. The preferences are a convenience, not state.
  }
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function dayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** The shop renders store search links as "Find it" and product pages as "Store page". */
function isSearchUrl(url: string): boolean {
  return /\/s\?|search\?/.test(url)
}

function Photo({ item, listId }: { item: WishlistItem; listId: string }) {
  const [broken, setBroken] = useState(false)
  if (item.img && !broken) {
    return (
      <img
        src={`/api/v1/wishlist/${encodeURIComponent(listId)}/image/${item.id}?v=${item.img}`}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <span className="emoji" aria-hidden="true">
      {item.emoji || '🎁'}
    </span>
  )
}

function Card({
  item,
  listId,
  mark,
  accent,
  onBuy,
  onUndo,
}: {
  item: WishlistItem
  listId: string
  mark: Marks[string] | undefined
  accent: string
  onBuy: () => void
  onUndo: () => void
}) {
  const bought = Boolean(mark)
  return (
    <li
      className={`card${bought ? ' bought' : ''}`}
      style={{ '--accent': `var(${accent})` } as CSSProperties}
    >
      <div className="pic">
        <Photo item={item} listId={listId} />
        {item.fav && (
          <span className="favtag" title="A favorite">
            ★ Favorite
          </span>
        )}
        {bought && <span className="boughttag">Bought</span>}
      </div>
      <div className="body">
        <p className="kind">
          {item.kind}
          {item.age ? ` · ${item.age}` : ''}
        </p>
        <h3>{item.name}</h3>
        {item.blurb && <p className="blurb">{item.blurb}</p>}
        {item.note && <p className="note">✎ {item.note}</p>}
        <div className="row">
          <span className="price">{money.format(item.price)}</span>
          <a className="store" href={item.url} target="_blank" rel="noopener noreferrer">
            {isSearchUrl(item.url) ? 'Find it' : 'Store page'} ↗
          </a>
        </div>
        {bought ? (
          <div className="boughtline">
            <span>
              Bought{mark?.by ? ` by ${mark.by}` : ''}
              {mark ? ` · ${dayLabel(mark.at)}` : ''}
            </span>
            <button type="button" className="undo" onClick={onUndo}>
              Undo
            </button>
          </div>
        ) : (
          <button type="button" className="buy" onClick={onBuy}>
            Bought it
          </button>
        )}
      </div>
    </li>
  )
}

function SyncNote({ sync }: { sync: SyncState }) {
  if (sync === 'saving') return <span className="sync saving">Saving…</span>
  if (sync === 'failed') return <span className="sync failed">Couldn’t save that. Try again.</span>
  return null
}

export default function WishlistPage() {
  const { id } = useParams<{ id: string }>()
  const { view, state, sync, mark, reload } = useWishlist(id)
  // Nothing that depends on prefs renders until the list has loaded, so
  // reading them in the initializer cannot produce a hydration mismatch.
  const [prefs, setPrefs] = useState<Prefs>(() =>
    typeof window === 'undefined' ? DEFAULT_PREFS : readPrefs()
  )
  const [toast, setToast] = useState<{ item: WishlistItem } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const update = (patch: Partial<Prefs>) =>
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      writePrefs(next)
      return next
    })

  const shoppers = view?.shoppers ?? []
  const tab =
    (id && prefs.tab[id] && shoppers.includes(prefs.tab[id]) ? prefs.tab[id] : shoppers[0]) ?? ''

  const counts = useMemo(() => {
    const out: Record<string, { left: number; bought: number }> = {}
    if (!view) return out
    for (const s of view.shoppers) out[s] = { left: 0, bought: 0 }
    for (const item of view.items) {
      if (view.marks[item.key]) out[item.shopper].bought++
      else out[item.shopper].left++
    }
    return out
  }, [view])

  const shown = useMemo(() => {
    if (!view) return []
    const items = view.items.filter(
      i => i.shopper === tab && (prefs.showBought || !view.marks[i.key])
    )
    const by: Record<Sort, (a: WishlistItem, b: WishlistItem) => number> = {
      fav: (a, b) => Number(b.fav) - Number(a.fav) || a.order - b.order,
      new: (a, b) => a.order - b.order,
      low: (a, b) => a.price - b.price || a.order - b.order,
      high: (a, b) => b.price - a.price || a.order - b.order,
    }
    return items.sort(by[prefs.sort])
  }, [view, tab, prefs.showBought, prefs.sort])

  const showToast = (item: WishlistItem) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ item })
    toastTimer.current = setTimeout(() => setToast(null), 7000)
  }

  const buy = (item: WishlistItem) => {
    void mark(item.key, true, prefs.by.trim())
    // When bought items are hidden the card vanishes on tap, so the toast is
    // the only way back from a slip of the thumb.
    if (!prefs.showBought) showToast(item)
  }

  const undo = (item: WishlistItem) => {
    void mark(item.key, false, prefs.by.trim())
    setToast(null)
  }

  const accentOf = (name: string) => ACCENTS[Math.max(0, shoppers.indexOf(name)) % ACCENTS.length]

  return (
    <Frame>
      {state === 'loading' && <p className="status">Loading the list…</p>}
      {state === 'missing' && (
        <div className="status">
          <h1>No wish list here</h1>
          <p>Check the link you were sent. It should end in a long code.</p>
        </div>
      )}
      {state === 'error' && (
        <div className="status">
          <p>Couldn’t load the list.</p>
          <button type="button" className="buy" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}
      {state === 'ready' && view && id && (
        <>
          <header className="head">
            <p className="eyebrow">Wish list · updated {dayLabel(view.publishedAt)}</p>
            <h1>{view.title}</h1>
            <p className="lede">
              Everything the kids liked in their shop, minus what they already have. Tap{' '}
              <strong>Bought it</strong> once you’ve got one so nobody doubles up. Bought things are
              tucked away unless you ask to see them. This page is for grown-ups.
            </p>
          </header>

          <nav className="tabs" aria-label="Whose list">
            {shoppers.map(name => (
              <button
                key={name}
                type="button"
                className={`tab${name === tab ? ' on' : ''}`}
                style={{ '--accent': `var(${accentOf(name)})` } as CSSProperties}
                aria-pressed={name === tab}
                onClick={() => update({ tab: { ...prefs.tab, [id]: name } })}
              >
                {name}
                <span className="count">{counts[name]?.left ?? 0}</span>
              </button>
            ))}
          </nav>

          <div className="bar">
            <label className="field">
              <span>Sort</span>
              <select value={prefs.sort} onChange={e => update({ sort: e.target.value as Sort })}>
                {SORTS.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={prefs.showBought}
                onChange={e => update({ showBought: e.target.checked })}
              />
              Show bought ({counts[tab]?.bought ?? 0})
            </label>
            <label className="field grow">
              <span>Your name</span>
              <input
                type="text"
                value={prefs.by}
                maxLength={40}
                placeholder="so the family knows who got it"
                onChange={e => update({ by: e.target.value })}
              />
            </label>
            <SyncNote sync={sync} />
          </div>

          {shown.length ? (
            <ul className="grid">
              {shown.map(item => (
                <Card
                  key={item.key}
                  item={item}
                  listId={id}
                  mark={view.marks[item.key]}
                  accent={accentOf(item.shopper)}
                  onBuy={() => buy(item)}
                  onUndo={() => undo(item)}
                />
              ))}
            </ul>
          ) : (
            <p className="status">
              {counts[tab]?.bought
                ? `Everything on ${tab}’s list has been bought.`
                : `${tab}’s list is empty right now.`}
            </p>
          )}

          <footer className="foot">
            <p>
              {view.items.length} things across {shoppers.length} lists. Prices are what the shop
              saw when the list was published and can drift.
            </p>
          </footer>

          {toast && (
            <div className="toast" role="status">
              <span>Marked “{toast.item.name}” bought.</span>
              <button type="button" onClick={() => undo(toast.item)}>
                Undo
              </button>
            </div>
          )}
        </>
      )}
    </Frame>
  )
}

/** Page chrome and styles. Scoped under #wishlist so nothing leaks into the cave. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div id="wishlist">
      <style>{`
        #wishlist {
          --wl-bg: #EAF1FB; --wl-card: #FFFFFF; --wl-ink: #1B2440; --wl-muted: #56618A; --wl-line: #CBD6EE;
          --wl-red: #DC3033; --wl-yellow: #FFC93C; --wl-blue: #2A63DB; --wl-green: #15885A; --wl-pink: #D9488B; --wl-purple: #6A4BE8; --wl-amber: #C97B00;
          --wl-awning-b: #FFFFFF; --wl-bought: #EEF2F8;
          --wl-display: var(--font-wish-display), "Arial Rounded MT Bold", sans-serif;
          --wl-body: var(--font-wish-body), "Avenir Next", system-ui, sans-serif;
          min-height: 100dvh; background: var(--wl-bg); color: var(--wl-ink);
          font-family: var(--wl-body); font-size: 16px; line-height: 1.45; font-weight: 500;
          padding-bottom: 48px;
        }
        @media (prefers-color-scheme: dark) {
          #wishlist {
            --wl-bg: #111730; --wl-card: #1B2346; --wl-ink: #F1F4FF; --wl-muted: #A9B3DA; --wl-line: #34407A;
            --wl-red: #FF6B6E; --wl-blue: #7FA6FF; --wl-green: #4CD29B; --wl-pink: #FF8CC0; --wl-purple: #A892FF; --wl-amber: #FFB84D;
            --wl-awning-b: #F1F4FF; --wl-bought: #161D3C;
          }
        }
        #wishlist * { box-sizing: border-box; }
        #wishlist button, #wishlist input, #wishlist select { font: inherit; color: inherit; }
        #wishlist button { cursor: pointer; }
        #wishlist :focus-visible { outline: 3px solid var(--wl-blue); outline-offset: 2px; }
        #wishlist .awning {
          height: 36px;
          background: repeating-linear-gradient(90deg, var(--wl-red) 0 36px, var(--wl-awning-b) 36px 72px);
          -webkit-mask: radial-gradient(circle 18px at 18px 100%, #0000 98%, #000) 0 0/36px 100%, linear-gradient(#000 0 0) 0 0/100% 50% no-repeat;
          mask: radial-gradient(circle 18px at 18px 100%, #0000 98%, #000) 0 0/36px 100%, linear-gradient(#000 0 0) 0 0/100% 50% no-repeat;
          -webkit-mask-composite: source-over; mask-composite: add;
        }
        #wishlist .wrap { max-width: 1120px; margin: 0 auto; padding: 8px 16px 32px; display: flex; flex-direction: column; gap: 20px; }
        #wishlist .head { display: flex; flex-direction: column; gap: 6px; }
        #wishlist .eyebrow { margin: 0; color: var(--wl-muted); font-weight: 700; font-size: .9rem; letter-spacing: .02em; text-transform: uppercase; }
        #wishlist h1 { margin: 0; font-family: var(--wl-display); font-weight: 600; font-size: clamp(1.9rem, 5vw, 2.8rem); line-height: 1.1; }
        #wishlist .lede { margin: 0; color: var(--wl-muted); max-width: 64ch; }
        #wishlist .tabs { display: flex; gap: 6px; flex-wrap: wrap; border-bottom: 2px solid var(--wl-line); }
        #wishlist .tab {
          display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; margin-bottom: -2px;
          background: none; border: 0; border-bottom: 3px solid transparent; font-family: var(--wl-display); font-size: 1.15rem; color: var(--wl-muted);
        }
        #wishlist .tab.on { color: var(--wl-ink); border-bottom-color: var(--accent); }
        #wishlist .tab .count { font-family: var(--wl-body); font-size: .8rem; font-weight: 800; padding: 1px 8px; border-radius: 999px; background: var(--accent); color: #fff; }
        #wishlist .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px; }
        #wishlist .field { display: inline-flex; align-items: center; gap: 8px; font-size: .9rem; color: var(--wl-muted); font-weight: 700; }
        #wishlist .field.grow { flex: 1 1 220px; }
        #wishlist .field.grow input { flex: 1; min-width: 0; }
        #wishlist .field select, #wishlist .field input {
          padding: 7px 10px; border: 1.5px solid var(--wl-line); border-radius: 10px; background: var(--wl-card); color: var(--wl-ink); font-weight: 600; min-height: 38px;
        }
        #wishlist .check { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: .95rem; min-height: 38px; }
        #wishlist .check input { width: 20px; height: 20px; accent-color: var(--wl-blue); }
        #wishlist .sync { font-size: .85rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; }
        #wishlist .sync.saving { color: var(--wl-muted); background: color-mix(in srgb, var(--wl-line) 50%, transparent); }
        #wishlist .sync.failed { color: #fff; background: var(--wl-red); }
        #wishlist .grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
        #wishlist .card {
          display: flex; flex-direction: column; background: var(--wl-card); border: 1.5px solid var(--wl-line); border-top: 6px solid var(--accent);
          border-radius: 16px; overflow: hidden; box-shadow: 0 2px 0 var(--wl-line);
        }
        #wishlist .card.bought { background: var(--wl-bought); }
        #wishlist .card.bought .pic img, #wishlist .card.bought .emoji { opacity: .55; filter: saturate(.4); }
        #wishlist .pic { position: relative; aspect-ratio: 4 / 3; background: #fff; display: grid; place-items: center; overflow: hidden; }
        #wishlist .pic img { width: 100%; height: 100%; object-fit: contain; display: block; }
        #wishlist .emoji { font-size: 4rem; line-height: 1; }
        #wishlist .favtag, #wishlist .boughttag { position: absolute; top: 8px; left: 8px; font-size: .75rem; font-weight: 900; padding: 3px 9px; border-radius: 999px; background: var(--wl-yellow); color: #1B2440; }
        #wishlist .boughttag { left: auto; right: 8px; background: var(--wl-green); color: #fff; }
        #wishlist .body { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px 14px; flex: 1; }
        #wishlist .kind { margin: 0; font-size: .78rem; font-weight: 800; color: var(--accent); text-transform: uppercase; letter-spacing: .03em; }
        #wishlist h3 { margin: 0; font-size: 1.05rem; line-height: 1.3; font-weight: 800; }
        #wishlist .blurb { margin: 0; color: var(--wl-muted); font-size: .92rem; }
        #wishlist .note { margin: 0; font-size: .9rem; font-weight: 700; color: var(--wl-ink); }
        #wishlist .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 6px; }
        #wishlist .price { font-family: var(--wl-display); font-size: 1.3rem; font-weight: 600; }
        #wishlist .store { color: var(--wl-blue); font-weight: 800; text-decoration: none; font-size: .95rem; padding: 6px 0; }
        #wishlist .store:hover { text-decoration: underline; }
        #wishlist .buy, #wishlist .undo {
          min-height: 44px; border-radius: 12px; border: 2px solid var(--wl-green); background: var(--wl-green); color: #fff; font-weight: 900; font-size: 1rem; padding: 8px 14px;
        }
        #wishlist .buy:hover { filter: brightness(1.08); }
        #wishlist .boughtline { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-weight: 700; color: var(--wl-muted); font-size: .92rem; min-height: 44px; }
        #wishlist .undo { background: none; color: var(--wl-ink); border-color: var(--wl-line); padding: 6px 12px; min-height: 36px; }
        #wishlist .status { text-align: center; color: var(--wl-muted); padding: 40px 0; display: flex; flex-direction: column; gap: 12px; align-items: center; }
        #wishlist .status h1 { color: var(--wl-ink); }
        #wishlist .foot { color: var(--wl-muted); font-size: .9rem; text-align: center; }
        #wishlist .foot p { margin: 0; }
        #wishlist .toast {
          position: fixed; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); transform: translateX(-50%);
          display: flex; align-items: center; gap: 14px; max-width: min(92vw, 520px); padding: 12px 16px; border-radius: 14px;
          background: var(--wl-ink); color: var(--wl-bg); font-weight: 700; box-shadow: 0 8px 24px rgba(0,0,0,.25); z-index: 10;
        }
        #wishlist .toast span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        #wishlist .toast button { background: var(--wl-yellow); color: #1B2440; border: 0; border-radius: 10px; padding: 8px 14px; font-weight: 900; min-height: 40px; }
        @media (max-width: 480px) {
          #wishlist .grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          #wishlist .body { padding: 10px; }
          #wishlist h3 { font-size: .95rem; }
          #wishlist .blurb { display: none; }
          #wishlist .price { font-size: 1.1rem; }
          #wishlist .emoji { font-size: 3rem; }
        }
      `}</style>
      <div className="awning" aria-hidden="true" />
      <div className="wrap">{children}</div>
    </div>
  )
}
