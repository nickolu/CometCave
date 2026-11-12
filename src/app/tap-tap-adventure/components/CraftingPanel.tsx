'use client'
import { useEffect, useState } from 'react'

import { CRAFTING_RECIPES, CraftingRecipe } from '@/app/tap-tap-adventure/config/craftingRecipes'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { canCraft } from '@/app/tap-tap-adventure/lib/craftingEngine'
import { Item } from '@/app/tap-tap-adventure/models/types'
import { PaperButton, PlaybillCaption, PlaybillTitle, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

function countAvailableByType(inventory: Item[], type: Item['type']): number {
  return inventory
    .filter(item => item.status !== 'deleted' && item.type === type)
    .reduce((sum, item) => sum + (item.quantity ?? 1), 0)
}

const INGREDIENT_LABEL: Record<string, string> = {
  consumable: 'consumable',
  equipment: 'equipment',
  spell_scroll: 'spell scroll',
  trade_good: 'trade good',
  quest: 'quest item',
  misc: 'sundry',
}

function RecipeRow({
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
  const goldOk = gold >= recipe.goldCost
  const shortfalls = recipe.ingredients.filter(ing => countAvailableByType(inventory, ing.type) < ing.quantity)
  const reason = !craftable
    ? [
        ...shortfalls.map(ing => `${ing.quantity - countAvailableByType(inventory, ing.type)} more ${INGREDIENT_LABEL[ing.type ?? 'misc'] ?? ing.type}`),
        ...(goldOk ? [] : [`${recipe.goldCost - gold} more gold`]),
      ].join(', ')
    : null
  const resultEffects = recipe.result.effects
    ? Object.entries(recipe.result.effects)
        .filter(([, v]) => v !== undefined && v !== 0)
        .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${k}`)
    : []

  return (
    <li className="border-b-2 border-dotted border-ps-ink/40 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-body text-base font-medium leading-tight text-ps-ink">{recipe.name}</p>
          <p className="mt-1 font-body text-xs leading-snug text-ps-ink-soft">{recipe.description}</p>
        </div>
        <Stamp tone="gold" tilt={false} className="shrink-0 font-playbill text-xs normal-case tracking-normal">
          {recipe.goldCost} g
        </Stamp>
      </div>

      <div className="mt-2">
        <PlaybillCaption className="text-xs">Needs</PlaybillCaption>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {recipe.ingredients.map((ingredient, idx) => {
            const available = countAvailableByType(inventory, ingredient.type)
            const met = available >= ingredient.quantity
            return (
              <Stamp key={idx} tone={met ? 'green' : 'red'} tilt={false} title={met ? 'You have enough' : 'Not enough in your pack'}>
                {ingredient.quantity}× {INGREDIENT_LABEL[ingredient.type ?? 'misc'] ?? ingredient.type}
                <span className="opacity-70">{available}/{ingredient.quantity}</span>
              </Stamp>
            )
          })}
          <Stamp tone={goldOk ? 'green' : 'red'} tilt={false} title={goldOk ? 'You can pay' : 'Not enough gold'}>
            {recipe.goldCost} gold <span className="opacity-70">{gold}/{recipe.goldCost}</span>
          </Stamp>
        </div>
      </div>

      <div className="mt-2">
        <PlaybillCaption className="text-xs">Makes</PlaybillCaption>
        <p className="mt-0.5 font-body text-sm text-ps-ink">
          {recipe.result.name}
          {resultEffects.length > 0 && <span className="text-ps-ink-soft"> · {resultEffects.join(', ')}</span>}
        </p>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <PaperButton size="sm" variant={craftable ? 'brass' : 'outline'} disabled={!craftable} onClick={() => onCraft(recipe.id)}>
          Craft
        </PaperButton>
        {reason && <span className="font-body text-xs italic text-ps-ink-soft">Needs {reason}</span>}
      </div>
    </li>
  )
}

export function CraftingPanel() {
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)

  useEffect(() => {
    if (!feedbackMessage) return
    const id = setTimeout(() => setFeedbackMessage(null), 3000)
    return () => clearTimeout(id)
  }, [feedbackMessage])

  const character = useGameStore(s =>
    s.gameState.characters.find(c => c.id === s.gameState.selectedCharacterId)
  )
  const craftItemAction = useGameStore(s => s.craftItem)

  if (!character) {
    return (
      <div>
        <PlaybillTitle size="sm" rules={false} className="text-left">Workbench</PlaybillTitle>
        <p className="mt-2 font-body text-sm italic text-ps-ink-soft">No character selected.</p>
      </div>
    )
  }

  const { inventory, gold } = character

  const handleCraft = (recipeId: string) => {
    const result = craftItemAction(recipeId)
    if (result) {
      setFeedbackSuccess(result.success)
      setFeedbackMessage(result.message)
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-3 border-b-2 border-ps-ink pb-2">
        <div>
          <PlaybillTitle size="sm" rules={false} className="text-left">Workbench</PlaybillTitle>
          <p className="mt-0.5 font-body text-xs text-ps-ink-soft">Combine what you carry into better gear.</p>
        </div>
        <span className="shrink-0 font-playbill text-sm tabular-nums text-ps-ink" title="Your gold">
          {gold} g
        </span>
      </div>

      {feedbackMessage && (
        <p
          role="status"
          className={cn(
            'mt-3 rounded-[2px] border-2 px-2.5 py-1.5 font-body text-sm',
            feedbackSuccess ? 'border-ps-stamp-green text-ps-stamp-green' : 'border-ps-stamp-red text-ps-stamp-red'
          )}
        >
          {feedbackMessage}
        </p>
      )}

      <ul className="m-0 list-none p-0">
        {CRAFTING_RECIPES.map(recipe => (
          <RecipeRow
            key={recipe.id}
            recipe={recipe}
            inventory={inventory}
            gold={gold}
            onCraft={handleCraft}
          />
        ))}
      </ul>
    </div>
  )
}
