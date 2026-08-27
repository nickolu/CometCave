'use client'
import { useState } from 'react'
import { useBlitzStore } from '../store'
import type { CatalogUnit } from '../domain/unit-catalog'

interface BoardEditorProps {
  team: CatalogUnit[]
  boardLevels: Record<number, number>
  maxSlots: number
}

export function BoardEditor({ team, boardLevels, maxSlots }: BoardEditorProps) {
  const { swap } = useBlitzStore()
  const [selected, setSelected] = useState<number | null>(null)

  // Build 6-slot grid
  const slots: Array<CatalogUnit | null> = Array(6).fill(null)
  team.forEach((u, i) => { slots[i] = u })

  function handleSlotActivate(slotIdx: number) {
    if (slotIdx >= maxSlots) return  // Can't interact with locked slots

    if (selected === null) {
      // Select this slot if it has a unit
      if (slots[slotIdx] !== null) {
        setSelected(slotIdx)
      }
    } else if (selected === slotIdx) {
      // Deselect
      setSelected(null)
    } else {
      // Swap selected with this slot
      swap(selected, slotIdx)
      setSelected(null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, slotIdx: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSlotActivate(slotIdx)
    } else if (e.key === 'Escape') {
      setSelected(null)
    }
  }

  return (
    <div role="region" aria-label="Team board — reorder units between front and back row">
      {/* Row labels */}
      {(['Front row', 'Back row'] as const).map((rowLabel, rowIdx) => (
        <div key={rowLabel}>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, letterSpacing: 1, margin: '0 0 6px', textTransform: 'uppercase' }}>
            {rowLabel}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: rowIdx === 0 ? 16 : 0 }}>
            {[0, 1, 2].map(colIdx => {
              const slotIdx = rowIdx * 3 + colIdx
              const unit = slots[slotIdx]
              const isSelected = selected === slotIdx
              const isLocked = slotIdx >= maxSlots
              const survivalLevel = unit ? (boardLevels[unit.dexId] ?? 0) : 0

              return (
                <div
                  key={slotIdx}
                  role="button"
                  tabIndex={isLocked ? -1 : 0}
                  aria-label={unit ? `${unit.name}${survivalLevel > 0 ? ` level ${survivalLevel}` : ''} — slot ${slotIdx + 1}${isSelected ? ', selected' : ''}` : `Empty slot ${slotIdx + 1}`}
                  aria-pressed={isSelected}
                  onClick={() => handleSlotActivate(slotIdx)}
                  onKeyDown={e => handleKeyDown(e, slotIdx)}
                  className="br-btn"
                  style={{
                    minHeight: 64,
                    background: isLocked
                      ? 'rgba(255,255,255,0.02)'
                      : isSelected
                      ? 'rgba(124,106,255,0.20)'
                      : unit
                      ? 'rgba(255,255,255,0.07)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${
                      isSelected
                        ? 'rgba(124,106,255,0.80)'
                        : unit
                        ? 'rgba(255,255,255,0.14)'
                        : 'rgba(255,255,255,0.06)'
                    }`,
                    borderRadius: 8,
                    padding: '8px',
                    cursor: isLocked ? 'default' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    textAlign: 'center',
                    userSelect: 'none',
                  }}
                >
                  {unit ? (
                    <>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                        {unit.name}
                      </span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>
                        {unit.tier}
                      </span>
                      {survivalLevel > 0 && (
                        <span style={{ fontSize: 10, color: '#7c6aff' }}>Lv.{survivalLevel}</span>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', fontStyle: 'italic' }}>
                      {isLocked ? '—' : 'empty'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {selected !== null && (
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, margin: '8px 0 0', textAlign: 'center' }}>
          Select another slot to swap, or press Escape to cancel
        </p>
      )}
    </div>
  )
}
