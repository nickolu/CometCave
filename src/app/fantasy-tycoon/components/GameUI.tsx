'use client'

import { LoaderCircle } from 'lucide-react'
import { useEffect } from 'react'

import { Button } from '@/app/fantasy-tycoon/components/ui/button'
import { useGameStore } from '@/app/fantasy-tycoon/hooks/useGameStore'
import { useMoveForwardMutation } from '@/app/fantasy-tycoon/hooks/useMoveForwardMutation'
import { useResolveDecisionMutation } from '@/app/fantasy-tycoon/hooks/useResolveDecisionMutation'
import { getGenericTravelMessage } from '@/app/fantasy-tycoon/lib/getGenericTravelMessage'
import { flipCoin } from '@/app/utils'

import { InventoryPanel } from './InventoryPanel'
import { StoryFeed } from './StoryFeed'

function getTravelButtonMessage({ isLoading, distance }: { isLoading: boolean; distance: number }) {
  if (isLoading)
    return (
      <div className="flex items-center mr-2 text-xs justify-center gap-2 w-full">
        <LoaderCircle className="animate-spin" /> Loading...
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
  } = useGameStore()

  const { mutate: moveForwardMutation, isPending: moveForwardPending } = useMoveForwardMutation()
  const { mutate: resolveDecisionMutation, isPending: resolveDecisionPending } =
    useResolveDecisionMutation()

  useEffect(() => {
    if (typeof window !== 'undefined' && gameState) {
    }
  }, [gameState])

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
    const shouldDoNothing = flipCoin(0.05, 0.95)
    if (shouldDoNothing) {
      const genericMessage = getGenericTravelMessage()
      setGenericMessage(genericMessage)
      incrementDistance()
    } else {
      moveForwardMutation()
    }
  }

  return (
    <div className="flex flex-col">
      <div className="relative z-10 mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          <div className={'p-4 bg-[#161723] border border-[#3a3c56] rounded-lg space-y-4'}>
            {gameState.decisionPoint ? (
              <h4 className="font-semibold w-full text-center uppercase border-b border-[#3a3c56] pb-2 mb-4">
                Event
              </h4>
            ) : (
              <Button
                className="w-full bg-[#2a2b3f] border border-[#3a3c56] hover:bg-[#3a3c56] text-white hover:shadow-md transition-all duration-300 active:translate-y-1/8 active:ring-1 active:ring-[#515375]"
                style={{ userSelect: 'none' }}
                onClick={handleMoveForward}
                disabled={moveForwardPending || resolveDecisionPending}
              >
                {getTravelButtonMessage({
                  isLoading: moveForwardPending,
                  distance: getSelectedCharacter()?.distance ?? 0,
                })}
              </Button>
            )}
            {resolveDecisionPending && (
              <div className="text-xs text-gray-500 mt-2">Resolving...</div>
            )}
            {gameState.decisionPoint && !gameState.decisionPoint.resolved && (
              <div>
                <div className="font-semibold mb-6">{gameState.decisionPoint.prompt}</div>
                <div className="space-y-2 mt-2">
                  {gameState.decisionPoint.options.map((option: { id: string; text: string }) => {
                    if (!option) return null
                    if (!gameState.decisionPoint) return null
                    return (
                      <Button
                        key={option.id}
                        className="block w-full text-left border border-[#3a3c56] bg-[#2a2b3f] hover:bg-[#3a3c56] text-white px-3 py-2 mt-2 rounded disabled:opacity-60"
                        style={{ userSelect: 'none' }}
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
                {resolveDecisionPending && (
                  <div className="text-xs text-gray-500 mt-2">Resolving...</div>
                )}
              </div>
            )}
            {gameState.genericMessage && !gameState.decisionPoint && (
              <div className="text-sm">{gameState.genericMessage}</div>
            )}
            {!gameState.decisionPoint && (
              <StoryFeed events={storyEvents} filterCharacterId={selectedCharacterId} />
            )}
          </div>
          {/* Right column: Inventory Panel */}
          <div className="p-4 bg-[#161723] border border-[#3a3c56] rounded-lg space-y-4 h-fit md:sticky md:top-8">
            <h4 className="font-semibold w-full text-center uppercase border-b border-[#3a3c56] pb-2 mb-4">
              Inventory
            </h4>
            <InventoryPanel inventory={getSelectedCharacter()?.inventory ?? []} />
          </div>
        </div>
        {/* Two-column grid END */}
      </div>
      {/* Main content wrapper END */}
    </div>
  )
}
