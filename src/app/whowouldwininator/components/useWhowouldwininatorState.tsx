import { useState } from 'react';

export function useWhowouldwininatorState() {
  const [candidate1Name, setCandidate1Name] = useState('');
  const [candidate1Description, setCandidate1Description] = useState('');
  const [candidate2Name, setCandidate2Name] = useState('');
  const [candidate2Description, setCandidate2Description] = useState('');
  const [generatedCharacters, setGeneratedCharacters] = useState<string[]>([]);
  const [isGeneratingCandidate1, setIsGeneratingCandidate1] = useState(false);
  const [isGeneratingCandidate2, setIsGeneratingCandidate2] = useState(false);

  const updateCandidate1 = (candidate: string | null, description: string | null) => {
    if (candidate !== null) {
      setCandidate1Name(candidate);
    }
    if (description !== null) {
      setCandidate1Description(description);
    }
  };

  const updateCandidate2 = (candidate: string | null, description: string | null) => {
    if (candidate !== null) {
      setCandidate2Name(candidate);
    }
    if (description !== null) {
      setCandidate2Description(description);
    }
  };

  const generateRandomCharacter = async (candidateNumber: 1 | 2) => {
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
      // You might want to show a toast notification here
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    candidate1Name,
    candidate2Name,
    candidate1Description,
    candidate2Description,
    isGeneratingCandidate1,
    isGeneratingCandidate2,
    updateCandidate1,
    updateCandidate2,
    generateRandomCharacter,
  };
}
