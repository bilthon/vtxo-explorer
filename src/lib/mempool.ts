// owner: Phase 3G (wiring) — commitment block lookup
//
// A SECOND data source, deliberately kept out of indexer.ts because it is a different host with
// a different contract. Arkade's GetCommitmentTx returns only batch-session data (startedAt /
// endedAt / amounts) and no block information, so block height and block time can only come from
// a Bitcoin explorer.
//
// This is supplementary: it enriches the detail panel for COMMITMENT nodes only, is fetched
// lazily on selection, and MUST degrade to 'unavailable' rather than surfacing an error state.
// A mempool outage must never make a working Arkade chain look broken.
import { NETWORKS, type NetworkId } from './networks'

export type CommitmentBlock =
  | { status: 'loading' }
  | { status: 'confirmed'; height: number; time: number }
  | { status: 'unconfirmed' }
  | { status: 'unavailable' }

type WireStatus = {
  confirmed?: boolean
  block_height?: number
  block_time?: number
}

export async function getCommitmentBlock(
  net: NetworkId,
  txid: string,
  signal: AbortSignal,
): Promise<CommitmentBlock> {
  try {
    const res = await fetch(`${NETWORKS[net].explorerApi}/tx/${txid}`, { signal })
    if (!res.ok) return { status: 'unavailable' }

    const body = (await res.json()) as { status?: WireStatus }
    const s = body.status
    if (!s?.confirmed) return { status: 'unconfirmed' }
    if (typeof s.block_height !== 'number' || typeof s.block_time !== 'number') {
      return { status: 'unavailable' }
    }
    return { status: 'confirmed', height: s.block_height, time: s.block_time }
  } catch {
    // Includes abort. The caller discards results for stale selections anyway.
    return { status: 'unavailable' }
  }
}
