// owner: Phase 1A (graph core)
import type { Graph, Layout, Segment } from './types'

/**
 * Collapse every unbranched run between two keepers into a single segment, then place
 * keepers on a compacted row/column grid. Ported from the prototype's `layout()`.
 */
export function layout(g: Graph, target: string, expanded: string[]): Layout {
  const { nodes, kids, dep } = g

  // A node survives collapsing if it branches, is the target, or is a root.
  const base = new Set<string>()
  nodes.forEach(n => {
    const k = kids.get(n.id)!
    if (n.parents.length !== 1 || k.length !== 1 || n.id === target || dep.get(n.id) === 0) {
      base.add(n.id)
    }
  })

  const segsOf = (keep: Set<string>): Segment[] => {
    const out: Segment[] = []
    keep.forEach(id =>
      kids.get(id)!.forEach(c => {
        const inner: string[] = []
        let cur: string | undefined = c
        let guard = 0
        while (cur && !keep.has(cur) && guard++ < 400) {
          inner.push(cur)
          cur = kids.get(cur)![0]
        }
        if (cur) out.push({ key: id + '>' + c + '>' + cur, from: id, to: cur, inner })
      }),
    )
    return out
  }

  const keep = new Set(base)
  const exp = new Set(expanded)
  segsOf(keep).forEach(s => {
    if (exp.has(s.key)) s.inner.forEach(i => keep.add(i))
  })
  const segs = segsOf(keep)

  const pseg = new Map<string, Segment[]>()
  keep.forEach(k => pseg.set(k, []))
  segs.forEach(s => pseg.get(s.to)?.push(s))
  const order = Array.from(keep).sort((a, b) => dep.get(a)! - dep.get(b)!)

  // Compacted row: a segment costs 2 rows if it has inner nodes (leaving room for the
  // chip between its keepers), 1 otherwise.
  const kd = new Map<string, number>()
  order.forEach(id => {
    let v = 0
    pseg.get(id)!.forEach(s => {
      v = Math.max(v, (kd.get(s.from) ?? 0) + (s.inner.length ? 2 : 1))
    })
    kd.set(id, v)
  })

  // Walk back from the target along the deepest incoming segment; that path is column 0.
  const lane = new Map<string, number>()
  let cur = target
  const spine = new Set([target])
  const spineSegs = new Set<string>()
  for (let i = 0; i < 400; i++) {
    const ps = pseg.get(cur)
    if (!ps || !ps.length) break
    let best = ps[0]
    ps.forEach(s => {
      if ((kd.get(s.from) ?? 0) > (kd.get(best.from) ?? 0)) best = s
    })
    spineSegs.add(best.key)
    cur = best.from
    if (spine.has(cur)) break
    spine.add(cur)
  }
  spine.forEach(id => lane.set(id, 0))
  const used = new Map<number, number>()
  order.forEach(id => {
    if (lane.has(id)) return
    const k = kd.get(id)!
    const u = used.get(k) ?? 1
    lane.set(id, u)
    used.set(k, u + 1)
  })

  // Parallel branches between the same pair of keepers need their own column,
  // otherwise the two halves of a merge draw on top of each other.
  const chipOcc = new Set<string>()
  segs.forEach(s => {
    if (!s.inner.length) return
    const mid = (kd.get(s.from)! + kd.get(s.to)!) / 2
    let l = lane.get(s.to)! + (spineSegs.has(s.key) ? 0 : 1)
    while (chipOcc.has(mid + ':' + l)) l++
    chipOcc.add(mid + ':' + l)
    s.lane = l
    s.mid = mid
  })

  let widest = 0
  lane.forEach(v => {
    widest = Math.max(widest, v)
  })
  segs.forEach(s => {
    if (s.lane != null) widest = Math.max(widest, s.lane)
  })

  return { keep, segs, kd, lane, spine, spineSegs, order, widest }
}
