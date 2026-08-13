// owner: Phase 3G (wiring)
//
// Resolves block height/time for a COMMITMENT transaction. Pass `null` for every other tx type —
// the hook then makes no request at all, so selecting an ark or checkpoint node never touches
// the third-party explorer.
import { useEffect, useState } from 'react'
import { getCommitmentBlock, type CommitmentBlock } from '../lib/mempool'
import type { NetworkId } from '../lib/networks'

export function useCommitmentBlock(net: NetworkId, txid: string | null): CommitmentBlock | null {
  const [block, setBlock] = useState<CommitmentBlock | null>(null)

  useEffect(() => {
    if (!txid) {
      setBlock(null)
      return
    }
    const ac = new AbortController()
    setBlock({ status: 'loading' })
    getCommitmentBlock(net, txid, ac.signal).then((b) => {
      if (!ac.signal.aborted) setBlock(b)
    })
    return () => ac.abort()
  }, [net, txid])

  return block
}
