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
    <div className="space-y-6 mt-6">
      {/* Mobile and Desktop Layout */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-4 w-full">
        {/* Character 1 */}
        <div className="flex flex-col gap-4 flex-grow bg-space-dark rounded-lg p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
            <h2 className="text-xl sm:text-2xl font-bold text-cream-white">
              {candidate1Name ? candidate1Name : `Character 1`}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateRandomCharacter(1)}
              disabled={isGeneratingCandidate1}
              className="self-start sm:self-auto"
            >
              {isGeneratingCandidate1 ? (
                <Loader2 className="w-4 h-4 text-space-purple animate-spin" />
              ) : (
                <RefreshCcw className="w-4 h-4 text-space-purple" />
              )}
              <span className="ml-2">Random</span>
            </Button>
          </div>

          <div className="space-y-2">
            <label htmlFor="candidate1" className="text-sm font-medium text-cream-white">
              Name:
            </label>
            <Input
              type="text"
              id="candidate1"
              value={candidate1Name ?? ''}
              onChange={e => updateCandidate1(e.target.value, null)}
              disabled={isGeneratingCandidate1}
              className="bg-space-dark border-space-purple/30"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="candidate1-description"
              className="text-sm font-medium text-cream-white"
            >
              Description:
            </label>
            <Textarea
              id="candidate1-description"
              value={candidate1Description ?? ''}
              onChange={e => updateCandidate1(null, e.target.value)}
              placeholder="(Optional) Describe your character's appearance, abilities, and personality..."
              className="min-h-[100px] sm:min-h-[120px] resize-none bg-space-dark border-space-purple/30"
              disabled={isGeneratingCandidate1}
            />
          </div>
        </div>

        {/* VS Divider */}
        <div className="flex items-center justify-center lg:flex-col lg:justify-center lg:px-2">
          <div className="text-xl sm:text-2xl font-bold text-cream-white bg-space-purple/20 px-4 py-2 rounded-full">
            VS
          </div>
        </div>

        {/* Character 2 */}
        <div className="flex flex-col gap-4 flex-grow bg-space-dark rounded-lg p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
            <h2 className="text-xl sm:text-2xl font-bold text-cream-white">
              {candidate2Name ? candidate2Name : `Character 2`}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateRandomCharacter(2)}
              disabled={isGeneratingCandidate2}
              className="self-start sm:self-auto"
            >
              {isGeneratingCandidate2 ? (
                <Loader2 className="w-4 h-4 text-space-purple animate-spin" />
              ) : (
                <RefreshCcw className="w-4 h-4 text-space-purple" />
              )}
              <span className="ml-2">Random</span>
            </Button>
          </div>

          <div className="space-y-2">
            <label htmlFor="candidate2" className="text-sm font-medium text-cream-white">
              Name:
            </label>
            <Input
              type="text"
              id="candidate2"
              value={candidate2Name ?? ''}
              onChange={e => updateCandidate2(e.target.value, null)}
              disabled={isGeneratingCandidate2}
              className="bg-space-dark border-space-purple/30"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="candidate2-description"
              className="text-sm font-medium text-cream-white"
            >
              Description:
            </label>
            <Textarea
              id="candidate2-description"
              value={candidate2Description ?? ''}
              onChange={e => updateCandidate2(null, e.target.value)}
              placeholder="(Optional) Describe your character's appearance, abilities, and personality..."
              className="min-h-[100px] sm:min-h-[120px] resize-none bg-space-dark border-space-purple/30"
              disabled={isGeneratingCandidate2}
            />
          </div>
        </div>
      </div>

      {/* Next Button */}
      <Button
        onClick={onNext}
        disabled={
          !candidate1Name || !candidate2Name || isGeneratingCandidate1 || isGeneratingCandidate2
        }
        className="w-full bg-space-purple text-cream-white hover:bg-space-purple/90 py-3"
      >
        Next: Review Characters
      </Button>
    </div>
  );
}
