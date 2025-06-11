'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Plus, Trash2, Vote, Wand2, Lightbulb, RefreshCw } from 'lucide-react';
import { VotingCriteria } from '@/types/voting';

interface VotingCriteriaProps {
  criteria: VotingCriteria;
  onCriteriaChange: (criteria: VotingCriteria) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function VotingCriteriaComponent({
  criteria,
  onCriteriaChange,
  onNext,
  onBack,
}: VotingCriteriaProps) {
  const [newOption, setNewOption] = useState('');
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [isGeneratingCriteria, setIsGeneratingCriteria] = useState(false);
  const [generationTips, setGenerationTips] = useState<string[]>([]);

  const addOption = () => {
    if (newOption.trim()) {
      onCriteriaChange({
        ...criteria,
        options: [...criteria.options, newOption.trim()],
      });
      setNewOption('');
    }
  };

  const removeOption = (index: number) => {
    onCriteriaChange({
      ...criteria,
      options: criteria.options.filter((_, i) => i !== index),
    });
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...criteria.options];
    newOptions[index] = value;
    onCriteriaChange({
      ...criteria,
      options: newOptions,
    });
  };

  const generateRandomQuestion = async () => {
    setIsGeneratingQuestion(true);
    try {
      const response = await fetch('/api/v1/voters/generate-random-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate random question');
      }

      const data = await response.json();
      onCriteriaChange({
        question: data.question,
        options: data.suggestedOptions || [],
      });
      setGenerationTips([]);
    } catch (error) {
      console.error('Error generating random question:', error);
    } finally {
      setIsGeneratingQuestion(false);
    }
  };

  const generateCriteria = async () => {
    if (!criteria.question.trim()) {
      return;
    }

    setIsGeneratingCriteria(true);
    try {
      const response = await fetch('/api/v1/voters/generate-criteria', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: criteria.question,
          existingOptions: criteria.options,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate criteria');
      }

      const data = await response.json();
      onCriteriaChange({
        ...criteria,
        options: data.options,
      });
      setGenerationTips(data.tips || []);
    } catch (error) {
      console.error('Error generating criteria:', error);
    } finally {
      setIsGeneratingCriteria(false);
    }
  };

  const canProceed = criteria.question.trim() && criteria.options.length >= 2;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Define Voting Criteria</h2>
        <p className="text-gray-600">Set the question and available answer options for the vote</p>
      </div>

      <div>
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-cream-white mb-4">
            <Vote className="w-5 h-5" />
            Voting Question
          </h2>
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="question">Question</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={generateRandomQuestion}
                disabled={isGeneratingQuestion}
                className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white"
              >
                {isGeneratingQuestion ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                Generate Random Question
              </Button>
            </div>
            <Textarea
              id="question"
              value={criteria.question}
              onChange={e => onCriteriaChange({ ...criteria, question: e.target.value })}
              placeholder="e.g., Which makes a better pet: cats or dogs?"
              rows={3}
              className="bg-slate-800 border-slate-700 text-cream-white mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Answer Options</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={generateCriteria}
                disabled={isGeneratingCriteria || !criteria.question.trim()}
                className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white"
              >
                {isGeneratingCriteria ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lightbulb className="w-4 h-4 mr-2" />
                )}
                Auto-Generate Options
              </Button>
            </div>
            <div className="space-y-2 mt-2">
              {criteria.options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option}
                    onChange={e => updateOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="bg-slate-800 border-slate-700 text-cream-white mt-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeOption(index)}
                    className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <Input
                  value={newOption}
                  onChange={e => setNewOption(e.target.value)}
                  placeholder="Add new option..."
                  onKeyPress={e => e.key === 'Enter' && addOption()}
                  className="bg-slate-800 border-slate-700 text-cream-white mt-1"
                />
                <Button
                  onClick={addOption}
                  variant="outline"
                  size="sm"
                  className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white"
                >
                  <Plus className="w-4 h-4" />
                </Button>
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
            <div className="p-4 bg-slate-900/50 rounded-lg">
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
        <Button
          variant="outline"
          onClick={onBack}
          className="bg-transparent text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-cream-white"
        >
          Back: Manage Voters
        </Button>
        <Button
          onClick={onNext}
          disabled={!canProceed}
          className="bg-space-purple text-cream-white hover:bg-space-purple/90"
        >
          Next: Start Voting
        </Button>
      </div>
    </div>
  );
}
