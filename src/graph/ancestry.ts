// owner: Phase 1A (graph core)
import type { Graph } from './types'

/** All strict ancestors (`up`) and descendants (`down`) of `id`. */
export function ancestry(g: Graph, id: string): { up: Set<string>; down: Set<string> } {
  const { nodes, kids } = g
  const up = new Set<string>()
  const down = new Set<string>()

  const stackUp = [id]
  while (stackUp.length) {
    const c = stackUp.pop()!
    const parents = nodes.get(c)?.parents ?? []
    parents.forEach(p => {
      if (nodes.has(p) && !up.has(p)) {
        up.add(p)
        stackUp.push(p)
      }
    })
  }

  const stackDn = [id]
  while (stackDn.length) {
    const c = stackDn.pop()!
    ;(kids.get(c) ?? []).forEach(k => {
      if (!down.has(k)) {
        down.add(k)
        stackDn.push(k)
      }
    })
  }

  return { up, down }
}
