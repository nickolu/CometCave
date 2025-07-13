'use client';

import { useWorkflow } from './components/useWorkflow';
import { useWhowouldwininatorState } from './components/useWhowouldwininatorState';
import { Step01DefineCharacters } from './components/step01-define-characters';
import { Step02ReviewCharacters } from './components/step02-review-characters';
import { Step03DefineScenario } from './components/step03-define-scenario';
import { Step04ViewResults } from './components/step04-view-results';

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
    battleScenario,
    isGeneratingScenario,
    contestResults,
    isGeneratingResults,
    contestStory,
    isGeneratingStory,
    contestImage,
    isGeneratingImage,
    updateCandidate1,
    updateCandidate2,
    generateRandomCharacter,
    generateCharacterDetail,
    updateCharacterDetail,
    updateBattleScenario,
    generateRandomScenario,
    generateContestResults,
    generateContestStory,
    generateContestImage,
  } = useWhowouldwininatorState();

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-screen-lg mt-20">
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
        {currentStep === 2 && (
          <Step03DefineScenario
            candidate1Name={candidate1Name}
            candidate2Name={candidate2Name}
            battleScenario={battleScenario}
            updateBattleScenario={updateBattleScenario}
            generateRandomScenario={generateRandomScenario}
            isGeneratingScenario={isGeneratingScenario}
            onNext={nextStep}
            onPrevious={previousStep}
          />
        )}
        {currentStep === 3 && (
          <Step04ViewResults
            candidate1Name={candidate1Name}
            candidate2Name={candidate2Name}
            candidate1Description={candidate1Description}
            candidate2Description={candidate2Description}
            candidate1Details={candidate1Details}
            candidate2Details={candidate2Details}
            battleScenario={battleScenario}
            contestResults={contestResults}
            isGeneratingResults={isGeneratingResults}
            contestStory={contestStory}
            isGeneratingStory={isGeneratingStory}
            contestImage={contestImage}
            isGeneratingImage={isGeneratingImage}
            generateContestResults={generateContestResults}
            generateContestStory={generateContestStory}
            generateContestImage={generateContestImage}
            onPrevious={previousStep}
          />
        )}
      </div>
    </div>
  );
}
