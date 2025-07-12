import { useState } from 'react';

export function useWhowouldwininatorState() {
  const [candidate1Name, setCandidate1Name] = useState('');
  const [candidate1Description, setCandidate1Description] = useState('');
  const [candidate2Name, setCandidate2Name] = useState('');
  const [candidate2Description, setCandidate2Description] = useState('');

  const updateCandidate1 = (candidate: string | null, description: string | null) => {
    if (candidate) {
      setCandidate1Name(candidate);
    }
    if (description) {
      setCandidate1Description(description);
    }
  };

  const updateCandidate2 = (candidate: string | null, description: string | null) => {
    if (candidate) {
      setCandidate2Name(candidate);
    }
    if (description) {
      setCandidate2Description(description);
    }
  };

  return {
    candidate1Name,
    candidate2Name,
    candidate1Description,
    candidate2Description,
    updateCandidate1,
    updateCandidate2,
  };
}
