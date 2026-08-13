// owner: Phase 1A (graph core)
import { describe, it, expect } from 'vitest'
import fixture from './fixtures/chain-99.json'
import type { IndexerChain } from '../lib/indexer.types'
import { buildGraph } from '../graph/build'
import { ancestry } from '../graph/ancestry'
import { layout } from '../graph/layout'
import { countPaths } from '../graph/paths'
import type { Graph } from '../graph/types'

const TARGET = '1291b80b71e2b289699b418543a3aa3f7e550a7385fc228bf972ae4954bd60f2'
const CHAIN = fixture.chain as IndexerChain[]
const g = buildGraph(CHAIN)

const edgeCount = (graph: Graph) => {
  let n = 0
  graph.nodes.forEach(x => (n += x.parents.length))
  return n
}
const mergeIds = (graph: Graph) =>
  Array.from(graph.nodes.values())
    .filter(n => n.parents.length > 1)
    .map(n => n.id)
const maxDepth = (graph: Graph) => Math.max(...graph.dep.values())

const rec = (txid: string, spends: string[], type: IndexerChain['type'] = 'INDEXER_CHAINED_TX_TYPE_ARK'): IndexerChain => ({
  txid,
  expiresAt: '1788857636',
  type,
  spends,
})

describe('buildGraph', () => {
  it('dedupes 107 fixture records into 99 nodes / 101 edges / 3 merges', () => {
    expect(CHAIN).toHaveLength(107)
    expect(g.nodes.size).toBe(99)
    expect(edgeCount(g)).toBe(101)
    expect(mergeIds(g)).toHaveLength(3)
  })

  it('resolves every parent reference — catches un-stripped `txid:vout`', () => {
    let unresolved = 0
    g.nodes.forEach(n => n.parents.forEach(p => { if (!g.nodes.has(p)) unresolved++ }))
    expect(unresolved).toBe(0)
    // 55 of the fixture's records carry a `:vout` suffix, 28 of them vout 1.
    expect(CHAIN.filter(r => r.spends.some(s => s.includes(':'))).length).toBe(55)
    g.nodes.forEach(n => n.parents.forEach(p => expect(p).not.toContain(':')))
  })

  it('counts node types over deduped nodes, not raw records', () => {
    const byType = { A: 0, C: 0, T: 0, M: 0 }
    g.nodes.forEach(n => byType[n.type]++)
    // Raw records are 50/55/1/1; after dedupe the graph is 47/50/1/1 (= 99).
    expect(byType).toEqual({ A: 47, C: 50, T: 1, M: 1 })
  })

  it('keeps the first record when a txid repeats', () => {
    const dup = buildGraph([rec('aa', ['bb']), rec('aa', ['cc']), rec('bb', []), rec('cc', [])])
    expect(dup.nodes.get('aa')!.parents).toEqual(['bb'])
  })

  it('strips `:vout` BEFORE deduping, so two outputs of one parent are one edge', () => {
    const two = buildGraph([rec('child', ['parent:0', 'parent:1']), rec('parent', [])])
    expect(two.nodes.get('child')!.parents).toEqual(['parent'])
    expect(two.kids.get('parent')).toEqual(['child'])
  })

  it('computes dep as the longest path from a root, not BFS distance', () => {
    // root -> a -> b -> tip, plus the shortcut root -> tip.
    const diamond = buildGraph([rec('root', []), rec('a', ['root']), rec('b', ['a']), rec('tip', ['b', 'root'])])
    expect(diamond.dep.get('tip')).toBe(3)
  })

  it('reports depth 95 for the reference chain', () => {
    // The prototype's own algorithm on the handoff's chain.js also yields 95.
    // PLAN.md §7 says 47 — see the report; 47 is the ark-hop count, not `dep`.
    expect(maxDepth(g)).toBe(95)
    expect(g.dep.get(TARGET)).toBe(95)
  })
})

describe('countPaths', () => {
  it('counts 8 root-to-target paths on the reference chain', () => {
    expect(countPaths(g, TARGET)).toBe(8n)
  })

  it('stays exact past Number.MAX_SAFE_INTEGER', () => {
    // 60 chained diamonds => 2^60 paths, which a Number would round.
    const recs: IndexerChain[] = [rec('n0', [])]
    for (let i = 0; i < 60; i++) {
      recs.push(rec(`l${i}`, [`n${i}`]), rec(`r${i}`, [`n${i}`]), rec(`n${i + 1}`, [`l${i}`, `r${i}`]))
    }
    expect(countPaths(buildGraph(recs), 'n60')).toBe(2n ** 60n)
  })
})

describe('ancestry', () => {
  const MERGE = 'c77e748f0ded81d86551a7420c864cb7f9f71bad782d36d94e89904847cee4c3'

  it('splits the chain around a known merge node', () => {
    const { up, down } = ancestry(g, MERGE)
    expect(up.size).toBe(70)
    expect(down.size).toBe(28)
    expect(up.size + down.size + 1).toBe(g.nodes.size)
    expect(up.has(MERGE)).toBe(false)
    expect(down.has(MERGE)).toBe(false)
    for (const p of g.nodes.get(MERGE)!.parents) expect(up.has(p)).toBe(true)
    expect(down.has(TARGET)).toBe(true)
  })

  it('gives the target no descendants and the commitment no ancestors', () => {
    expect(ancestry(g, TARGET).down.size).toBe(0)
    const root = Array.from(g.nodes.values()).find(n => g.dep.get(n.id) === 0)!
    expect(root.type).toBe('M')
    expect(ancestry(g, root.id).up.size).toBe(0)
    expect(ancestry(g, root.id).down.size).toBe(98)
  })
})

describe('layout', () => {
  const base = layout(g, TARGET, [])
  const chipKeys = base.segs.filter(s => s.inner.length).map(s => s.key)

  it('collapses the reference chain to 6 keepers and 8 segments', () => {
    expect(base.keep.size).toBe(6)
    expect(base.segs).toHaveLength(8)
    expect(base.segs.every(s => s.inner.length)).toBe(true)
    expect(base.widest).toBe(1)
  })

  it('keeps exactly the branching nodes, the target and the roots', () => {
    g.nodes.forEach(n => {
      const isKeeper =
        n.parents.length !== 1 ||
        g.kids.get(n.id)!.length !== 1 ||
        n.id === TARGET ||
        g.dep.get(n.id) === 0
      expect(base.keep.has(n.id)).toBe(isKeeper)
    })
  })

  it('spends 2 rows on a segment with inner nodes and 1 without', () => {
    for (const l of [base, layout(g, TARGET, chipKeys)]) {
      for (const s of l.segs) {
        expect(l.kd.get(s.to)!).toBeGreaterThanOrEqual(l.kd.get(s.from)! + (s.inner.length ? 2 : 1))
      }
    }
  })

  // The regression guard: without the chipOcc set, both halves of a merge draw on top
  // of each other. Checked across every expansion state a user can reach one click in.
  it('never places two chips in the same mid:lane slot', () => {
    const states = [[], chipKeys, ...chipKeys.map(k => [k])]
    for (const expanded of states) {
      const l = layout(g, TARGET, expanded)
      const chips = l.segs.filter(s => s.inner.length)
      const slots = chips.map(s => `${s.mid}:${s.lane}`)
      expect(new Set(slots).size).toBe(slots.length)
    }
  })

  it('gives parallel branches between the same keeper pair their own column', () => {
    const byPair = new Map<string, number[]>()
    for (const s of base.segs) {
      const k = `${s.from}>${s.to}`
      byPair.set(k, [...(byPair.get(k) ?? []), s.lane!])
    }
    const parallel = Array.from(byPair.values()).filter(lanes => lanes.length > 1)
    expect(parallel).toHaveLength(3) // each of the three merges collapses into a parallel pair
    for (const lanes of parallel) expect(new Set(lanes).size).toBe(lanes.length)
  })

  it('expands one run into keepers without disturbing the others', () => {
    const one = layout(g, TARGET, [chipKeys[0]])
    const inner = base.segs.find(s => s.key === chipKeys[0])!.inner
    expect(one.keep.size).toBe(base.keep.size + inner.length)
    for (const id of inner) expect(one.keep.has(id)).toBe(true)
    const all = layout(g, TARGET, chipKeys)
    expect(all.keep.size).toBe(g.nodes.size)
    expect(all.segs.filter(s => s.inner.length)).toHaveLength(0)
  })

  it('puts the target and its deepest ancestor line in column 0', () => {
    expect(base.lane.get(TARGET)).toBe(0)
    base.spine.forEach(id => expect(base.lane.get(id)).toBe(0))
    expect(base.kd.get(TARGET)).toBe(Math.max(...base.kd.values()))
  })
})
