import { useState, useEffect } from "react";

/**
 * Ensures a boolean state only becomes true after a minimum amount of time has elapsed.
 * Useful for preventing loading spinners or splash screens from flashing for a single frame.
 */
export function useMinimumDuration(ready: boolean, minMs: number): boolean {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const start = performance.now();
    console.log(`[useMinimumDuration] Mounted with minMs=${minMs}`);
    const timer = setTimeout(() => {
      console.log(`[useMinimumDuration] Fired after ${performance.now() - start}ms`);
      setMinTimeElapsed(true);
    }, minMs);
    return () => {
      console.log(`[useMinimumDuration] Unmounted after ${performance.now() - start}ms`);
      clearTimeout(timer);
    };
  }, [minMs]);

  return ready && minTimeElapsed;
}
