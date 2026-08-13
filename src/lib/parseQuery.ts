// owner: Phase 1B (data layer)
// Search input -> outpoint. Accepts `txid:vout` and bare `txid`; everything else is rejected
// before a request is spent.

import { getVtxos } from './indexer'
import type { NetworkId } from './networks'
import type { VtxoStatus } from './indexer.types'

export type Outpoint = { txid: string; vout: number }

export type ParsedQuery =
  | { kind: 'outpoint'; outpoint: Outpoint }
  | { kind: 'txid'; txid: string }
  | { kind: 'invalid'; message: string }

const TXID = /^[0-9a-f]{64}$/
const VOUT = /^\d+$/

export function isTxid(value: string): boolean {
  return TXID.test(value)
}

export function parseQuery(input: string): ParsedQuery {
  const trimmed = input.trim()
  if (!trimmed) return { kind: 'invalid', message: 'Enter a VTXO outpoint' }

  const [txid, vout, ...rest] = trimmed.split(':')

  if (rest.length > 0) {
    return { kind: 'invalid', message: 'Expected txid or txid:vout' }
  }
  if (!TXID.test(txid)) {
    return { kind: 'invalid', message: 'A txid is 64 lowercase hex characters' }
  }
  if (vout === undefined) {
    return { kind: 'txid', txid }
  }
  if (!VOUT.test(vout) || !Number.isSafeInteger(Number(vout))) {
    return { kind: 'invalid', message: 'Output index must be a non-negative integer' }
  }
  return { kind: 'outpoint', outpoint: { txid, vout: Number(vout) } }
}

// ---------------------------------------------------------------------------
// Bare txid resolution
// ---------------------------------------------------------------------------

/**
 * An Arkade tx typically has several outputs (payment + change), each its own VTXO, and the
 * interesting one is often not vout 0 — in the reference chain 28 of 55 checkpoint refs point
 * at vout 1. So a bare txid probes the first four outputs.
 */
export const BARE_TXID_VOUTS = [0, 1, 2, 3]

export type BareHit = {
  vout: number
  amount: number
  status: VtxoStatus
}

export type BareTxidResult =
  | { kind: 'one'; hits: BareHit[] }
  | { kind: 'many'; hits: BareHit[] }
  | { kind: 'none'; hits: [] }
  | { kind: 'error'; message: string }

export async function resolveBareTxid(
  net: NetworkId,
  txid: string,
  signal: AbortSignal,
): Promise<BareTxidResult> {
  const res = await getVtxos(
    net,
    BARE_TXID_VOUTS.map((vout) => ({ txid, vout })),
    signal,
  )
  // `notFound` cannot occur here: the vtxos endpoint answers 200 with an empty list for
  // outpoints it does not know. Fold it into `none` anyway so the union stays total.
  if (res.kind === 'error') return { kind: 'error', message: res.message }
  if (res.kind === 'notFound') return { kind: 'none', hits: [] }

  const hits: BareHit[] = res.value
    .map((v) => ({ vout: v.vout, amount: v.amount, status: v.status }))
    .sort((a, b) => a.vout - b.vout)

  if (hits.length === 0) return { kind: 'none', hits: [] }
  return { kind: hits.length === 1 ? 'one' : 'many', hits }
}
