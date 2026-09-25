import { useCallback, useState } from 'react';

import { friendlyMessage } from './errors';
import { haptics } from './haptics';

/** Loading + error state around an async action (e.g. confirming a step). */
export function useSubmit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      haptics.error();
      setError(friendlyMessage(e));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, setError, run };
}
