'use client'

import { useEffect, useRef, useState } from 'react'

import { FantasyDecisionOption, FantasyDecisionPoint, FantasyStoryEvent } from '../models/types'

interface ResourceDeltaDisplayProps {
  resourceDelta: FantasyStoryEvent['resourceDelta']
  isHighlighted: boolean
}

function ResourceDeltaDisplay({ resourceDelta, isHighlighted }: ResourceDeltaDisplayProps) {
  if (!resourceDelta) return null

  const getValueColor = (value: number) => {
    if (value > 0) return isHighlighted ? 'text-green-300' : 'text-green-400'
    if (value < 0) return isHighlighted ? 'text-red-300' : 'text-red-400'
    return isHighlighted ? 'text-slate-200' : 'text-slate-300'
  }

  const changes = [
    resourceDelta.gold !== undefined && resourceDelta.gold !== 0 ? (
      <span key="gold" className={getValueColor(resourceDelta.gold)}>
        Gold {resourceDelta.gold > 0 ? '+' : ''}
        {resourceDelta.gold}
      </span>
    ) : null,
    resourceDelta.reputation !== undefined && resourceDelta.reputation !== 0 ? (
      <span key="reputation" className={getValueColor(resourceDelta.reputation)}>
        Reputation {resourceDelta.reputation > 0 ? '+' : ''}
        {resourceDelta.reputation}
      </span>
    ) : null,
    resourceDelta.distance !== undefined && resourceDelta.distance !== 0 ? (
      <span key="distance" className={getValueColor(resourceDelta.distance)}>
        Distance {resourceDelta.distance > 0 ? '+' : ''}
        {resourceDelta.distance}
      </span>
    ) : null,
    resourceDelta.statusChange ? (
      <span key="status" className={isHighlighted ? 'text-slate-200' : 'text-slate-300'}>
        Status: {resourceDelta.statusChange}
      </span>
    ) : null,
  ].filter(Boolean)

  if (changes.length === 0) return null

  return (
    <div className={`mt-2 p-2 rounded-md ${isHighlighted ? 'bg-slate-600' : 'bg-slate-700'}`}>
      <div className="text-sm flex flex-wrap gap-2">{changes}</div>
    </div>
  )
}

interface DecisionPointDisplayProps {
  decisionPoint: FantasyDecisionPoint
  isHighlighted: boolean
  selectedOption: string
}

interface DecisionPointOptionDisplayProps {
  option: FantasyDecisionOption
  isHighlighted: boolean
  isSelected: boolean
}

function DecisionPointOptionDisplay({
  option,
  isHighlighted,
  isSelected,
}: DecisionPointOptionDisplayProps) {
  return (
    <div
      className={`p-2 rounded ${isHighlighted ? 'bg-slate-500' : 'bg-slate-600'} ${isSelected && 'selected border-green-500 border-2'}`}
    >
      <span className={`text-sm ${isHighlighted ? 'text-yellow-300' : 'text-yellow-400'}`}>
        {option.text} {isSelected && '(Selected)'}
      </span>
    </div>
  )
}

function DecisionPointDisplay({
  decisionPoint,
  isHighlighted,
  selectedOption,
}: DecisionPointDisplayProps) {
  const [isOptionsVisible, setIsOptionsVisible] = useState(false)

  const toggleOptionsVisibility = () => {
    setIsOptionsVisible(!isOptionsVisible)
  }

  return (
    <div className={`mt-2 rounded-lg`}>
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={toggleOptionsVisibility}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleOptionsVisibility()}
      >
        <p
          className={`text-md font-semibold ${isHighlighted ? 'text-slate-50' : 'text-slate-100'} mb-0`}
        >
          {decisionPoint.prompt}
        </p>
        <span className={`text-xs ${isHighlighted ? 'text-slate-300' : 'text-slate-400'}`}>
          {isOptionsVisible ? 'Hide Options ▲' : 'Show Options ▼'}
        </span>
      </div>
      {isOptionsVisible && decisionPoint.options.length > 0 && (
        <div className="mt-2 space-y-1">
          {decisionPoint.options.map(option => (
            <DecisionPointOptionDisplay
              key={option.id}
              option={option}
              isSelected={option.text === selectedOption}
              isHighlighted={isHighlighted}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface RewardItemDisplayProps {
  item: { id: string; name: string; quantity: number }
  isHighlighted: boolean
}

function RewardItemDisplay({ item, isHighlighted }: RewardItemDisplayProps) {
  return (
    <div className={`p-2 rounded-md ${isHighlighted ? 'bg-slate-600' : 'bg-slate-700'}`}>
      <span className={isHighlighted ? 'text-slate-200' : 'text-slate-300'}>
        You received {item.quantity > 1 ? `${item.quantity} ` : ''}
        <span className={`font-semibold ${isHighlighted ? 'text-yellow-300' : 'text-yellow-400'}`}>
          {item.name}
        </span>
      </span>
    </div>
  )
}

export function StoryFeed({
  events,
  filterCharacterId,
}: {
  events: FantasyStoryEvent[]
  filterCharacterId?: string
}) {
  const feedRef = useRef<HTMLDivElement>(null)
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null)

  const filteredEvents = events.filter(
    e => !filterCharacterId || e.characterId === filterCharacterId
  )

  const newestEvent = filteredEvents.length > 0 ? filteredEvents[filteredEvents.length - 1] : null
  const newestEventId = newestEvent ? newestEvent.id : null

  useEffect(() => {
    if (newestEventId && feedRef.current) {
      const animationFrameId = requestAnimationFrame(() => {
        if (feedRef.current) {
          feedRef.current.scrollTo({ top: 0, behavior: 'auto' })
        }
      })

      setHighlightedEventId(newestEventId)
      const highlightTimer = setTimeout(() => {
        setHighlightedEventId(null)
      }, 2000)

      return () => {
        cancelAnimationFrame(animationFrameId)
        clearTimeout(highlightTimer)
      }
    }
  }, [newestEventId])

  if (!filteredEvents?.length) {
    return <div className="bg-slate-800 p-3 rounded-lg text-slate-400 text-sm">No events yet.</div>
  }

  return (
    <div
      ref={feedRef}
      className="border border-slate-700 rounded-lg max-h-[calc(100vh-479px)] overflow-y-auto flex p-2 space-y-2 flex-col bg-slate-900"
    >
      {filteredEvents.reverse().map(storyEvent => {
        const isHighlighted = highlightedEventId === storyEvent.id
        const allRewardItems = [
          ...(storyEvent.resourceDelta?.rewardItems || []),
          ...(storyEvent.rewardItems || []),
        ]

        return (
          <div
            key={`${storyEvent.id}-${storyEvent.timestamp}`}
            className={`border-b border-slate-700 pb-2 mb-2 first:border-none last:mb-0 transition-colors duration-300 ease-in-out rounded-lg ${isHighlighted ? 'bg-slate-700' : 'bg-slate-800'} p-3`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className={`text-xs ${isHighlighted ? 'text-slate-300' : 'text-slate-400'}`}>
                {new Date(storyEvent.timestamp).toISOString().replace('T', ' ').slice(0, 16)}
              </span>
            </div>

            {storyEvent.decisionPoint && (
              <DecisionPointDisplay
                decisionPoint={storyEvent.decisionPoint}
                isHighlighted={isHighlighted}
                selectedOption={storyEvent.selectedOptionText ?? ''}
              />
            )}

            {storyEvent.outcomeDescription && (
              <div
                className={`text-sm mb-2 ${isHighlighted ? 'text-slate-100' : 'text-slate-200'}`}
              >
                {storyEvent.outcomeDescription}
              </div>
            )}

            {allRewardItems.length > 0 && (
              <div className="mt-2 space-y-1">
                {allRewardItems.map((item, idx) => (
                  <RewardItemDisplay
                    key={item.id + idx}
                    item={item}
                    isHighlighted={isHighlighted}
                  />
                ))}
              </div>
            )}

            {storyEvent.resourceDelta &&
              Object.keys(storyEvent.resourceDelta).filter(k => k !== 'rewardItems').length > 0 && (
                <ResourceDeltaDisplay
                  resourceDelta={storyEvent.resourceDelta}
                  isHighlighted={isHighlighted}
                />
              )}
          </div>
        )
      })}
      <button
        onClick={() => {
          if (feedRef.current) {
            feedRef.current.scrollTo({ top: 0, behavior: 'auto' })
          }
        }}
        className="sticky bottom-0 left-0 right-0 w-full p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm text-center"
      >
        Scroll to top
      </button>
    </div>
  )
}
