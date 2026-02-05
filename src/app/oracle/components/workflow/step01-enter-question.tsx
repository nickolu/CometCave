import { TextField } from '@mui/material'

import { DivinationQuestion } from '@/app/oracle/types'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

export const Step01EnterQuestion = ({
  divinationQuestion,
  setDivinationQuestion,
  onNext,
}: {
  divinationQuestion: DivinationQuestion
  setDivinationQuestion: (divinationQuestion: DivinationQuestion) => void
  onNext: () => void
}) => {
  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <Typography variant="h2">Ask the Oracle</Typography>
        <Typography>
          Enter your question and any relevant context to receive guidance from the I-Ching.
        </Typography>
      </div>
      <div className="space-y-4">
        <div>
          <Typography variant="h5" className="mb-2">
            Your Question
          </Typography>
          <TextField
            minRows={2}
            multiline
            value={divinationQuestion.question}
            onChange={e =>
              setDivinationQuestion({ ...divinationQuestion, question: e.target.value })
            }
            placeholder="What guidance do you seek?"
            className="w-full bg-slate-800 border-slate-700 text-cream-white"
          />
        </div>
        <div>
          <Typography variant="h5" className="mb-2">
            Additional Context (Optional)
          </Typography>
          <Typography variant="body2" className="mb-2 text-muted-foreground">
            Providing context helps generate a more personalized interpretation. Share relevant
            background, your current situation, or what led you to ask this question.
          </Typography>
          <TextField
            minRows={4}
            multiline
            value={divinationQuestion.context}
            onChange={e =>
              setDivinationQuestion({ ...divinationQuestion, context: e.target.value })
            }
            placeholder="Share any relevant context about your situation..."
            className="w-full bg-slate-800 border-slate-700 text-cream-white"
          />
        </div>
      </div>
      <Button type="button" disabled={!divinationQuestion.question.trim()} onClick={onNext}>
        Next
      </Button>
    </div>
  )
}
