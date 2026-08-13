// owner: Phase 1A (graph core)
import type { IndexerChain } from '../lib/indexer.types'
import { TYPE_CODE } from './constants'
import type { Graph, GraphNode } from './types'

export function buildGraph(records: IndexerChain[]): Graph {
  const nodes = new Map<string, GraphNode>()
  records.forEach(r => {
    // The API returns duplicate records (107 -> 99 for the reference chain); first wins.
    if (nodes.has(r.txid)) return
    // Strip `:vout` BEFORE deduping: checkpoints reference `txid:vout`, ark and tree txs
    // reference a bare txid. Deduping raw strings would keep `x:0` and `x:1` as two parents.
    const parents = Array.from(new Set(r.spends.map(s => s.split(':')[0])))
    nodes.set(r.txid, { id: r.txid, type: TYPE_CODE[r.type], parents })
  })

  const kids = new Map<string, string[]>()
  nodes.forEach(n => kids.set(n.id, []))
  nodes.forEach(n => n.parents.forEach(p => kids.get(p)?.push(n.id)))

  // Longest path from a root, not BFS distance. `dep.set(id, 0)` before recursing is
  // deliberate cycle protection.
  const dep = new Map<string, number>()
  const walk = (id: string): number => {
    const memo = dep.get(id)
    if (memo !== undefined) return memo
    dep.set(id, 0)
    let v = 0
    nodes.get(id)!.parents.forEach(p => {
      if (nodes.has(p)) v = Math.max(v, walk(p) + 1)
    })
    dep.set(id, v)
    return v
  }
  nodes.forEach(n => walk(n.id))

  return { nodes, kids, dep }
}
