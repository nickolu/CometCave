import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Typography } from "@/components/ui/typography"

import { Hexagram } from "./components/hexagram"
import { HexagramData } from "./types"

export const BuildHexagramManually = ({ setHexagramMethod }: { setHexagramMethod: (method: 'generate' | 'build' | null) => void }) => {
    const [hexagramData, setHexagramData] = useState<HexagramData>([
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
    ])
    return <div>
        <div className="flex flex-col space-y-12">
            <Typography variant="h2">Build Hexagram Manually</Typography>
            <Hexagram hexagramData={hexagramData} setHexagramData={setHexagramData} />
            <Button type="button" onClick={() => setHexagramMethod(null)}>Go Back</Button>
        </div>
    </div>
}