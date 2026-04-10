'use client'

import { LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { useMoveForwardMutation } from '@/app/tap-tap-adventure/hooks/useMoveForwardMutation'
import { useResolveDecisionMutation } from '@/app/tap-tap-adventure/hooks/useResolveDecisionMutation'
import { getGenericTravelMessage } from '@/app/tap-tap-adventure/lib/getGenericTravelMessage'
import { flipCoin } from '@/app/utils'

import { CombatUI, CombatResult } from './CombatUI'
import { EquipmentPanel } from './EquipmentPanel'
import { InventoryPanel } from './InventoryPanel'
import { LevelUpCelebration } from './LevelUpCelebration'
import { ShopUI } from './ShopUI'
import { StoryFeed } from './StoryFeed'

function getTravelButtonMessage({ isLoading, distance }: { isLoading: boolean; distance: number }) {
  if (isLoading)
    return (
      <div className="flex items-center justify-center gap-2 w-full">
        <LoaderCircle className="animate-spin h-5 w-5" />
        <span>Searching for adventure...</span>
      </div>
    )
  if (distance === 0) return 'Start Your Adventure'
  return 'Continue Travelling'
}
export default function GameUI() {
  const {
    gameState,
    getSelectedCharacter,
    setGenericMessage,
    incrementDistance,
    setDecisionPoint,
    setCombatState,
  } = useGameStore()

  const { mutate: moveForwardMutation, isPending: moveForwardPending } = useMoveForwardMutation()
  const { mutate: resolveDecisionMutation, isPending: resolveDecisionPending } =
    useResolveDecisionMutation()

  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null)
  const prevLevelRef = useRef<number | null>(null)
  const character = getSelectedCharacter()

  useEffect(() => {
    if (!character) return
    const currentLevel = character.level
    if (prevLevelRef.current !== null && currentLevel > prevLevelRef.current) {
      setLevelUpLevel(currentLevel)
    }
    prevLevelRef.current = currentLevel
  }, [character?.level])

  const dismissLevelUp = useCallback(() => setLevelUpLevel(null), [])

  const handleResolveDecision = (optionId: string) => {
    resolveDecisionMutation({
      decisionPoint: gameState.decisionPoint!,
      optionId: optionId,
      onSuccess: () => {
        setDecisionPoint(null)
      },
    })
  }

  if (!gameState) return <div className="p-4 text-center">No game found.</div>

  const { selectedCharacterId, storyEvents } = gameState

  if (!selectedCharacterId) {
    return <div>please select a character</div>
  }

  const handleMoveForward = () => {
    const shouldDoNothing = flipCoin(0.75, 0.25)
    if (shouldDoNothing) {
      const genericMessage = getGenericTravelMessage()
      setGenericMessage(genericMessage)
      incrementDistance()
    } else {
      moveForwardMutation()
    }
  }

  return (
    <>
      {levelUpLevel !== null && (
        <LevelUpCelebration level={levelUpLevel} onDismiss={dismissLevelUp} />
      )}
    <div className="flex flex-col select-none">
      <div className="relative z-10 mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          <div className={'p-4 bg-[#161723] border border-[#3a3c56] rounded-lg space-y-4 overflow-hidden'}>
            {/* Combat UI takes priority */}
            {gameState.combatState && gameState.combatState.status === 'active' ? (
              <CombatUI combatState={gameState.combatState} />
            ) : gameState.combatState && gameState.combatState.status !== 'active' ? (
              <CombatResult
                combatState={gameState.combatState}
                onContinue={() => setCombatState(null)}
              />
            ) : gameState.shopState?.isOpen ? (
              <ShopUI />
            ) : gameState.decisionPoint ? (
              <>
                <h4 className="font-semibold w-full text-center uppercase border-b border-[#3a3c56] pb-2 mb-4">
                  Event
                </h4>
                {!gameState.decisionPoint.resolved && (
                  <div>
                    <div className="font-semibold mb-6 break-words">{gameState.decisionPoint.prompt}</div>
                    {resolveDecisionPending ? (
                      <div className="flex flex-col items-center gap-3 py-6 text-slate-400">
                        <LoaderCircle className="animate-spin h-6 w-6" />
                        <span className="text-sm">Resolving your choice...</span>
                      </div>
                    ) : (
                      <div className="space-y-2 mt-2">
                        {gameState.decisionPoint.options.map((option: { id: string; text: string }) => {
                          if (!option) return null
                          if (!gameState.decisionPoint) return null
                          return (
                            <Button
                              key={option.id}
                              className="block w-full text-left whitespace-normal h-auto border border-[#3a3c56] bg-[#2a2b3f] hover:bg-[#3a3c56] text-white px-3 py-2 mt-2 rounded disabled:opacity-60"
                              disabled={resolveDecisionPending}
                              onClick={() => {
                                handleResolveDecision(option.id)
                              }}
                            >
                              {option.text}
                            </Button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <Button
                  className={`w-full border text-white font-bold text-lg py-6 rounded-lg transition-all duration-300 select-none ${
                    moveForwardPending
                      ? 'bg-gradient-to-r from-indigo-800 to-purple-800 border-indigo-500/20 shadow-none animate-pulse cursor-wait'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-indigo-400/30 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 active:translate-y-0.5 active:shadow-none'
                  }`}
                  onClick={handleMoveForward}
                  disabled={moveForwardPending || resolveDecisionPending}
                >
                  {getTravelButtonMessage({
                    isLoading: moveForwardPending,
                    distance: getSelectedCharacter()?.distance ?? 0,
                  })}
                </Button>
                {gameState.genericMessage && (
                  <div className="text-sm">{gameState.genericMessage}</div>
                )}
                <div className="select-text">
                  <StoryFeed events={storyEvents} filterCharacterId={selectedCharacterId} />
                </div>
              </>
            )}
          </div>
          {/* Right column: Equipment & Inventory Panel */}
          <div className="p-4 bg-[#161723] border border-[#3a3c56] rounded-lg space-y-4 h-fit md:sticky md:top-8">
            <EquipmentPanel
              equipment={getSelectedCharacter()?.equipment ?? { weapon: null, armor: null, accessory: null }}
            />
            <div className="border-t border-[#3a3c56] pt-4">
              <InventoryPanel inventory={getSelectedCharacter()?.inventory ?? []} />
            </div>
          </div>
        </div>
        {/* Two-column grid END */}
      </div>
      {/* Main content wrapper END */}
    </div>
    </>
  )
}
