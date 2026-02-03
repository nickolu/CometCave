import { Button } from "@/components/ui/button"
import { Typography } from "@/components/ui/typography"

export const GenerateHexagram = ({ setHexagramMethod }: { setHexagramMethod: (method: 'generate' | 'build' | null) => void }) => {
    return <div>
        <Typography variant="h2">Generate Hexagram with Divination</Typography>
        <Button type="button" onClick={() => setHexagramMethod(null)}>Go Back</Button>
    </div>
}