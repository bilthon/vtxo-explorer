// owner: Phase 1B (data layer)
import { useCallback, useEffect, useState } from 'react'
import { getVtxoChain, type VtxoChain } from '../lib/indexer'
import type { NetworkId } from '../lib/networks'
import type { Async } from '../lib/indexer.types'
import type { Outpoint } from '../lib/parseQuery'

export type UseChain = {
  state: Async<VtxoChain>
  /** ms timestamp of the response currently on screen — drives the "snapshot" fact. */
  snapshotAt: number | null
  refresh: () => void
}

/**
 * The chain is a per-search snapshot, not a live subscription: it is fetched once per
 * (network, outpoint) and otherwise only on an explicit `refresh()`.
 */
export function useChain(net: NetworkId, outpoint: Outpoint | null): UseChain {
  const [state, setState] = useState<Async<VtxoChain>>({ status: 'idle' })
  const [snapshotAt, setSnapshotAt] = useState<number | null>(null)
  const [nonce, setNonce] = useState(0)

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  // Depend on the primitives, not the object: callers build the outpoint inline, so its
  // identity changes every render.
  const txid = outpoint?.txid ?? null
  const vout = outpoint?.vout ?? null

  useEffect(() => {
    if (txid === null || vout === null) {
      setState({ status: 'idle' })
      setSnapshotAt(null)
      return
    }

    const ac = new AbortController()
    setState({ status: 'loading' })

    void getVtxoChain(net, { txid, vout }, ac.signal).then((res) => {
      if (ac.signal.aborted) return
      if (res.kind === 'ok') {
        setState({ status: 'ready', value: res.value })
        setSnapshotAt(Date.now())
      } else if (res.kind === 'notFound') {
        setState({ status: 'notFound' })
      } else {
        setState({ status: 'error', message: res.message })
      }
    })

    return () => ac.abort()
  }, [net, txid, vout, nonce])

  return { state, snapshotAt, refresh }
}
