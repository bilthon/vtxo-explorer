// owner: Phase 1A (graph core)
import type { Graph } from './types'

/**
 * Number of distinct root-to-`id` paths. BigInt: the count doubles per merge, so a chain
 * with >53 merges would silently exceed Number.MAX_SAFE_INTEGER.
 */
export function countPaths(g: Graph, id: string): bigint {
  const memo = new Map<string, bigint>()
  const walk = (cur: string): bigint => {
    const hit = memo.get(cur)
    if (hit !== undefined) return hit
    const ps = g.nodes.get(cur)!.parents.filter(p => g.nodes.has(p))
    const v = ps.length ? ps.reduce((a, p) => a + walk(p), 0n) : 1n
    memo.set(cur, v)
    return v
  }
  return walk(id)
}
