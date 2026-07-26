'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Category = 'anywhere' | 'people' | 'snacks' | 'inline' | 'lands'
type FilterType = 'all' | 'anywhere' | 'people' | 'snacks' | 'inline' | 'lands'

interface Item {
  id: string
  text: string
  category: Category
  land?: string
  bonus?: number
  action?: boolean
}

const ITEMS: Item[] = [
  // Anywhere
  { id: 'a1',  text: 'A Hidden Mickey (3 circles!)', category: 'anywhere', bonus: 3 },
  { id: 'a2',  text: 'Someone wearing mouse ears', category: 'anywhere' },
  { id: 'a3',  text: 'A shiny balloon', category: 'anywhere' },
  { id: 'a4',  text: 'A bird hunting for crumbs', category: 'anywhere' },
  { id: 'a5',  text: 'A teeny-tiny door or window', category: 'anywhere' },
  { id: 'a6',  text: 'A fancy old-timey lamp', category: 'anywhere' },
  { id: 'a7',  text: 'Flowers planted in a shape', category: 'anywhere' },
  { id: 'a8',  text: 'Music playing from somewhere secret', category: 'anywhere' },
  { id: 'a9',  text: 'A trash can painted to match the land', category: 'anywhere' },
  { id: 'a10', text: 'A cast member sweeping with a big broom', category: 'anywhere' },
  { id: 'a11', text: 'A clock', category: 'anywhere' },
  { id: 'a12', text: 'A bell', category: 'anywhere' },
  { id: 'a13', text: 'A lantern', category: 'anywhere' },
  { id: 'a14', text: 'A wooden barrel', category: 'anywhere' },
  { id: 'a15', text: 'A mailbox', category: 'anywhere' },
  { id: 'a16', text: 'A big wagon wheel', category: 'anywhere' },
  { id: 'a17', text: 'A sign with fancy gold letters', category: 'anywhere' },
  { id: 'a18', text: 'An old key or padlock', category: 'anywhere' },
  { id: 'a19', text: 'Your reflection in something shiny', category: 'anywhere' },
  { id: 'a20', text: 'Something purple', category: 'anywhere' },
  { id: 'a21', text: 'A horse (real OR statue)', category: 'anywhere' },
  { id: 'a22', text: 'A weather vane on a roof', category: 'anywhere' },

  // People
  { id: 'p1',  text: 'A name tag from far, far away', category: 'people', bonus: 3 },
  { id: 'p2',  text: 'Someone wearing a birthday button', category: 'people' },
  { id: 'p3',  text: 'A family in matching shirts', category: 'people' },
  { id: 'p4',  text: 'Someone taking a selfie', category: 'people' },
  { id: 'p5',  text: 'A lanyard full of trading pins', category: 'people' },
  { id: 'p6',  text: 'Somebody fast asleep in a stroller', category: 'people' },
  { id: 'p7',  text: 'A kid dressed like royalty', category: 'people' },
  { id: 'p8',  text: 'A cast member who waves back at you', category: 'people' },
  { id: 'p9',  text: 'Someone with face paint', category: 'people' },
  { id: 'p10', text: 'A light-up toy or bubble wand', category: 'people' },
  { id: 'p11', text: 'Someone carrying a GIANT stuffed animal', category: 'people' },
  { id: 'p12', text: 'Two people dressed exactly the same', category: 'people' },
  { id: 'p13', text: 'A photographer with a big camera', category: 'people' },
  { id: 'p14', text: 'Someone doing a silly photo pose', category: 'people' },
  { id: 'p15', text: 'A grandma or grandpa wearing ears', category: 'people' },
  { id: 'p16', text: 'A hard-working helper dog', category: 'people' },
  { id: 'p17', text: 'Someone speaking a different language', category: 'people' },
  { id: 'p18', text: 'High-five a family member', category: 'people', action: true },

  // Snacks
  { id: 's1',  text: 'Someone eating a churro', category: 'snacks' },
  { id: 's2',  text: 'A popcorn cart', category: 'snacks' },
  { id: 's3',  text: 'A snack shaped like a mouse', category: 'snacks', bonus: 3 },
  { id: 's4',  text: 'A giant pretzel', category: 'snacks' },
  { id: 's5',  text: 'A lollipop bigger than your hand', category: 'snacks' },
  { id: 's6',  text: 'A turkey leg as big as your arm', category: 'snacks' },
  { id: 's7',  text: 'Cotton candy', category: 'snacks' },
  { id: 's8',  text: 'A swirly pineapple treat', category: 'snacks' },
  { id: 's9',  text: 'A giant corn dog', category: 'snacks' },
  { id: 's10', text: 'A popcorn bucket shaped like something', category: 'snacks' },
  { id: 's11', text: 'A candy apple decorated with a face', category: 'snacks' },
  { id: 's12', text: 'A fancy souvenir cup', category: 'snacks' },
  { id: 's13', text: 'Someone with a melty ice cream', category: 'snacks' },
  { id: 's14', text: 'Two people sharing one snack', category: 'snacks' },

  // In Line
  { id: 'q1',  text: 'A story detail hidden in the queue theming', category: 'inline' },
  { id: 'q2',  text: 'A working prop, mechanism, or animatronic in the queue', category: 'inline' },
  { id: 'q3',  text: 'A sign that\'s secretly funny if you read the fine print', category: 'inline' },
  { id: 'q4',  text: 'A date or number stamped on a prop', category: 'inline' },
  { id: 'q5',  text: 'A newspaper, letter, or document from the fictional world', category: 'inline' },
  { id: 'q6',  text: 'Something you can touch or interact with while waiting', category: 'inline' },
  { id: 'q7',  text: 'A nod to another Disney movie hidden in the queue', category: 'inline' },
  { id: 'q8',  text: 'A smell that perfectly matches the ride\'s theme', category: 'inline' },
  { id: 'q9',  text: 'A sound effect that makes the wait feel real', category: 'inline' },
  { id: 'q10', text: 'A "Staff Only" door that looks completely in-theme', category: 'inline' },
  { id: 'q11', text: 'A warning sign written in the ride\'s fictional rules', category: 'inline' },
  { id: 'q12', text: 'A Hidden Mickey somewhere in the queue', category: 'inline', bonus: 3 },
  { id: 'q13', text: 'A cobweb — real or fake? Can you tell?', category: 'inline' },
  { id: 'q14', text: 'A timeline, map, or diagram on the queue walls', category: 'inline' },
  { id: 'q15', text: 'Make a new friend in line — introduce yourself!', category: 'inline', action: true },

  // Lands — Main Street, U.S.A.
  { id: 'ms1', text: 'A horse-drawn vehicle on the street', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms2', text: 'The fire station (Engine Co. 1)', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms3', text: 'A window dedication above a shop', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms4', text: 'Ragtime piano or barbershop quartet music', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms5', text: 'The Emporium store window display', category: 'lands', land: 'Main Street, U.S.A.' },

  // Lands — Adventureland
  { id: 'al1', text: 'A tiki totem or idol', category: 'lands', land: 'Adventureland' },
  { id: 'al2', text: 'Jungle Cruise boats loading or returning', category: 'lands', land: 'Adventureland' },
  { id: 'al3', text: 'Something made entirely of bamboo', category: 'lands', land: 'Adventureland' },
  { id: 'al4', text: 'A real or carved tropical bird', category: 'lands', land: 'Adventureland' },
  { id: 'al5', text: 'The Indiana Jones temple entrance arch', category: 'lands', land: 'Adventureland' },

  // Lands — New Orleans Square
  { id: 'no1', text: 'A wrought-iron lace balcony', category: 'lands', land: 'New Orleans Square' },
  { id: 'no2', text: 'The Haunted Mansion facade', category: 'lands', land: 'New Orleans Square' },
  { id: 'no3', text: 'The Pirates of the Caribbean entrance', category: 'lands', land: 'New Orleans Square' },
  { id: 'no4', text: 'A street musician or live jazz sound', category: 'lands', land: 'New Orleans Square' },
  { id: 'no5', text: 'A beignet or Cajun-themed treat', category: 'lands', land: 'New Orleans Square' },

  // Lands — Frontierland
  { id: 'fr1', text: 'The Mark Twain Riverboat (or Columbia sailing ship)', category: 'lands', land: 'Frontierland' },
  { id: 'fr2', text: 'Big Thunder Mountain — point at the very peak!', category: 'lands', land: 'Frontierland' },
  { id: 'fr3', text: 'A wanted poster on a wall', category: 'lands', land: 'Frontierland' },
  { id: 'fr4', text: 'Something made of rope, leather, or rawhide', category: 'lands', land: 'Frontierland' },
  { id: 'fr5', text: 'A wagon or mine cart', category: 'lands', land: 'Frontierland' },

  // Lands — Fantasyland
  { id: 'fn1', text: 'Sleeping Beauty Castle from the inside courtyard', category: 'lands', land: 'Fantasyland' },
  { id: 'fn2', text: 'The Matterhorn — spot someone at the summit!', category: 'lands', land: 'Fantasyland' },
  { id: 'fn3', text: "It's a Small World clock tower", category: 'lands', land: 'Fantasyland' },
  { id: 'fn4', text: 'King Arthur Carrousel horses', category: 'lands', land: 'Fantasyland' },
  { id: 'fn5', text: 'Dumbo flying overhead', category: 'lands', land: 'Fantasyland' },

  // Lands — Tomorrowland
  { id: 'tm1', text: 'Space Mountain (the full dome)', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm2', text: 'A rocket ship or spacecraft decoration', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm3', text: 'Something chrome, metallic, or shiny silver', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm4', text: 'Astro Orbitor rockets spinning overhead', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm5', text: 'A retro-futuristic font or logo', category: 'lands', land: 'Tomorrowland' },

  // Lands — Mickey's Toontown
  { id: 'tt1', text: "Mickey's house (red with polka-dot accents)", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt2', text: 'A wacky cartoon gadget or contraption', category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt3', text: "Minnie's house (it's pink!)", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt4', text: 'A cartoon manhole cover with a character face', category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt5', text: "A building that looks like it's smiling or making a face", category: 'lands', land: "Mickey's Toontown" },

  // Lands — Star Wars: Galaxy's Edge
  { id: 'sw1', text: 'A First Order Stormtrooper on patrol', category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw2', text: "The Millennium Falcon — she's huge up close!", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw3', text: "An alien creature or species you can't name", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw4', text: "Blue or green milk from the market", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw5', text: "Aurebesh (Star Wars alphabet) written somewhere", category: 'lands', land: "Star Wars: Galaxy's Edge" },
]

const LAND_ORDER = [
  'Main Street, U.S.A.',
  'Adventureland',
  'New Orleans Square',
  'Frontierland',
  'Fantasyland',
  'Tomorrowland',
  "Mickey's Toontown",
  "Star Wars: Galaxy's Edge",
]

const LAND_EMOJI: Record<string, string> = {
  'Main Street, U.S.A.': '🏛',
  'Adventureland': '🌴',
  'New Orleans Square': '🎷',
  'Frontierland': '🤠',
  'Fantasyland': '🏰',
  'Tomorrowland': '🚀',
  "Mickey's Toontown": '🎪',
  "Star Wars: Galaxy's Edge": '⚔️',
}

const STORAGE_KEY = 'dlhunt-checked'
const maxScore = ITEMS.reduce((sum, item) => sum + (item.bonus ?? 1), 0)

function getScore(checked: Set<string>): number {
  return ITEMS.reduce((sum, item) => checked.has(item.id) ? sum + (item.bonus ?? 1) : sum, 0)
}

function getCategoryCount(cat: Category, checked: Set<string>): number {
  return ITEMS.filter(i => i.category === cat && checked.has(i.id)).length
}

function getCategoryTotal(cat: Category): number {
  return ITEMS.filter(i => i.category === cat).length
}

function ItemRow({ item, isChecked, onToggle }: { item: Item; isChecked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: '100%',
        textAlign: 'left',
        background: isChecked ? 'rgba(0,255,194,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isChecked ? 'rgba(0,255,194,0.2)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 10,
        padding: '14px 16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        transition: 'background 0.15s',
        minHeight: 52,
      }}
    >
      {/* Checkbox circle */}
      <div style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        borderRadius: '50%',
        border: `2px solid ${isChecked ? '#00ffc2' : 'rgba(255,255,255,0.2)'}`,
        background: isChecked ? '#00ffc2' : 'transparent',
        marginTop: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {isChecked && <span style={{ fontSize: 13, color: '#000', fontWeight: 'bold' }}>✓</span>}
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 15,
          lineHeight: 1.4,
          color: isChecked ? 'rgba(255,255,255,0.35)' : '#e8e8f0',
          textDecoration: isChecked ? 'line-through' : 'none',
          fontStyle: item.action ? 'italic' : 'normal',
        }}>
          {item.action && <span style={{ color: '#ffd700' }}>✊ DO IT: </span>}
          {item.text}
        </div>
        {item.bonus && (
          <div style={{ color: '#ffd700', fontSize: 11, marginTop: 4 }}>
            {'⭐'.repeat(item.bonus)} +{item.bonus} pts
          </div>
        )}
      </div>
    </button>
  )
}

export default function DisneylandHuntPage() {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setChecked(new Set(JSON.parse(raw)))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...checked]))
    } catch {}
  }, [checked])

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const score = getScore(checked)
  const foundCount = checked.size
  const allDone = foundCount === ITEMS.length

  const tabs: { key: FilterType; label: string; emoji: string }[] = [
    { key: 'all',      label: 'All',      emoji: '' },
    { key: 'anywhere', label: 'Anywhere', emoji: '👀' },
    { key: 'people',   label: 'People',   emoji: '🧑' },
    { key: 'snacks',   label: 'Snacks',   emoji: '🍿' },
    { key: 'inline',   label: 'In Line',  emoji: '🎪' },
    { key: 'lands',    label: 'By Land',  emoji: '🗺' },
  ]

  const flatFiltered = filter === 'all' || filter === 'lands'
    ? ITEMS.filter(i => filter === 'all' || i.category === 'lands')
    : ITEMS.filter(i => i.category === filter)

  // For 'lands' view: group by land
  const landGroups: { land: string; items: Item[] }[] = filter === 'lands'
    ? LAND_ORDER.map(land => ({
        land,
        items: ITEMS.filter(i => i.land === land),
      }))
    : []

  return (
    <div style={{ minHeight: '100dvh', background: '#080810', color: '#e8e8f0', fontFamily: 'inherit' }}>

      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(8,8,16,0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>
            ← Cave
          </Link>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>🎢 Scavenger Hunt</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{foundCount} / {ITEMS.length}</span>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)', marginTop: 8 }}>
          <div style={{
            width: `${(score / maxScore) * 100}%`,
            height: '100%', background: '#00ffc2', borderRadius: 2, transition: 'width 0.3s',
          }} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
          Score: {score} / {maxScore} pts
        </div>
      </div>

      {/* Category tabs */}
      <div style={{
        position: 'sticky', top: 73, zIndex: 9,
        background: 'rgba(8,8,16,0.95)',
        padding: '10px 16px',
        display: 'flex', gap: 8,
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {tabs.map(tab => {
          const active = filter === tab.key
          let label = tab.emoji ? `${tab.emoji} ${tab.label}` : tab.label
          if (!active && tab.key !== 'all') {
            const cat = tab.key as Category
            const done = getCategoryCount(cat, checked)
            const total = getCategoryTotal(cat)
            label += ` (${done}/${total})`
          }
          return (
            <button key={tab.key} type="button" onClick={() => setFilter(tab.key)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              border: '1px solid', whiteSpace: 'nowrap', transition: 'all 0.15s',
              background: active ? '#00ffc222' : 'transparent',
              borderColor: active ? '#00ffc2' : 'rgba(255,255,255,0.15)',
              color: active ? '#00ffc2' : 'rgba(255,255,255,0.5)',
            }}>
              {label}
            </button>
          )
        })}
      </div>

      {/* Item list */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 600, margin: '0 auto' }}>

        {allDone && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,255,194,0.12), rgba(255,215,0,0.08))',
            border: '1px solid rgba(0,255,194,0.3)',
            borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#00ffc2' }}>🎉 You found everything!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
              Score: {score} / {maxScore} pts — legendary explorer!
            </div>
          </div>
        )}

        {filter === 'lands' ? (
          landGroups.map(({ land, items }) => {
            const landDone = items.filter(i => checked.has(i.id)).length
            return (
              <div key={land} style={{ marginBottom: 8 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 4px 6px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  marginBottom: 6,
                }}>
                  <span style={{ fontSize: 16 }}>{LAND_EMOJI[land] ?? '📍'}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', flex: 1 }}>{land}</span>
                  <span style={{ fontSize: 11, color: landDone === items.length ? '#00ffc2' : 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>
                    {landDone}/{items.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {items.map(item => (
                    <ItemRow key={item.id} item={item} isChecked={checked.has(item.id)} onToggle={() => toggle(item.id)} />
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          flatFiltered.map(item => (
            <ItemRow key={item.id} item={item} isChecked={checked.has(item.id)} onToggle={() => toggle(item.id)} />
          ))
        )}
      </div>

      {/* Reset */}
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <button type="button" onClick={() => { setChecked(new Set()); try { localStorage.removeItem(STORAGE_KEY) } catch {} }}
          style={{
            padding: '8px 20px', fontSize: 12,
            color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, background: 'transparent', cursor: 'pointer', letterSpacing: 1,
          }}>
          Reset hunt
        </button>
      </div>
    </div>
  )
}
