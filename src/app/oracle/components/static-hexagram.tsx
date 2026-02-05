import { Hexagram as HexagramType } from '@/app/oracle/types'
import { cn } from '@/lib/utils'

const lineBg = 'bg-neutral-200'
const lineBorder = 'border-neutral-200'

export const SolidLine = () => {
  return <div className={`w-44 h-4 ${lineBg} opacity-[0.4]`} />
}

export const EmptyLine = () => {
  return <div className={`w-44 h-4 border b-2 ${lineBorder} opacity-[0.4]`} />
}

export const BrokenLine = () => {
  return (
    <div className={`flex items-center justify-center space-x-4 opacity-[0.4]`}>
      <div className={`w-20 h-4 ${lineBg}`} />
      <div className={`w-20 h-4 ${lineBg}`} />
    </div>
  )
}

export const ChangeMarker = ({ hasChanges }: { hasChanges: boolean }) => {
  return (
    <div
      className={cn(
        `w-4 h-4 rounded-full`,
        hasChanges
          ? `${lineBg} opacity-[0.4]`
          : `bg-transparent border b-4 ${lineBorder} opacity-[0.4]`
      )}
    />
  )
}

export const Line = ({ isSolid }: { isSolid: boolean }) => {
  return (
    <>
      {isSolid && <SolidLine />}
      {!isSolid && <BrokenLine />}
    </>
  )
}

export const Hexagram = ({
  hexagram,
}: {
  hexagram: HexagramType // array: [0]=Line 1 (bottom), [5]=Line 6 (top)
}) => {
  const line1 = hexagram[0]
  const line2 = hexagram[1]
  const line3 = hexagram[2]
  const line4 = hexagram[3]
  const line5 = hexagram[4]
  const line6 = hexagram[5]

  return (
    <div className="flex flex-col gap-4 items-center">
      <Line isSolid={line6} />
      <Line isSolid={line5} />
      <Line isSolid={line4} />
      <Line isSolid={line3} />
      <Line isSolid={line2} />
      <Line isSolid={line1} />
    </div>
  )
}
