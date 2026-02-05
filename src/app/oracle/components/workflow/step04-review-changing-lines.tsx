import { Hexagram } from '@/app/oracle/components/static-hexagram'
import { DivinationResult } from '@/app/oracle/types'
import { Typography } from '@/components/ui/typography'

export const Step04ReviewReading = ({
  divinationResult,
}: {
  divinationResult: DivinationResult | null
}) => {
  if (!divinationResult) return null
  const hexagram1Lines = divinationResult.hexagram1.hexagram
  const changingLines = divinationResult.changingLines
  const hexagram2Lines = divinationResult.hexagram2.hexagram

  return (
    <div className="w-full space-y-8">
      <Typography variant="h2">Here&apos;s Your Reading From the I-Ching</Typography>
      <div>
        <div className="flex mb-4 flex-col items-center gap-2 w-full md:gap-4 md:justify-center md:flex-row ">
          <Typography variant="h5">
            {divinationResult.hexagram1.name} {divinationResult.hexagram1.description} (
            {divinationResult.hexagram1.number})
          </Typography>
          <Typography className="px-4 w-[100px]">becomes</Typography>
          <Typography variant="h5">
            {divinationResult.hexagram2.name} {divinationResult.hexagram2.description} (
            {divinationResult.hexagram2.number})
          </Typography>
        </div>
        <div className="flex gap-4 justify-center scale-75 sm:scale-100">
          <Hexagram hexagram={hexagram1Lines} />
          <div className="flex flex-col gap-4 w-[100px]">
            <div className="h-4 flex items-center justify-center text-2xl">
              {changingLines[0]?.hasChanges ? '→' : ''}
            </div>
            <div className="h-4 flex items-center justify-center text-2xl">
              {changingLines[1]?.hasChanges ? '→' : ''}
            </div>
            <div className="h-4 flex items-center justify-center text-2xl">
              {changingLines[2]?.hasChanges ? '→' : ''}
            </div>
            <div className="h-4 flex items-center justify-center text-2xl">
              {changingLines[3]?.hasChanges ? '→' : ''}
            </div>
            <div className="h-4 flex items-center justify-center text-2xl">
              {changingLines[4]?.hasChanges ? '→' : ''}
            </div>
            <div className="h-4 flex items-center justify-center text-2xl">
              {changingLines[5]?.hasChanges ? '→' : ''}
            </div>
          </div>
          <Hexagram hexagram={hexagram2Lines} />
        </div>
      </div>
    </div>
  )
}
