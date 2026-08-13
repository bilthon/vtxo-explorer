// owner: Phase 1B (data layer)
// Thin fetch client over the Arkade indexer REST gateway. No SDK, no cache, no retries.
// CORS is fully open on all three operators, so the browser talks to them directly.

import { NETWORKS, type NetworkId } from './networks'
import type {
  IndexerChain,
  OperatorInfo,
  Vtxo,
  VtxoStatus,
  WireChainResponse,
  WireError,
  WireVtxo,
  WireVtxosResponse,
} from './indexer.types'

/**
 * "This outpoint does not exist" and "the operator is unreachable" are different states with
 * different UI, so they are different variants rather than one thrown error.
 */
export type IndexerResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'notFound' }
  | { kind: 'error'; message: string }

export const MAX_CHAIN_NODES = 2000

export type VtxoChain = {
  chain: IndexerChain[]
  /** true when the 2000-record cap stopped paging early */
  truncated: boolean
}

async function request<T>(
  net: NetworkId,
  path: string,
  signal: AbortSignal,
): Promise<IndexerResult<T>> {
  let res: Response
  try {
    res = await fetch(NETWORKS[net].baseUrl + path, { signal })
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : 'network request failed' }
  }

  const body: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    const err = (body ?? {}) as WireError
    // A missing outpoint comes back as HTTP 500 / code 13. Code 13 is gRPC INTERNAL and is
    // also used for genuine operator faults, so the message must corroborate it.
    if (err.code === 13 && (err.message ?? '').includes('not found')) return { kind: 'notFound' }
    return { kind: 'error', message: err.message ?? `HTTP ${res.status}` }
  }

  if (body === null) return { kind: 'error', message: 'malformed response' }
  return { kind: 'ok', value: body as T }
}

/**
 * Full ancestor chain for an outpoint, paged to exhaustion and capped at MAX_CHAIN_NODES.
 * Records are returned verbatim (duplicates included) — deduping belongs to the graph core.
 */
export async function getVtxoChain(
  net: NetworkId,
  outpoint: { txid: string; vout: number },
  signal: AbortSignal,
): Promise<IndexerResult<VtxoChain>> {
  const base = `/v1/indexer/vtxo/${outpoint.txid}/${outpoint.vout}/chain`
  const chain: IndexerChain[] = []
  let token = ''

  for (;;) {
    // The response's `nextPageToken` is echoed back as the `pageToken` request param (verified:
    // the gateway parses `pageToken`, and ignores `nextPageToken` as an unknown param). Live
    // operators return `nextPageToken: ''` and the whole chain in one page, so this loop runs
    // once today; the paging path is covered by a stubbed-fetch test.
    const path = token ? `${base}?pageToken=${encodeURIComponent(token)}` : base
    const res = await request<WireChainResponse>(net, path, signal)
    if (res.kind !== 'ok') return res

    chain.push(...res.value.chain)
    if (chain.length >= MAX_CHAIN_NODES) {
      return { kind: 'ok', value: { chain: chain.slice(0, MAX_CHAIN_NODES), truncated: true } }
    }

    token = res.value.nextPageToken
    if (!token) return { kind: 'ok', value: { chain, truncated: false } }
  }
}

/** Batch lookup. Outpoints with no VTXO are simply absent from the response. */
export async function getVtxos(
  net: NetworkId,
  outpoints: Array<{ txid: string; vout: number }>,
  signal: AbortSignal,
): Promise<IndexerResult<Vtxo[]>> {
  const query = outpoints.map((o) => `outpoints=${o.txid}:${o.vout}`).join('&')
  const res = await request<WireVtxosResponse>(net, `/v1/indexer/vtxos?${query}`, signal)
  if (res.kind !== 'ok') return res
  return { kind: 'ok', value: res.value.vtxos.map(toVtxo) }
}

export async function getInfo(
  net: NetworkId,
  signal: AbortSignal,
): Promise<IndexerResult<OperatorInfo>> {
  return request<OperatorInfo>(net, '/v1/info', signal)
}

export function toVtxo(w: WireVtxo): Vtxo {
  return {
    txid: w.outpoint.txid,
    vout: w.outpoint.vout,
    createdAt: Number(w.createdAt),
    expiresAt: Number(w.expiresAt),
    amount: Number(w.amount),
    script: w.script,
    status: vtxoStatus(w),
    spentBy: w.spentBy,
    commitmentTxids: w.commitmentTxids,
    depth: w.depth,
  }
}

export function vtxoStatus(w: WireVtxo): VtxoStatus {
  if (w.isPreconfirmed) return 'PRECONFIRMED'
  if (w.isSpent) return 'SPENT'
  if (w.isSwept) return 'SWEPT'
  if (w.isUnrolled) return 'UNROLLED'
  return 'SETTLED'
}
