import { GRID_COLS, GRID_ROWS, GRID_CELL_SIZE } from '../constants'

export class SpatialGrid {
  // cells[cellIndex] = array of speck array indices
  private cells: number[][]

  constructor() {
    this.cells = Array.from({ length: GRID_COLS * GRID_ROWS }, () => [])
  }

  clear() {
    for (const cell of this.cells) cell.length = 0
  }

  insert(i: number, x: number, y: number) {
    const col = Math.floor(x / GRID_CELL_SIZE)
    const row = Math.floor(y / GRID_CELL_SIZE)
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return
    this.cells[row * GRID_COLS + col].push(i)
  }

  // Returns array indices of all specks in the cell at (x,y) and 8 neighbors
  query(x: number, y: number): number[] {
    const col = Math.floor(x / GRID_CELL_SIZE)
    const row = Math.floor(y / GRID_CELL_SIZE)
    const results: number[] = []
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = col + dc, r = row + dr
        if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) continue
        const cell = this.cells[r * GRID_COLS + c]
        for (const idx of cell) results.push(idx)
      }
    }
    return results
  }
}
