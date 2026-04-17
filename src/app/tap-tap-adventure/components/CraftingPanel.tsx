'use client'
import { useState } from 'react'

import { CRAFTING_RECIPES, CraftingRecipe } from '@/app/tap-tap-adventure/config/craftingRecipes'
import { canCraft } from '@/app/tap-tap-adventure/lib/craftingEngine'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { Item } from '@/app/tap-tap-adventure/models/types'

function countAvailableByType(inventory: Item[], type: Item['type']): number {
  return inventory
    .filter(item => item.status !== 'deleted' && item.type === type)
    .reduce((sum, item) => sum + (item.quantity ?? 1), 0)
}

function RecipeCard({
  recipe,
  inventory,
  gold,
  onCraft,
}: {
  recipe: CraftingRecipe
  inventory: Item[]
  gold: number
  onCraft: (recipeId: string) => void
}) {
  const craftable = canCraft(recipe, inventory, gold)

  return (
    <div className="bg-[#1e1f30] border border-[#3a3c56] p-4 rounded-lg space-y-2 mb-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold text-white">{recipe.name}</div>
        <span className="text-xs px-2 py-0.5 bg-yellow-900/50 text-yellow-400 border border-yellow-700/50 rounded whitespace-nowrap">
          {recipe.goldCost}g
        </span>
      </div>
      <div className="text-xs text-gray-400">{recipe.description}</div>

      <div className="space-y-1">
        <div className="text-xs text-gray-500 uppercase font-semibold">Ingredients</div>
        {recipe.ingredients.map((ingredient, idx) => {
          const available = countAvailableByType(inventory, ingredient.type)
          const met = available >= ingredient.quantity
          return (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <span className={met ? 'text-green-400' : 'text-red-400'}>
                {met ? '✓' : '✗'}
              </span>
              <span className={met ? 'text-gray-300' : 'text-gray-500'}>
                {ingredient.quantity}x {ingredient.type === 'spell_scroll' ? 'spell scroll' : ingredient.type}
                {' '}
                <span className={met ? 'text-green-500' : 'text-red-500'}>
                  ({available}/{ingredient.quantity})
                </span>
              </span>
            </div>
          )
        })}
        <div className="flex items-center gap-2 text-xs">
          <span className={gold >= recipe.goldCost ? 'text-green-400' : 'text-red-400'}>
            {gold >= recipe.goldCost ? '✓' : '✗'}
          </span>
          <span className={gold >= recipe.goldCost ? 'text-gray-300' : 'text-gray-500'}>
            {recipe.goldCost}g gold
            {' '}
            <span className={gold >= recipe.goldCost ? 'text-green-500' : 'text-red-500'}>
              ({gold}/{recipe.goldCost})
            </span>
          </span>
        </div>
      </div>

      <div className="text-xs text-gray-500 uppercase font-semibold pt-1">Result</div>
      <div className="text-xs text-emerald-400">
        {recipe.result.name}
        {recipe.result.effects && Object.entries(recipe.result.effects).filter(([, v]) => v !== undefined && v !== 0).length > 0 && (
          <span className="ml-1 text-gray-400">
            ({Object.entries(recipe.result.effects)
              .filter(([, v]) => v !== undefined && v !== 0)
              .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${k}`)
              .join(', ')})
          </span>
        )}
      </div>

      <button
        disabled={!craftable}
        onClick={() => onCraft(recipe.id)}
        className={`w-full mt-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
          craftable
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
            : 'bg-[#2a2b3f] text-gray-600 cursor-not-allowed border border-[#3a3c56]'
        }`}
      >
        Craft
      </button>
    </div>
  )
}

export function CraftingPanel() {
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)

  const character = useGameStore(s =>
    s.gameState.characters.find(c => c.id === s.gameState.selectedCharacterId)
  )
  const craftItemAction = useGameStore(s => s.craftItem)

  if (!character) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Crafting Forge</h3>
        <p className="text-gray-400 text-sm">No character selected.</p>
      </div>
    )
  }

  const { inventory, gold } = character

  const handleCraft = (recipeId: string) => {
    const result = craftItemAction(recipeId)
    if (result) {
      setFeedbackSuccess(result.success)
      setFeedbackMessage(result.message)
      setTimeout(() => setFeedbackMessage(null), 3000)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-white">Crafting Forge</h3>
        <p className="text-xs text-gray-500">Combine items to create better gear</p>
      </div>

      {feedbackMessage && (
        <div
          className={`mb-3 p-2 rounded-md text-sm animate-pulse border ${
            feedbackSuccess
              ? 'bg-green-900/50 border-green-700 text-green-300'
              : 'bg-red-900/50 border-red-700 text-red-300'
          }`}
        >
          {feedbackMessage}
        </div>
      )}

      <div>
        {CRAFTING_RECIPES.map(recipe => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            inventory={inventory}
            gold={gold}
            onCraft={handleCraft}
          />
        ))}
      </div>
    </div>
  )
}
