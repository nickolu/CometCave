export type ChangingLine = {
    type: 'solid' | 'broken'
    hasChanges: boolean
}

export type ChangingLines = [
    ChangingLine | undefined,
    ChangingLine | undefined,
    ChangingLine | undefined,
    ChangingLine | undefined,
    ChangingLine | undefined,
    ChangingLine | undefined
]

export type Hexagram = [boolean, boolean, boolean, boolean, boolean, boolean]

export type HexagramDefinition = {
    number: number
    name: string
    description: string
    hexagram: Hexagram
}
