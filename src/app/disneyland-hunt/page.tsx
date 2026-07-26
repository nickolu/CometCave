'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Category = 'anywhere' | 'people' | 'snacks'

interface Item {
  id: string
  text: string
  category: Category
  bonus?: number
  action?: boolean
}

const ITEMS: Item[] = [
  // Anywhere
  { id: 'a1', text: 'A Hidden Mickey (3 circles!)', category: 'anywhere', bonus: 3 },
  { id: 'a2', text: 'Someone wearing mouse ears', category: 'anywhere' },
  { id: 'a3', text: 'A shiny balloon', category: 'anywhere' },
  { id: 'a4', text: 'A bird hunting for crumbs', category: 'anywhere' },
  { id: 'a5', text: 'A teeny-tiny door or window', category: 'anywhere' },
  { id: 'a6', text: 'A fancy old-timey lamp', category: 'anywhere' },
  { id: 'a7', text: 'Flowers planted in a shape', category: 'anywhere' },
  { id: 'a8', text: 'Music playing from somewhere secret', category: 'anywhere' },
  { id: 'a9', text: 'A trash can painted to match the land', category: 'anywhere' },
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
  { id: 'p1', text: 'A name tag from far, far away', category: 'people', bonus: 3 },
  { id: 'p2', text: 'Someone wearing a birthday button', category: 'people' },
  { id: 'p3', text: 'A family in matching shirts', category: 'people' },
  { id: 'p4', text: 'Someone taking a selfie', category: 'people' },
  { id: 'p5', text: 'A lanyard full of trading pins', category: 'people' },
  { id: 'p6', text: 'Somebody fast asleep in a stroller', category: 'people' },
  { id: 'p7', text: 'A kid dressed like royalty', category: 'people' },
  { id: 'p8', text: 'A cast member who waves back at you', category: 'people' },
  { id: 'p9', text: 'Someone with face paint', category: 'people' },
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
  { id: 's1', text: 'Someone eating a churro', category: 'snacks' },
  { id: 's2', text: 'A popcorn cart', category: 'snacks' },
  { id: 's3', text: 'A snack shaped like a mouse', category: 'snacks', bonus: 3 },
  { id: 's4', text: 'A giant pretzel', category: 'snacks' },
  { id: 's5', text: 'A lollipop bigger than your hand', category: 'snacks' },
  { id: 's6', text: 'A turkey leg as big as your arm', category: 'snacks' },
  { id: 's7', text: 'Cotton candy', category: 'snacks' },
  { id: 's8', text: 'A swirly pineapple treat', category: 'snacks' },
  { id: 's9', text: 'A giant corn dog', category: 'snacks' },
  { id: 's10', text: 'A popcorn bucket shaped like something', category: 'snacks' },
  { id: 's11', text: 'A candy apple decorated with a face', category: 'snacks' },
  { id: 's12', text: 'A fancy souvenir cup', category: 'snacks' },
  { id: 's13', text: 'Someone with a melty ice cream', category: 'snacks' },
  { id: 's14', text: 'Two people sharing one snack', category: 'snacks' },
]

const STORAGE_KEY = 'dlhunt-checked'

const maxScore = ITEMS.reduce((sum, item) => sum + (item.bonus ?? 1), 0)

function getScore(checked: Set<string>): number {
  return ITEMS.reduce((sum, item) => {
    if (!checked.has(item.id)) return sum
    return sum + (item.bonus ?? 1)
  }, 0)
}

function getCategoryCount(category: Category, checked: Set<string>): number {
  return ITEMS.filter(i => i.category === category && checked.has(i.id)).length
}

function getCategoryTotal(category: Category): number {
  return ITEMS.filter(i => i.category === category).length
}

type FilterType = 'all' | 'anywhere' | 'people' | 'snacks'

export default function DisneylandHuntPage() {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<FilterType>('all')

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setChecked(new Set(JSON.parse(raw)))
    } catch {}
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...checked]))
    } catch {}
  }, [checked])

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const score = getScore(checked)
  const foundCount = checked.size
  const allDone = foundCount === ITEMS.length

  const filteredItems = filter === 'all' ? ITEMS : ITEMS.filter(i => i.category === filter)

  const tabs: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'anywhere', label: `👀 Anywhere` },
    { key: 'people', label: `🧑 People` },
    { key: 'snacks', label: `🍿 Snacks` },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: '#080810', color: '#e8e8f0', fontFamily: 'inherit' }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'rgba(8,8,16,0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '12px 16px',
      }}>
        {/* Row 1: nav + title + count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>
            ← Cave
          </Link>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>🎢 Scavenger Hunt</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{foundCount} / 54</span>
        </div>

        {/* Row 2: progress bar */}
        <div style={{
          height: 3,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.1)',
          marginTop: 8,
        }}>
          <div style={{
            width: `${(score / maxScore) * 100}%`,
            height: '100%',
            background: '#00ffc2',
            borderRadius: 2,
            transition: 'width 0.3s',
          }} />
        </div>

        {/* Row 3: score */}
        <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
          Score: {score} / {maxScore} pts
        </div>
      </div>

      {/* Category tabs */}
      <div style={{
        position: 'sticky',
        top: 73,
        zIndex: 9,
        background: 'rgba(8,8,16,0.95)',
        padding: '10px 16px',
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {tabs.map(tab => {
          const active = filter === tab.key
          let label = tab.label
          if (!active && tab.key !== 'all') {
            const cat = tab.key as Category
            label = `${tab.label} (${getCategoryCount(cat, checked)}/${getCategoryTotal(cat)})`
          }
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                cursor: 'pointer',
                border: '1px solid',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                background: active ? '#00ffc222' : 'transparent',
                borderColor: active ? '#00ffc2' : 'rgba(255,255,255,0.15)',
                color: active ? '#00ffc2' : 'rgba(255,255,255,0.5)',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Item list */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxWidth: 600,
        margin: '0 auto',
      }}>
        {/* All-done celebration banner */}
        {allDone && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,255,194,0.12), rgba(255,215,0,0.08))',
            border: '1px solid rgba(0,255,194,0.3)',
            borderRadius: 12,
            padding: 20,
            textAlign: 'center',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#00ffc2' }}>
              🎉 You found everything!
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
              Score: {score} / {maxScore} pts — legendary explorer!
            </div>
          </div>
        )}

        {filteredItems.map(item => {
          const isChecked = checked.has(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
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
                {isChecked && (
                  <span style={{ fontSize: 13, color: '#000', fontWeight: 'bold' }}>✓</span>
                )}
              </div>

              {/* Text content */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 15,
                  lineHeight: 1.4,
                  color: isChecked ? 'rgba(255,255,255,0.35)' : '#e8e8f0',
                  textDecoration: isChecked ? 'line-through' : 'none',
                  fontStyle: item.action ? 'italic' : 'normal',
                }}>
                  {item.action && (
                    <span style={{ color: '#ffd700' }}>✊ DO IT: </span>
                  )}
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
        })}
      </div>

      {/* Reset section */}
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => {
            setChecked(new Set())
            try { localStorage.removeItem(STORAGE_KEY) } catch {}
          }}
          style={{
            padding: '8px 20px',
            fontSize: 12,
            color: 'rgba(255,255,255,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            background: 'transparent',
            cursor: 'pointer',
            letterSpacing: 1,
          }}
        >
          Reset hunt
        </button>
      </div>
    </div>
  )
}
