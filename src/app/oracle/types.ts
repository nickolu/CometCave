export type LineData = {
    type: 'solid' | 'broken'
    hasChanges: boolean
}

export type HexagramData = [
    LineData | undefined,
    LineData | undefined,
    LineData | undefined,
    LineData | undefined,
    LineData | undefined,
    LineData | undefined
]
