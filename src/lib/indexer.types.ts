// owner: Phase 1B (data layer)
// Wire types from the proto — see PLAN.md §2. Everything the gateway serialises as a numeric
// string is coerced at the client boundary; only `IndexerChain` keeps its wire shape, because
// the graph core consumes those records verbatim and never reads `expiresAt`.

export type ChainedTxType =
  | 'INDEXER_CHAINED_TX_TYPE_COMMITMENT'
  | 'INDEXER_CHAINED_TX_TYPE_ARK'
  | 'INDEXER_CHAINED_TX_TYPE_TREE'
  | 'INDEXER_CHAINED_TX_TYPE_CHECKPOINT'

export type IndexerChain = {
  txid: string
  expiresAt: string
  type: ChainedTxType
  spends: string[]
}

/** `GET /v1/indexer/vtxo/{txid}/{vout}/chain` */
export type WireChainResponse = {
  chain: IndexerChain[]
  page: WirePage | null
  authToken: string
  nextPageToken: string
}

/** Present only when `page.size` is supplied; 1-based, `total` counts pages. */
export type WirePage = {
  current: number
  next: number
  total: number
}

/** A single record of `GET /v1/indexer/vtxos`. Numeric fields arrive as strings. */
export type WireVtxo = {
  outpoint: { txid: string; vout: number }
  createdAt: string
  expiresAt: string
  amount: string
  script: string
  isPreconfirmed: boolean
  isSwept: boolean
  isUnrolled: boolean
  isSpent: boolean
  spentBy: string
  settledBy: string
  arkTxid: string
  commitmentTxids: string[]
  depth: number
}

export type WireVtxosResponse = {
  vtxos: WireVtxo[]
  page: WirePage | null
}

/** gRPC-gateway error envelope. Served with HTTP 500 for a missing outpoint. */
export type WireError = {
  code?: number
  message?: string
}

/** Subset of `GET /v1/info` the app actually reads. */
export type OperatorInfo = {
  network: string
  signerPubkey: string
  dust: string
  unilateralExitDelay: string
}

// ---------------------------------------------------------------------------
// App-side types (coerced)
// ---------------------------------------------------------------------------

export type VtxoStatus = 'PRECONFIRMED' | 'SPENT' | 'SWEPT' | 'UNROLLED' | 'SETTLED'

export type Vtxo = {
  txid: string
  vout: number
  createdAt: number
  expiresAt: number
  amount: number
  script: string
  status: VtxoStatus
  spentBy: string
  commitmentTxids: string[]
  depth: number
}

/** Loading state shared by every data hook. */
export type Async<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'notFound' }
  | { status: 'error'; message: string }
