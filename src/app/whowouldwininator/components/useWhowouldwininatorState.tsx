import { useState, useCallback } from 'react';

interface CharacterStats {
  strength: number;
  speed: number;
  durability: number;
  intelligence: number;
  energy: number;
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

interface CharacterDetailsLoading {
  backstory: boolean;
  powers: boolean;
  stats: boolean;
  feats: boolean;
  portrait: boolean;
}

interface BattleScenario {
  setting: string;
  rules: string;
  obstacles: string;
  limitations: string;
  additionalContext: string;
}

interface ContestResults {
  winner: 'candidate1' | 'candidate2' | 'tie';
  confidence: number;
  reasoning: string;
}

interface ContestStory {
  story: string;
}

interface ContestImage {
  imageUrl: string;
  altText: string;
  prompt: string;
}

export function useWhowouldwininatorState() {
  const [candidate1Name, setCandidate1Name] = useState('');
  const [candidate1Description, setCandidate1Description] = useState('');
  const [candidate2Name, setCandidate2Name] = useState('');
  const [candidate2Description, setCandidate2Description] = useState('');
  const [generatedCharacters, setGeneratedCharacters] = useState<string[]>([]);
  const [isGeneratingCandidate1, setIsGeneratingCandidate1] = useState(false);
  const [isGeneratingCandidate2, setIsGeneratingCandidate2] = useState(false);

  // Character details state
  const [candidate1Details, setCandidate1Details] = useState<Partial<CharacterDetails>>({});
  const [candidate2Details, setCandidate2Details] = useState<Partial<CharacterDetails>>({});
  const [candidate1DetailsLoading, setCandidate1DetailsLoading] = useState<CharacterDetailsLoading>(
    {
      backstory: false,
      powers: false,
      stats: false,
      feats: false,
      portrait: false,
    }
  );
  const [candidate2DetailsLoading, setCandidate2DetailsLoading] = useState<CharacterDetailsLoading>(
    {
      backstory: false,
      powers: false,
      stats: false,
      feats: false,
      portrait: false,
    }
  );

  // Track which details have been generated to prevent duplicates
  const [candidate1DetailsGenerated, setCandidate1DetailsGenerated] = useState<
    Set<keyof CharacterDetails>
  >(new Set());
  const [candidate2DetailsGenerated, setCandidate2DetailsGenerated] = useState<
    Set<keyof CharacterDetails>
  >(new Set());

  // Battle scenario state
  const [battleScenario, setBattleScenario] = useState<BattleScenario>({
    setting: '',
    rules: '',
    obstacles: '',
    limitations: '',
    additionalContext: '',
  });

  // Contest results state
  const [contestResults, setContestResults] = useState<ContestResults | null>(null);
  const [isGeneratingResults, setIsGeneratingResults] = useState(false);

  // Contest story state
  const [contestStory, setContestStory] = useState<ContestStory | null>(null);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);

  // Contest image state
  const [contestImage, setContestImage] = useState<ContestImage | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const updateCandidate1 = useCallback((candidate: string | null, description: string | null) => {
    if (candidate !== null) {
      setCandidate1Name(candidate);
    }
    if (description !== null) {
      setCandidate1Description(description);
    }
  }, []);

  const updateCandidate2 = useCallback((candidate: string | null, description: string | null) => {
    if (candidate !== null) {
      setCandidate2Name(candidate);
    }
    if (description !== null) {
      setCandidate2Description(description);
    }
  }, []);

  const generateRandomCharacter = useCallback(
    async (candidateNumber: 1 | 2) => {
      const setIsGenerating =
        candidateNumber === 1 ? setIsGeneratingCandidate1 : setIsGeneratingCandidate2;
      const updateCandidate = candidateNumber === 1 ? updateCandidate1 : updateCandidate2;

      setIsGenerating(true);
      try {
        const response = await fetch('/api/v1/whowouldwininator/get-random-character', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            excludedCharacters: generatedCharacters,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate random character');
        }

        const data = await response.json();
        updateCandidate(data.name, data.description);
        setGeneratedCharacters(prev => [...prev, data.name]);
      } catch (error) {
        console.error('Error generating random character:', error);
      } finally {
        setIsGenerating(false);
      }
    },
    [generatedCharacters, updateCandidate1, updateCandidate2]
  );

  const generateCharacterDetail = useCallback(
    async (
      candidateNumber: 1 | 2,
      detailType: keyof CharacterDetails,
      name: string,
      description: string
    ) => {
      const setLoading =
        candidateNumber === 1 ? setCandidate1DetailsLoading : setCandidate2DetailsLoading;
      const setDetails = candidateNumber === 1 ? setCandidate1Details : setCandidate2Details;
      const setGenerated =
        candidateNumber === 1 ? setCandidate1DetailsGenerated : setCandidate2DetailsGenerated;
      const generated =
        candidateNumber === 1 ? candidate1DetailsGenerated : candidate2DetailsGenerated;

      // Check if already generated or currently loading
      if (generated.has(detailType)) {
        return;
      }

      // Mark as generated to prevent duplicates
      setGenerated(prev => new Set([...prev, detailType]));
      setLoading(prev => ({ ...prev, [detailType]: true }));

      try {
        const response = await fetch(
          `/api/v1/whowouldwininator/generate-character-details/${detailType}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, description }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to generate ${detailType}`);
        }

        const data = await response.json();

        setDetails(prev => ({
          ...prev,
          [detailType]: detailType === 'stats' ? data.stats : data[detailType],
        }));
      } catch (error) {
        console.error(`Error generating ${detailType}:`, error);
        // Remove from generated set on error so it can be retried
        setGenerated(prev => {
          const newSet = new Set(prev);
          newSet.delete(detailType);
          return newSet;
        });
      } finally {
        setLoading(prev => ({ ...prev, [detailType]: false }));
      }
    },
    [candidate1DetailsGenerated, candidate2DetailsGenerated]
  );

  const updateCharacterDetail = useCallback(
    (
      candidateNumber: 1 | 2,
      detailType: keyof CharacterDetails,
      value: CharacterDetails[keyof CharacterDetails]
    ) => {
      const setDetails = candidateNumber === 1 ? setCandidate1Details : setCandidate2Details;
      setDetails(prev => ({ ...prev, [detailType]: value }));
    },
    []
  );

  const updateBattleScenario = useCallback((field: keyof BattleScenario, value: string) => {
    setBattleScenario(prev => ({ ...prev, [field]: value }));
  }, []);

  const getDefaultScenario = useCallback((): string => {
    return `${candidate1Name} vs ${candidate2Name} - Battle to TKO

Setting: Open field with no obstacles
Rules: Standard combat, fight until one character is knocked out or unable to continue
Conditions: Both characters are at peak abilities from their respective canon
Victory: First to incapacitate their opponent wins`;
  }, [candidate1Name, candidate2Name]);

  const generateContestResults = useCallback(async () => {
    setIsGeneratingResults(true);
    try {
      const response = await fetch('/api/v1/whowouldwininator/generate-contest-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidate1Name,
          candidate1Description,
          candidate1Details,
          candidate2Name,
          candidate2Description,
          candidate2Details,
          battleScenario,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate contest results');
      }

      const data = await response.json();
      setContestResults(data);
    } catch (error) {
      console.error('Error generating contest results:', error);
    } finally {
      setIsGeneratingResults(false);
    }
  }, [
    candidate1Name,
    candidate1Description,
    candidate1Details,
    candidate2Name,
    candidate2Description,
    candidate2Details,
    battleScenario,
  ]);

  const generateContestStory = useCallback(async () => {
    if (!contestResults) return;

    setIsGeneratingStory(true);
    try {
      const response = await fetch('/api/v1/whowouldwininator/generate-contest-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidate1Name,
          candidate1Description,
          candidate1Details,
          candidate2Name,
          candidate2Description,
          candidate2Details,
          battleScenario,
          contestResults,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate contest story');
      }

      const data = await response.json();
      setContestStory(data);
    } catch (error) {
      console.error('Error generating contest story:', error);
    } finally {
      setIsGeneratingStory(false);
    }
  }, [
    candidate1Name,
    candidate1Description,
    candidate1Details,
    candidate2Name,
    candidate2Description,
    candidate2Details,
    battleScenario,
    contestResults,
  ]);

  const generateContestImage = useCallback(async () => {
    if (!contestResults) return;

    setIsGeneratingImage(true);
    try {
      const response = await fetch('/api/v1/whowouldwininator/generate-contest-results-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidate1Name,
          candidate1Description,
          candidate2Name,
          candidate2Description,
          battleScenario,
          contestResults,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate contest image');
      }

      const data = await response.json();
      setContestImage(data);
    } catch (error) {
      console.error('Error generating contest image:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  }, [
    candidate1Name,
    candidate1Description,
    candidate2Name,
    candidate2Description,
    battleScenario,
    contestResults,
  ]);

  return {
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
    getDefaultScenario,
    generateContestResults,
    generateContestStory,
    generateContestImage,
  };
}
