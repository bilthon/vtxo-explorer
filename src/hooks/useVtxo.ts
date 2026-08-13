// owner: Phase 1B (data layer)
import { useEffect, useState } from 'react'
import { getVtxos } from '../lib/indexer'
import type { NetworkId } from '../lib/networks'
import type { Async, Vtxo } from '../lib/indexer.types'
import type { Outpoint } from '../lib/parseQuery'

/**
 * The subject VTXO itself — amount, status pill and expiry for the subject header.
 * Unlike the chain endpoint, this one answers 200 with an empty list for an unknown outpoint.
 */
export function useVtxo(net: NetworkId, outpoint: Outpoint | null): Async<Vtxo> {
  const [state, setState] = useState<Async<Vtxo>>({ status: 'idle' })

  // Depend on the primitives, not the object: callers build the outpoint inline, so its
  // identity changes every render.
  const txid = outpoint?.txid ?? null
  const vout = outpoint?.vout ?? null

  useEffect(() => {
    if (txid === null || vout === null) {
      setState({ status: 'idle' })
      return
    }

    const ac = new AbortController()
    setState({ status: 'loading' })

    void getVtxos(net, [{ txid, vout }], ac.signal).then((res) => {
      if (ac.signal.aborted) return
      if (res.kind === 'error') {
        setState({ status: 'error', message: res.message })
      } else if (res.kind === 'notFound' || res.value.length === 0) {
        setState({ status: 'notFound' })
      } else {
        setState({ status: 'ready', value: res.value[0] })
      }
    })

    return () => ac.abort()
  }, [net, txid, vout])

  return state
}
