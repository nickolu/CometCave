import { CRAFTING_RECIPES } from '../config/craftingRecipes'

describe('Crafting recipes', () => {
  it('has at least 22 recipes', () => {
    expect(CRAFTING_RECIPES.length).toBeGreaterThanOrEqual(22)
  })

  it('all recipes have unique IDs', () => {
    const ids = CRAFTING_RECIPES.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all recipes have at least one ingredient', () => {
    for (const recipe of CRAFTING_RECIPES) {
      expect(recipe.ingredients.length).toBeGreaterThan(0)
    }
  })

  it('all recipes have a gold cost >= 0', () => {
    for (const recipe of CRAFTING_RECIPES) {
      expect(recipe.goldCost).toBeGreaterThanOrEqual(0)
    }
  })

  it('all recipes have a result with name and type', () => {
    for (const recipe of CRAFTING_RECIPES) {
      expect(recipe.result.name).toBeTruthy()
      expect(recipe.result.type).toBeTruthy()
    }
  })

  it('includes potion recipes', () => {
    expect(CRAFTING_RECIPES.find(r => r.id === 'mana_elixir')).toBeDefined()
    expect(CRAFTING_RECIPES.find(r => r.id === 'shield_potion')).toBeDefined()
    expect(CRAFTING_RECIPES.find(r => r.id === 'phoenix_salve')).toBeDefined()
  })

  it('includes equipment recipes', () => {
    expect(CRAFTING_RECIPES.find(r => r.id === 'arcane_staff')).toBeDefined()
    expect(CRAFTING_RECIPES.find(r => r.id === 'berserker_gauntlets')).toBeDefined()
    expect(CRAFTING_RECIPES.find(r => r.id === 'diplomats_ring')).toBeDefined()
  })

  it('includes trade recipes', () => {
    expect(CRAFTING_RECIPES.find(r => r.id === 'golden_idol')).toBeDefined()
    expect(CRAFTING_RECIPES.find(r => r.id === 'merchant_bundle')).toBeDefined()
  })
})
