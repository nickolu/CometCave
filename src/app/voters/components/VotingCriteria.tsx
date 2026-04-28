'use client'

import { Lightbulb, Plus, RefreshCw, Trash2, Vote, Wand2 } from 'lucide-react'
import { useState } from 'react'

import { useGenerateCriteria, useGenerateRandomQuestion } from '@/app/voters/api/hooks'
import { VotingCriteria } from '@/app/voters/types/voting'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface VotingCriteriaProps {
  criteria: VotingCriteria
  onCriteriaChange: (criteria: VotingCriteria) => void
  onNext: () => void
  onBack: () => void
}

export default function VotingCriteriaComponent({
  criteria,
  onCriteriaChange,
  onNext,
  onBack,
}: VotingCriteriaProps) {
  const [newOption, setNewOption] = useState('')
  const [generationTips, setGenerationTips] = useState<string[]>([])

  const generateRandomQuestionMutation = useGenerateRandomQuestion()
  const generateCriteriaMutation = useGenerateCriteria()

  const addOption = () => {
    if (newOption.trim()) {
      onCriteriaChange({
        ...criteria,
        options: [...criteria.options, newOption.trim()],
      })
      setNewOption('')
    }
  }

  const removeOption = (index: number) => {
    onCriteriaChange({
      ...criteria,
      options: criteria.options.filter((_, i) => i !== index),
    })
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...criteria.options]
    newOptions[index] = value
    onCriteriaChange({
      ...criteria,
      options: newOptions,
    })
  }

  const handleGenerateRandomQuestion = () => {
    generateRandomQuestionMutation.mutate(undefined, {
      onSuccess: data => {
        onCriteriaChange({
          question: data.question,
          options: data.suggestedOptions || [],
        })
        setGenerationTips([])
      },
      onError: error => {
        console.error('Error generating random question:', error)
      },
    })
  }

  const handleGenerateCriteria = () => {
    if (!criteria.question.trim()) {
      return
    }

    generateCriteriaMutation.mutate(
      {
        question: criteria.question,
        existingOptions: criteria.options,
      },
      {
        onSuccess: data => {
          onCriteriaChange({
            ...criteria,
            options: data.options,
          })
          setGenerationTips(data.tips || [])
        },
        onError: error => {
          console.error('Error generating criteria:', error)
        },
      }
    )
  }

  const canProceed = criteria.question.trim() && criteria.options.length >= 2

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Define Voting Criteria</h2>
        <p className="text-gray-600">Set the question and available answer options for the vote</p>
      </div>

      <div>
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-on-surface mb-4">
            <Vote className="w-5 h-5" />
            Voting Question
          </h2>
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="question">Question</Label>
              <ChunkyButton
                variant="secondary"
                size="sm"
                onClick={handleGenerateRandomQuestion}
                disabled={generateRandomQuestionMutation.isPending}
                className="bg-transparent text-on-surface-variant border-outline-variant hover:bg-surface-container hover:text-on-surface"
              >
                {generateRandomQuestionMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                Generate Random Question
              </ChunkyButton>
            </div>
            <Textarea
              id="question"
              value={criteria.question}
              onChange={e => onCriteriaChange({ ...criteria, question: e.target.value })}
              placeholder="e.g., Which makes a better pet: cats or dogs?"
              rows={3}
              className="bg-surface-container-highest border-outline-variant text-on-surface mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Answer Options</Label>
              <ChunkyButton
                variant="secondary"
                size="sm"
                onClick={handleGenerateCriteria}
                disabled={generateCriteriaMutation.isPending || !criteria.question.trim()}
                className="bg-transparent text-on-surface-variant border-outline-variant hover:bg-surface-container hover:text-on-surface"
              >
                {generateCriteriaMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lightbulb className="w-4 h-4 mr-2" />
                )}
                Auto-Generate Options
              </ChunkyButton>
            </div>
            <div className="space-y-2 mt-2">
              {criteria.options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option}
                    onChange={e => updateOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="bg-surface-container-highest border-outline-variant text-on-surface mt-1"
                  />
                  <ChunkyButton
                    variant="secondary"
                    size="sm"
                    onClick={() => removeOption(index)}
                    className="bg-transparent text-on-surface-variant border-outline-variant hover:bg-surface-container hover:text-on-surface"
                  >
                    <Trash2 className="w-4 h-4" />
                  </ChunkyButton>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <Input
                  value={newOption}
                  onChange={e => setNewOption(e.target.value)}
                  placeholder="Add new option..."
                  onKeyPress={e => e.key === 'Enter' && addOption()}
                  className="bg-surface-container-highest border-outline-variant text-on-surface mt-1"
                />
                <ChunkyButton
                  variant="secondary"
                  size="sm"
                  onClick={addOption}
                  className="bg-transparent text-on-surface-variant border-outline-variant hover:bg-surface-container hover:text-on-surface"
                >
                  <Plus className="w-4 h-4" />
                </ChunkyButton>
              </div>
            </div>
          </div>

          {generationTips.length > 0 && (
            <div className="p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
              <h4 className="font-medium mb-2 text-blue-300">💡 AI Suggestions:</h4>
              <ul className="text-sm space-y-1 text-blue-200">
                {generationTips.map((tip, index) => (
                  <li key={index}>• {tip}</li>
                ))}
              </ul>
            </div>
          )}

          {criteria.options.length > 0 && (
            <div className="p-4 bg-surface-container-highest rounded-lg">
              <h4 className="font-medium mb-2">Preview:</h4>
              <p className="font-medium">{criteria.question}</p>
              <ul className="mt-2 space-y-1">
                {criteria.options.map((option, index) => (
                  <li key={index} className="text-sm">
                    {index + 1}. {option}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <ChunkyButton
          variant="secondary"
          onClick={onBack}
        >
          Back: Manage Voters
        </ChunkyButton>
        <ChunkyButton
          variant="primary"
          onClick={onNext}
          disabled={!canProceed}
        >
          Next: Start Voting
        </ChunkyButton>
      </div>
    </div>
  )
}
