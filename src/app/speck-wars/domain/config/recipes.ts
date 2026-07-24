export interface CombineRecipe {
  id: string
  inputs: Array<{ typeId: string; count: number }>
  output:
    | { kind: 'specks'; typeId: string; count: number }
    | { kind: 'building'; buildingTypeId: string }
    | { kind: 'upgrade'; stat: string; delta: number; target: 'all' | string }
  location: 'anywhere' | string
}

export const RECIPES: CombineRecipe[] = []  // populated as new types added
