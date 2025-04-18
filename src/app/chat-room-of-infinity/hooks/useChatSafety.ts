import { useState } from 'react';
import { useSafetyCheck } from '../api/hooks';

export function useChatSafety() {
  const [error, setError] = useState<string | null>(null);
  const safetyCheck = useSafetyCheck();

  const checkSafety = async (message: string) => {
    try {
      const result = await safetyCheck.mutateAsync(message);
      if (result.safe || result.isSafe) {
        setError(null);
        return { safe: true };
      } else {
        setError(result.reason);
        return { safe: false, reason: result.reason };
      }
    } catch {
      setError('Failed to check message safety');
      return { safe: false, reason: 'Failed to check message safety' };
    }
  };

  return {
    error,
    setError,
    checkSafety,
  };
}
