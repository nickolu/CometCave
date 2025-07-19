'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Trophy, Target, Zap, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface ContestResults {
  winner: 'candidate1' | 'candidate2' | 'tie';
  confidence: number;
  reasoning: string;
}

interface ContestStory {
  story: string;
  intro: string;
  climax: string;
  ending: string;
}

interface ContestImage {
  imageUrl: string;
  altText: string;
  prompt: string;
}

interface StorySectionImage {
  imageUrl: string;
  altText: string;
  prompt: string;
  sectionType: 'intro' | 'climax' | 'ending';
}

interface CharacterStats {
  strength: number;
  speed: number;
  durability: number;
  intelligence: number;
  specialAbilities: number;
  fighting: number;
}

interface CharacterDetails {
  backstory: string;
  powers: string[];
  stats: CharacterStats;
  feats: string[];
  portrait: {
    imageUrl: string;
    altText: string;
    prompt: string;
  } | null;
}

interface BattleScenario {
  setting: string;
  rules: string;
  obstacles: string;
  limitations: string;
  additionalContext: string;
}

export function Step04ViewResults({
  candidate1Name,
  candidate2Name,
  candidate1Description,
  candidate2Description,
  candidate1Details,
  candidate2Details,
  battleScenario,
  contestResults,
  isGeneratingResults,
  contestStory,
  isGeneratingStory,
  contestImage,
  isGeneratingImage,
  storySectionImages,
  isGeneratingSectionImages,
  generateContestResults,
  generateContestStory,
  generateContestImage,
  generateStorySectionImage,
  onPrevious,
}: {
  candidate1Name: string;
  candidate2Name: string;
  candidate1Description: string;
  candidate2Description: string;
  candidate1Details: Partial<CharacterDetails>;
  candidate2Details: Partial<CharacterDetails>;
  battleScenario: BattleScenario;
  contestResults: ContestResults | null;
  isGeneratingResults: boolean;
  contestStory: ContestStory | null;
  isGeneratingStory: boolean;
  contestImage: ContestImage | null;
  isGeneratingImage: boolean;
  storySectionImages: {
    intro: StorySectionImage | null;
    climax: StorySectionImage | null;
    ending: StorySectionImage | null;
  };
  isGeneratingSectionImages: {
    intro: boolean;
    climax: boolean;
    ending: boolean;
  };
  generateContestResults: () => Promise<void>;
  generateContestStory: () => Promise<void>;
  generateContestImage: () => Promise<void>;
  generateStorySectionImage: (sectionType: 'intro' | 'climax' | 'ending') => Promise<void>;
  onPrevious: () => void;
}) {
  // Use refs to track if we've already initiated generation to prevent infinite loops
  const resultsGenerationInitiated = useRef(false);
  const storyGenerationInitiated = useRef(false);
  const imageGenerationInitiated = useRef(false);

  // Reset refs when results are cleared (e.g., when starting over)
  useEffect(() => {
    if (!contestResults) {
      resultsGenerationInitiated.current = false;
      storyGenerationInitiated.current = false;
      imageGenerationInitiated.current = false;
    }
  }, [contestResults]);

  // Auto-generate results when component mounts
  useEffect(() => {
    if (!contestResults && !isGeneratingResults && !resultsGenerationInitiated.current) {
      resultsGenerationInitiated.current = true;
      generateContestResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestResults, isGeneratingResults]);

  // Auto-generate story after results are available
  useEffect(() => {
    if (
      contestResults &&
      !contestStory &&
      !isGeneratingStory &&
      !storyGenerationInitiated.current
    ) {
      storyGenerationInitiated.current = true;
      generateContestStory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestResults, contestStory, isGeneratingStory]);

  // Manual image generation function
  const handleGenerateImage = () => {
    if (!imageGenerationInitiated.current) {
      imageGenerationInitiated.current = true;
      generateContestImage();
    }
  };

  const getWinnerDisplay = () => {
    if (!contestResults) return null;

    switch (contestResults.winner) {
      case 'candidate1':
        return {
          name: candidate1Name,
          description: candidate1Description,
          details: candidate1Details,
        };
      case 'candidate2':
        return {
          name: candidate2Name,
          description: candidate2Description,
          details: candidate2Details,
        };
      case 'tie':
        return null;
    }
  };

  const winnerDisplay = getWinnerDisplay();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-400 mb-2 mt-6">Battle Results</h2>
        <p className="text-gray-300">
          {candidate1Name} vs {candidate2Name}
        </p>
      </div>

      {/* Loading State */}
      {isGeneratingResults && (
        <div className="bg-space-dark rounded-lg p-8 text-center">
          <Loader2 className="w-12 h-12 text-space-purple animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-cream-white mb-2">Analyzing Battle...</h3>
          <p className="text-gray-300">
            Evaluating character abilities, stats, and scenario conditions...
          </p>
        </div>
      )}

      {/* Results Display */}
      {contestResults && !isGeneratingResults && (
        <div className="space-y-6">
          {/* Winner Announcement */}
          <div className="bg-space-dark rounded-lg p-6 border-2 border-space-purple">
            <div className="text-center">
              <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />

              {contestResults.winner === 'tie' ? (
                <div>
                  <h3 className="text-2xl font-bold text-cream-white mb-2">It&apos;s a Tie!</h3>
                  <p className="text-gray-300">Both characters are evenly matched</p>
                </div>
              ) : (
                <div>
                  <h3 className="text-2xl font-bold text-cream-white mb-2">Winner</h3>
                  <p className="text-3xl font-bold text-space-purple mb-2">{winnerDisplay?.name}</p>
                  <p className="text-gray-300">{winnerDisplay?.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Confidence Score */}
          <div className="bg-space-dark rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-6 h-6 text-space-purple" />
              <h3 className="text-xl font-semibold text-cream-white">Confidence Score</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Certainty Level</span>
                <span className="text-2xl font-bold text-space-purple">
                  {contestResults.confidence}/10
                </span>
              </div>

              <Progress value={contestResults.confidence * 10} className="h-3" />

              <div className="text-sm text-gray-400">
                {contestResults.confidence <= 3 && 'Very uncertain - could go either way'}
                {contestResults.confidence > 3 &&
                  contestResults.confidence <= 6 &&
                  'Moderate confidence - slight advantage'}
                {contestResults.confidence > 6 &&
                  contestResults.confidence <= 8 &&
                  'High confidence - clear advantage'}
                {contestResults.confidence > 8 && 'Almost certain - overwhelming advantage'}
              </div>
            </div>
          </div>

          {/* Reasoning */}
          <div className="bg-space-dark rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-6 h-6 text-space-purple" />
              <h3 className="text-xl font-semibold text-cream-white">Analysis</h3>
            </div>

            <div className="prose prose-invert max-w-none">
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                {contestResults.reasoning}
              </p>
            </div>
          </div>

          {/* Character Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-space-dark rounded-lg p-6">
              <h4 className="text-lg font-semibold text-cream-white mb-4">
                {candidate1Name}
                {contestResults.winner === 'candidate1' && (
                  <Trophy className="w-5 h-5 text-yellow-500 inline ml-2" />
                )}
              </h4>

              {candidate1Details.stats && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-400 mb-2">Combat Stats</div>
                  {Object.entries(candidate1Details.stats).map(([stat, value]) => (
                    <div key={stat} className="flex justify-between items-center">
                      <span className="text-gray-300 capitalize">{stat}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={value} className="w-20 h-2" />
                        <span className="text-sm text-cream-white w-6">{value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-space-dark rounded-lg p-6">
              <h4 className="text-lg font-semibold text-cream-white mb-4">
                {candidate2Name}
                {contestResults.winner === 'candidate2' && (
                  <Trophy className="w-5 h-5 text-yellow-500 inline ml-2" />
                )}
              </h4>

              {candidate2Details.stats && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-400 mb-2">Combat Stats</div>
                  {Object.entries(candidate2Details.stats).map(([stat, value]) => (
                    <div key={stat} className="flex justify-between items-center">
                      <span className="text-gray-300 capitalize">{stat}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={value} className="w-20 h-2" />
                        <span className="text-sm text-cream-white w-6">{value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scenario Summary */}
          {(battleScenario.setting ||
            battleScenario.rules ||
            battleScenario.obstacles ||
            battleScenario.limitations ||
            battleScenario.additionalContext) && (
            <div className="bg-space-dark rounded-lg p-6">
              <h4 className="text-lg font-semibold text-cream-white mb-4">Battle Scenario</h4>
              <div className="space-y-2 text-sm">
                {battleScenario.setting && (
                  <div>
                    <span className="text-gray-400">Setting:</span>
                    <span className="text-gray-300 ml-2">{battleScenario.setting}</span>
                  </div>
                )}
                {battleScenario.rules && (
                  <div>
                    <span className="text-gray-400">Rules:</span>
                    <span className="text-gray-300 ml-2">{battleScenario.rules}</span>
                  </div>
                )}
                {battleScenario.obstacles && (
                  <div>
                    <span className="text-gray-400">Obstacles:</span>
                    <span className="text-gray-300 ml-2">{battleScenario.obstacles}</span>
                  </div>
                )}
                {battleScenario.limitations && (
                  <div>
                    <span className="text-gray-400">Limitations:</span>
                    <span className="text-gray-300 ml-2">{battleScenario.limitations}</span>
                  </div>
                )}
                {battleScenario.additionalContext && (
                  <div>
                    <span className="text-gray-400">Additional Context:</span>
                    <span className="text-gray-300 ml-2">{battleScenario.additionalContext}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contest Story Sections */}
          <div className="bg-space-dark rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-6 h-6 text-space-purple" />
              <h3 className="text-xl font-semibold text-cream-white">Battle Story</h3>
            </div>

            {isGeneratingStory && (
              <div className="flex items-center gap-3 text-gray-300">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating cinematic battle story...</span>
              </div>
            )}

            {contestStory && !isGeneratingStory && (
              <div className="space-y-6">
                {/* Intro Section */}
                <div className="border-l-4 border-space-purple pl-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-semibold text-cream-white">Introduction</h4>
                    {!storySectionImages.intro && !isGeneratingSectionImages.intro && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateStorySectionImage('intro')}
                        className="border-space-purple/30 text-cream-white hover:bg-space-purple/20"
                      >
                        Generate Image
                      </Button>
                    )}
                  </div>
                  <div className="prose prose-invert max-w-none mb-4">
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {contestStory.intro}
                    </p>
                  </div>
                  
                  {/* Intro Image */}
                  {isGeneratingSectionImages.intro && (
                    <div className="flex items-center gap-3 text-gray-300 mb-4">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Generating intro scene image...</span>
                    </div>
                  )}
                  
                  {storySectionImages.intro && !isGeneratingSectionImages.intro && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Image
                          src={storySectionImages.intro.imageUrl}
                          alt={storySectionImages.intro.altText}
                          className="w-full rounded-lg shadow-lg"
                          width={1024}
                          height={1024}
                        />
                      </div>
                      <p className="text-sm text-gray-400 italic">{storySectionImages.intro.altText}</p>
                    </div>
                  )}
                </div>

                {/* Climax Section */}
                <div className="border-l-4 border-red-500 pl-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-semibold text-cream-white">Climax</h4>
                    {!storySectionImages.climax && !isGeneratingSectionImages.climax && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateStorySectionImage('climax')}
                        className="border-space-purple/30 text-cream-white hover:bg-space-purple/20"
                      >
                        Generate Image
                      </Button>
                    )}
                  </div>
                  <div className="prose prose-invert max-w-none mb-4">
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {contestStory.climax}
                    </p>
                  </div>
                  
                  {/* Climax Image */}
                  {isGeneratingSectionImages.climax && (
                    <div className="flex items-center gap-3 text-gray-300 mb-4">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Generating climax scene image...</span>
                    </div>
                  )}
                  
                  {storySectionImages.climax && !isGeneratingSectionImages.climax && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Image
                          src={storySectionImages.climax.imageUrl}
                          alt={storySectionImages.climax.altText}
                          className="w-full rounded-lg shadow-lg"
                          width={1024}
                          height={1024}
                        />
                      </div>
                      <p className="text-sm text-gray-400 italic">{storySectionImages.climax.altText}</p>
                    </div>
                  )}
                </div>

                {/* Ending Section */}
                <div className="border-l-4 border-yellow-500 pl-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-semibold text-cream-white">Ending</h4>
                    {!storySectionImages.ending && !isGeneratingSectionImages.ending && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateStorySectionImage('ending')}
                        className="border-space-purple/30 text-cream-white hover:bg-space-purple/20"
                      >
                        Generate Image
                      </Button>
                    )}
                  </div>
                  <div className="prose prose-invert max-w-none mb-4">
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {contestStory.ending}
                    </p>
                  </div>
                  
                  {/* Ending Image */}
                  {isGeneratingSectionImages.ending && (
                    <div className="flex items-center gap-3 text-gray-300 mb-4">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Generating ending scene image...</span>
                    </div>
                  )}
                  
                  {storySectionImages.ending && !isGeneratingSectionImages.ending && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Image
                          src={storySectionImages.ending.imageUrl}
                          alt={storySectionImages.ending.altText}
                          className="w-full rounded-lg shadow-lg"
                          width={1024}
                          height={1024}
                        />
                      </div>
                      <p className="text-sm text-gray-400 italic">{storySectionImages.ending.altText}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!contestStory && !isGeneratingStory && (
              <div className="text-gray-400 italic">
                Story will be generated after battle results are determined...
              </div>
            )}
          </div>

          {/* Contest Image */}
          <div className="bg-space-dark rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Target className="w-6 h-6 text-space-purple" />
                <h3 className="text-xl font-semibold text-cream-white">Battle Scene</h3>
              </div>
              {!contestImage && !isGeneratingImage && contestStory && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateImage}
                  className="border-space-purple/30 text-cream-white hover:bg-space-purple/20"
                >
                  Generate Image
                </Button>
              )}
            </div>

            {isGeneratingImage && (
              <div className="flex items-center gap-3 text-gray-300 mb-4">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating epic battle image...</span>
              </div>
            )}

            {contestImage && !isGeneratingImage && (
              <div className="space-y-4">
                <div className="relative">
                  <Image
                    src={contestImage.imageUrl}
                    alt={contestImage.altText}
                    className="w-full rounded-lg shadow-lg"
                    width={1024}
                    height={1024}
                  />
                </div>
                <p className="text-sm text-gray-400 italic">{contestImage.altText}</p>
              </div>
            )}

            {!contestImage && !isGeneratingImage && (
              <div className="flex flex-col items-center gap-4">
                <div className="text-gray-400 italic text-center">
                  {contestStory
                    ? 'Ready to generate battle scene image'
                    : 'Battle scene image will be available after battle results and story are determined'}
                </div>
                {contestStory && (
                  <Button
                    variant="outline"
                    onClick={handleGenerateImage}
                    className="border-space-purple/30 text-cream-white hover:bg-space-purple/20"
                  >
                    Generate Battle Scene
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="border-space-purple/30 text-cream-white hover:bg-space-purple/20"
        >
          Previous
        </Button>

        <div className="flex gap-3">
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="border-space-purple/30 text-cream-white hover:bg-space-purple/20"
          >
            Start Over
          </Button>
        </div>
      </div>
    </div>
  );
}
