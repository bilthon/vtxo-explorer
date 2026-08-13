// owner: Phase 2D (graph canvas)
import { useMemo, type ReactNode } from 'react'
import { ancestry } from '../../graph/ancestry'
import { CHIP_H, COLW, NH, NW, PADX, PADY, ROWH } from '../../graph/constants'
import { layout } from '../../graph/layout'
import type { Graph, TxType } from '../../graph/types'
import { Canvas } from './Canvas'
import { Edges, type Edge } from './Edges'
import styles from './GraphView.module.css'
import { NodeCard, type NodeTag } from './NodeCard'
import { RunChip } from './RunChip'
import { Toolbar } from './Toolbar'

type Props = {
  graph: Graph
  /** The subject VTXO's txid — tagged `VTXO` and anchored to lane 0. */
  target: string
  selected: string | null
  /** Expanded run-segment keys. */
  expanded: string[]
  zoom: number
  /** Types toggled off in the legend; their nodes render dimmed. */
  dimTypes: TxType[]
  onSelect: (id: string | null) => void
  onExpandedChange: (next: string[]) => void
  onZoomChange: (zoom: number) => void
  onDimTypesChange: (next: TxType[]) => void
  /** The detail panel (Phase 2E) occupying the right column. */
  panel: ReactNode
}

type NodeView = {
  id: string
  type: TxType
  depth: number
  x: number
  y: number
  tag: NodeTag | null
  merge: boolean
  selected: boolean
  dimmed: boolean
}

type RunView = {
  key: string
  x: number
  y: number
  types: TxType[]
  expanded: boolean
  dimmed: boolean
}

const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const dy = y2 - y1
  return `M${x1} ${y1} C${x1} ${y1 + dy * 0.55}, ${x2} ${y2 - dy * 0.55}, ${x2} ${y2}`
}

export function GraphView({
  graph,
  target,
  selected,
  expanded,
  zoom,
  dimTypes,
  onSelect,
  onExpandedChange,
  onZoomChange,
  onDimTypesChange,
  panel,
}: Props) {
  const { kd, lane, order, segs, widest } = useMemo(
    () => layout(graph, target, expanded),
    [graph, target, expanded],
  )

  const view = useMemo(() => {
    const { up, down } = selected
      ? ancestry(graph, selected)
      : { up: new Set<string>(), down: new Set<string>() }
    const inTrace = (id: string) => id === selected || up.has(id) || down.has(id)
    const X = (id: string) => PADX + lane.get(id)! * COLW
    const Y = (id: string) => PADY + kd.get(id)! * ROWH

    const nodeViews: NodeView[] = order.map((id) => {
      const n = graph.nodes.get(id)!
      const depth = graph.dep.get(id)!
      const merge = n.parents.length > 1
      return {
        id,
        type: n.type,
        depth,
        x: X(id),
        y: Y(id),
        tag: id === target ? 'VTXO' : merge ? 'MERGE' : depth === 0 ? 'ONCHAIN' : null,
        merge,
        selected: id === selected,
        dimmed: (selected !== null && !inTrace(id)) || dimTypes.includes(n.type),
      }
    })

    const runViews: RunView[] = []
    const edges: Edge[] = []
    segs.forEach((s) => {
      const hot =
        selected !== null &&
        (s.from === selected ||
          s.to === selected ||
          ((up.has(s.from) || s.from === selected) && (up.has(s.to) || s.to === selected)))
      const fx = X(s.from) + NW / 2
      const fy = Y(s.from) + NH
      const tx = X(s.to) + NW / 2
      const ty = Y(s.to)
      if (!s.inner.length) {
        edges.push({ key: s.key, d: bezier(fx, fy, tx, ty), hot })
        return
      }
      const cx = PADX + s.lane! * COLW
      const cy = PADY + s.mid! * ROWH + 9
      edges.push({ key: `${s.key}#in`, d: bezier(fx, fy, cx + NW / 2, cy), hot })
      edges.push({ key: `${s.key}#out`, d: bezier(cx + NW / 2, cy + CHIP_H, tx, ty), hot })
      runViews.push({
        key: s.key,
        x: cx,
        y: cy,
        types: s.inner.map((i) => graph.nodes.get(i)!.type),
        expanded: expanded.includes(s.key),
        dimmed: selected !== null && !(up.has(s.to) || s.to === selected),
      })
    })

    let height = 0
    nodeViews.forEach((n) => {
      height = Math.max(height, n.y + NH)
    })

    return {
      nodes: nodeViews,
      runs: runViews,
      edges,
      width: PADX + widest * COLW + NW + PADX,
      height: height + PADY,
    }
  }, [graph, target, selected, expanded, dimTypes, kd, lane, order, segs, widest])

  const toggleRun = (key: string) =>
    onExpandedChange(
      expanded.includes(key) ? expanded.filter((k) => k !== key) : [...expanded, key],
    )

  const toggleAllRuns = () =>
    onExpandedChange(
      expanded.length ? [] : segs.filter((s) => s.inner.length).map((s) => s.key),
    )

  const toggleType = (type: TxType) =>
    onDimTypesChange(
      dimTypes.includes(type) ? dimTypes.filter((t) => t !== type) : [...dimTypes, type],
    )

  return (
    <div className={styles.view}>
      <div className={styles.main}>
        <Toolbar
          zoom={zoom}
          onZoomChange={onZoomChange}
          anyExpanded={expanded.length > 0}
          onToggleAllRuns={toggleAllRuns}
          onClearSelection={() => onSelect(null)}
          dimTypes={dimTypes}
          onToggleType={toggleType}
        />
        <Canvas width={view.width} height={view.height} zoom={zoom}>
          <Edges width={view.width} height={view.height} edges={view.edges} />
          {view.runs.map((r) => (
            <RunChip
              key={r.key}
              runKey={r.key}
              x={r.x}
              y={r.y}
              types={r.types}
              expanded={r.expanded}
              dimmed={r.dimmed}
              onToggle={toggleRun}
            />
          ))}
          {view.nodes.map((n) => (
            <NodeCard
              key={n.id}
              id={n.id}
              type={n.type}
              depth={n.depth}
              x={n.x}
              y={n.y}
              tag={n.tag}
              merge={n.merge}
              selected={n.selected}
              dimmed={n.dimmed}
              onSelect={onSelect}
            />
          ))}
        </Canvas>
      </div>
      {panel}
    </div>
  )
}
