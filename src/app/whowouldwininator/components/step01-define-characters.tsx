import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCcw } from 'lucide-react';

export function Step01DefineCharacters({
  candidate1Name,
  candidate2Name,
  candidate1Description,
  candidate2Description,
  updateCandidate1,
  updateCandidate2,
  onNext,
}: {
  candidate1Name: string;
  candidate2Name: string;
  candidate1Description: string;
  candidate2Description: string;
  updateCandidate1: (candidate: string | null, description: string | null) => void;
  updateCandidate2: (candidate: string | null, description: string | null) => void;
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
            <Button variant="outline" size="sm" onClick={() => updateCandidate1(null, null)}>
              <RefreshCcw className="w-4 h-4 text-space-purple" /> Random
            </Button>
          </div>
          <label htmlFor="candidate1">Name:</label>
          <Input
            type="text"
            id="candidate1"
            value={candidate1Name ?? ''}
            onChange={e => updateCandidate1(e.target.value, null)}
          />
          <label htmlFor="candidate1-description">Description:</label>
          <Input
            type="text"
            id="candidate1-description"
            value={candidate1Description ?? ''}
            onChange={e => updateCandidate1(null, e.target.value)}
            className="h-40"
            placeholder="(Optional)"
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
            <Button variant="outline" size="sm" onClick={() => updateCandidate2(null, null)}>
              <RefreshCcw className="w-4 h-4 text-space-purple" /> Random
            </Button>
          </div>
          <label htmlFor="candidate2">Name:</label>
          <Input
            type="text"
            id="candidate2"
            value={candidate2Name ?? ''}
            onChange={e => updateCandidate2(e.target.value, null)}
          />

          <label htmlFor="candidate2-description">Description:</label>
          <Input
            type="text"
            id="candidate2-description"
            value={candidate2Description ?? ''}
            onChange={e => updateCandidate2(null, e.target.value)}
            className="h-40"
            placeholder="(Optional)"
          />
        </div>
      </div>
      <Button
        onClick={onNext}
        disabled={!candidate1Name || !candidate2Name}
        className="mt-10 w-full bg-space-purple text-cream-white"
      >
        Next
      </Button>
    </>
  );
}
