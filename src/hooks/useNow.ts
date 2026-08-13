// owner: Phase 1B (data layer)
import { useEffect, useState } from 'react'

/** Wall-clock ms, ticking every second. The interval is cleared on unmount. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
