import { HexagramData, LineData } from "@/app/oracle/types"
import { cn } from "@/lib/utils"

import { TransitionWrapper } from "./ui/transition-wrapper"

const lineColor = 'neutral-200 opacity-[0.4]'

export const SolidLine = () => {
    return <div className={`w-44 h-4 bg-${lineColor} hover:opacity-60 transition-all duration-200 cursor-pointer`} />
}

export const EmptyLine = () => {
    return <div className={`w-44 h-4 border b-2 border-${lineColor} hover:opacity-60 transition-all duration-200 cursor-pointer`} />
}

export const BrokenLine = () => {
    return <div className="flex items-center justify-center space-x-4 cursor-pointer">
        <div className={`w-20 h-4 bg-${lineColor} hover:opacity-60 transition-all duration-200`} />
        <div className={`w-20 h-4 bg-${lineColor} hover:opacity-60 transition-all duration-200`} />
    </div>
}

export const ChangeMarker = ({ hasChanges }: { hasChanges: boolean }) => {
    return <div
        className={
            cn("w-4 h-4 rounded-full cursor-pointer",
                hasChanges ? `bg-${lineColor}` : `bg-transparent border b-4 border-${lineColor} hover:opacity-60`
            )}
    />
}

export const Line = ({ type }: { type: 'solid' | 'broken' | undefined }) => {
    return <>
        {type === 'solid' && <TransitionWrapper><SolidLine /></TransitionWrapper>}
        {type === 'broken' && <TransitionWrapper><BrokenLine /></TransitionWrapper>}
        {type === undefined && <TransitionWrapper><EmptyLine /></TransitionWrapper>}
    </>
}

export const LineControl = ({ lineData, toggleLine, toggleHasChanges }: {
    lineData: LineData | undefined,
    toggleHasChanges: () => void;
    toggleLine: () => void,
}) => {
    return <div className="flex gap-2">
        <div onClick={() => toggleLine()}>
            <Line type={lineData?.type} />
        </div>
        <div onClick={() => toggleHasChanges()}>
            <ChangeMarker hasChanges={Boolean(lineData?.hasChanges)} />
        </div>
    </div>
}


export const Hexagram = (
    {
        hexagramData,
        setHexagramData
    }:
        {
            hexagramData: HexagramData,
            setHexagramData: (hexagramData: HexagramData) => void
        }) => {

    const line1 = hexagramData[0]
    const line2 = hexagramData[1]
    const line3 = hexagramData[2]
    const line4 = hexagramData[3]
    const line5 = hexagramData[4]
    const line6 = hexagramData[5]

    const toggleLine = (lineIndex: number) => {
        const updatedHexagramData: HexagramData = [...hexagramData]
        if (updatedHexagramData[lineIndex] === undefined) {
            updatedHexagramData[lineIndex] = { type: 'solid', hasChanges: false }
        } else if (updatedHexagramData[lineIndex].type === 'solid') {
            updatedHexagramData[lineIndex].type = 'broken'
        } else {
            updatedHexagramData[lineIndex].type = 'solid'
        }
        setHexagramData(updatedHexagramData)
    }

    const toggleHasChanges = (lineIndex: number) => {
        const updatedHexagramData: HexagramData = [...hexagramData]
        if (updatedHexagramData[lineIndex] === undefined) {
            return
        }

        updatedHexagramData[lineIndex].hasChanges = !updatedHexagramData[lineIndex].hasChanges
        setHexagramData(updatedHexagramData)
    }

    return <div className="flex flex-col gap-4 items-center">

        <LineControl
            lineData={line1}
            toggleLine={() => toggleLine(0)}
            toggleHasChanges={() => toggleHasChanges(0)}
        />
        <LineControl
            lineData={line2}
            toggleLine={() => toggleLine(1)}
            toggleHasChanges={() => toggleHasChanges(1)}
        />
        <LineControl
            lineData={line3}
            toggleLine={() => toggleLine(2)}
            toggleHasChanges={() => toggleHasChanges(2)}
        />
        <LineControl
            lineData={line4}
            toggleLine={() => toggleLine(3)}
            toggleHasChanges={() => toggleHasChanges(3)}
        />
        <LineControl
            lineData={line5}
            toggleLine={() => toggleLine(4)}
            toggleHasChanges={() => toggleHasChanges(4)}
        />
        <LineControl
            lineData={line6}
            toggleLine={() => toggleLine(5)}
            toggleHasChanges={() => toggleHasChanges(5)}
        />

    </div>

}