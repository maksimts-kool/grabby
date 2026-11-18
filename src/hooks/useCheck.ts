import { useEffect, useState } from 'react';

import {
  checkAll,
  isChecking,
  onCheckProgress,
  type CheckProgress,
  type CheckResult,
} from '@/services/checker';

/** Runs a check and exposes its live progress ("Checking 6 of 14"). */
export function useCheck() {
  const [progress, setProgress] = useState<CheckProgress | null>(null);
  const [checking, setChecking] = useState(isChecking);
  const [lastResult, setLastResult] = useState<CheckResult | null>(null);

  useEffect(
    () =>
      onCheckProgress((p) => {
        setProgress(p);
        setChecking(p !== null || isChecking());
      }),
    [],
  );

  const run = async () => {
    setChecking(true);
    try {
      const result = await checkAll('manual');
      setLastResult(result);
      return result;
    } finally {
      setChecking(false);
    }
  };

  return { checking, progress, lastResult, run };
}
