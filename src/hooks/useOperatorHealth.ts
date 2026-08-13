// owner: Phase 1B (data layer)
import { useEffect, useState } from 'react'
import { getInfo } from '../lib/indexer'
import type { NetworkId } from '../lib/networks'

export type OperatorHealth = 'unknown' | 'live' | 'down'

/** Periodic `GET /v1/info` ping behind the "operator live" dot. */
export function useOperatorHealth(net: NetworkId, intervalMs = 30_000): OperatorHealth {
  const [health, setHealth] = useState<OperatorHealth>('unknown')

  useEffect(() => {
    const ac = new AbortController()
    setHealth('unknown')

    const ping = async () => {
      const res = await getInfo(net, ac.signal)
      if (ac.signal.aborted) return
      setHealth(res.kind === 'ok' ? 'live' : 'down')
    }

    void ping()
    const id = setInterval(() => void ping(), intervalMs)
    return () => {
      clearInterval(id)
      ac.abort()
    }
  }, [net, intervalMs])

  return health
}
