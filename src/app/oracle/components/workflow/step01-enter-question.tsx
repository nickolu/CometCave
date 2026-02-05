import { TextField } from '@mui/material'

import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

export const Step01EnterQuestion = ({
  divinationQuestion,
  setDivinationQuestion,
  onNext,
}: {
  divinationQuestion: string
  setDivinationQuestion: (divinationQuestion: string) => void
  onNext: () => void
}) => {
  return (
    <div className="space-y-8">
      <div>
        <Typography variant="h2">Ask the Oracle</Typography>
        <Typography>
          Enter any question and get an answer from the Oracle using the I Ching.
        </Typography>
      </div>
      <TextField
        minRows={4}
        multiline
        value={divinationQuestion}
        onChange={e => setDivinationQuestion(e.target.value)}
        placeholder="Enter a question for the Oracle"
        className="w-full bg-slate-800 border-slate-700 text-cream-white mt-1"
      />
      <Button type="button" disabled={!divinationQuestion} onClick={onNext}>
        Next
      </Button>
    </div>
  )
}
