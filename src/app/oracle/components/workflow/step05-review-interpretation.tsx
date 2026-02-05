import { Hexagram } from '@/app/oracle/components/static-hexagram'
import { ChangingLines, DivinationResult } from '@/app/oracle/types'
import { Typography } from '@/components/ui/typography'

export const Step05ReviewInterpretation = ({
  divinationResult,
}: {
  divinationResult: DivinationResult | null
}) => {
  if (!divinationResult) return null
  return (
    <div>
      <Typography variant="h2">Review Reading</Typography>
    </div>
  )
}
