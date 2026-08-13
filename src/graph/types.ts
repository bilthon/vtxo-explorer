// owner: Phase 1A (graph core)
export type TxType = 'A' | 'C' | 'T' | 'M'

export type GraphNode = {
  id: string
  type: TxType
  /** Parent txids, `:vout` stripped. May reference txids outside `Graph.nodes`. */
  parents: string[]
}

export type Graph = {
  nodes: Map<string, GraphNode>
  /** id -> ids of txs that spend it. Only contains ids present in `nodes`. */
  kids: Map<string, string[]>
  /** id -> longest path length from a root (not BFS distance). */
  dep: Map<string, number>
}

/** A run of collapsed nodes between two keepers. `inner` is empty for a plain edge. */
export type Segment = {
  key: string
  from: string
  to: string
  inner: string[]
  /** Column of the run chip. Only set when `inner` is non-empty. */
  lane?: number
  /** Row of the run chip, may be fractional. Only set when `inner` is non-empty. */
  mid?: number
}

export type Layout = {
  keep: Set<string>
  segs: Segment[]
  /** keeper id -> compacted row. */
  kd: Map<string, number>
  /** keeper id -> column. */
  lane: Map<string, number>
  spine: Set<string>
  spineSegs: Set<string>
  /** keeper ids sorted by `dep` ascending. */
  order: string[]
  widest: number
}
