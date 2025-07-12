'use client';

import { useWorkflow } from './components/useWorkflow';
import { useWhowouldwininatorState } from './components/useWhowouldwininatorState';
import { Step01DefineCharacters } from './components/step01-define-characters';
import { Step02ReviewCharacters } from './components/step02-review-characters';

export default function Whowouldwininator() {
  const { currentStep, nextStep, previousStep } = useWorkflow();
  const {
    candidate1Name,
    candidate2Name,
    candidate1Description,
    candidate2Description,
    isGeneratingCandidate1,
    isGeneratingCandidate2,
    candidate1Details,
    candidate2Details,
    candidate1DetailsLoading,
    candidate2DetailsLoading,
    updateCandidate1,
    updateCandidate2,
    generateRandomCharacter,
    generateCharacterDetail,
    updateCharacterDetail,
  } = useWhowouldwininatorState();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="w-full max-w-screen-lg">
        <h1 className="text-4xl font-bold text-center">The Amazing Whowouldwininator</h1>

        {currentStep === 0 && (
          <Step01DefineCharacters
            candidate1Name={candidate1Name}
            candidate2Name={candidate2Name}
            candidate1Description={candidate1Description}
            candidate2Description={candidate2Description}
            isGeneratingCandidate1={isGeneratingCandidate1}
            isGeneratingCandidate2={isGeneratingCandidate2}
            updateCandidate1={updateCandidate1}
            updateCandidate2={updateCandidate2}
            generateRandomCharacter={generateRandomCharacter}
            onNext={nextStep}
          />
        )}
        {currentStep === 1 && (
          <Step02ReviewCharacters
            candidate1Name={candidate1Name}
            candidate2Name={candidate2Name}
            candidate1Description={candidate1Description}
            candidate2Description={candidate2Description}
            candidate1Details={candidate1Details}
            candidate2Details={candidate2Details}
            candidate1DetailsLoading={candidate1DetailsLoading}
            candidate2DetailsLoading={candidate2DetailsLoading}
            generateCharacterDetail={generateCharacterDetail}
            updateCharacterDetail={updateCharacterDetail}
            onNext={nextStep}
            onPrevious={previousStep}
          />
        )}
      </div>
    </div>
  );
}
