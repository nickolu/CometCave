import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCcw, Loader2 } from 'lucide-react';

export function Step01DefineCharacters({
  candidate1Name,
  candidate2Name,
  candidate1Description,
  candidate2Description,
  isGeneratingCandidate1,
  isGeneratingCandidate2,
  updateCandidate1,
  updateCandidate2,
  generateRandomCharacter,
  onNext,
}: {
  candidate1Name: string;
  candidate2Name: string;
  candidate1Description: string;
  candidate2Description: string;
  isGeneratingCandidate1: boolean;
  isGeneratingCandidate2: boolean;
  updateCandidate1: (candidate: string | null, description: string | null) => void;
  updateCandidate2: (candidate: string | null, description: string | null) => void;
  generateRandomCharacter: (candidateNumber: 1 | 2) => Promise<void>;
  onNext: () => void;
}) {
  return (
    <>
      <div className="flex flex-row gap-4 mt-10 w-full">
        <div className="flex flex-col gap-2 flex-grow bg-space-dark rounded-lg p-4 w-[35%]">
          <div className="flex flex-row gap-2 justify-between items-center">
            <h2 className="text-2xl font-bold">
              {candidate1Name ? candidate1Name : `Character 1`}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateRandomCharacter(1)}
              disabled={isGeneratingCandidate1}
            >
              {isGeneratingCandidate1 ? (
                <Loader2 className="w-4 h-4 text-space-purple animate-spin" />
              ) : (
                <RefreshCcw className="w-4 h-4 text-space-purple" />
              )}
              Random
            </Button>
          </div>
          <label htmlFor="candidate1">Name:</label>
          <Input
            type="text"
            id="candidate1"
            value={candidate1Name ?? ''}
            onChange={e => updateCandidate1(e.target.value, null)}
            disabled={isGeneratingCandidate1}
          />
          <label htmlFor="candidate1-description">Description:</label>
          <Textarea
            id="candidate1-description"
            value={candidate1Description ?? ''}
            onChange={e => updateCandidate1(null, e.target.value)}
            placeholder="(Optional) Describe your character's appearance, abilities, and personality..."
            className="min-h-[120px] resize-none bg-space-dark"
            disabled={isGeneratingCandidate1}
          />
        </div>

        <div className="text-2xl font-bold mt-8 flex items-center justify-center">
          <span className="text-cream-white">VS</span>
        </div>

        <div className="flex flex-col gap-2 flex-grow bg-space-dark rounded-lg p-4 w-[35%]">
          <div className="flex flex-row gap-2 justify-between items-center">
            <h2 className="text-2xl font-bold">
              {candidate2Name ? candidate2Name : `Character 2`}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateRandomCharacter(2)}
              disabled={isGeneratingCandidate2}
            >
              {isGeneratingCandidate2 ? (
                <Loader2 className="w-4 h-4 text-space-purple animate-spin" />
              ) : (
                <RefreshCcw className="w-4 h-4 text-space-purple" />
              )}
              Random
            </Button>
          </div>
          <label htmlFor="candidate2">Name:</label>
          <Input
            type="text"
            id="candidate2"
            value={candidate2Name ?? ''}
            onChange={e => updateCandidate2(e.target.value, null)}
            disabled={isGeneratingCandidate2}
          />

          <label htmlFor="candidate2-description">Description:</label>
          <Textarea
            id="candidate2-description"
            value={candidate2Description ?? ''}
            onChange={e => updateCandidate2(null, e.target.value)}
            placeholder="(Optional) Describe your character's appearance, abilities, and personality..."
            className="min-h-[120px] resize-none bg-space-dark"
            disabled={isGeneratingCandidate2}
          />
        </div>
      </div>
      <Button
        onClick={onNext}
        disabled={
          !candidate1Name || !candidate2Name || isGeneratingCandidate1 || isGeneratingCandidate2
        }
        className="mt-10 w-full bg-space-purple text-cream-white"
      >
        Next
      </Button>
    </>
  );
}
