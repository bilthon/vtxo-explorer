// owner: Phase 2F (table, raw, states, picker)
// Full table view — handoff README §5. Presentational: graph in, selection out.
import { useMemo } from 'react'
import { TYPE } from '../../graph/constants'
import type { Graph, TxType } from '../../graph/types'
import { short } from '../../lib/format'
import styles from './TableView.module.css'

type Row = {
  id: string
  depth: number
  type: TxType
  /** short()-ed parents joined per the design, or an em dash for a root. */
  spends: string
}

type Props = {
  graph: Graph
  /** txid of the selected transaction, or null. */
  selected: string | null
  onSelect: (txid: string) => void
}

function toRows(g: Graph): Row[] {
  return Array.from(g.nodes.values())
    .map((n) => ({
      id: n.id,
      depth: g.dep.get(n.id) ?? 0,
      type: n.type,
      spends: n.parents.length ? n.parents.map(short).join('  +  ') : '—',
    }))
    .sort((a, b) => a.depth - b.depth)
}

export function TableView({ graph, selected, onSelect }: Props) {
  const rows = useMemo(() => toRows(graph), [graph])

  return (
    <div className={`vtx-scroll ${styles.body}`}>
      <div
        className={styles.table}
        role="grid"
        aria-label="Chain transactions"
        aria-rowcount={rows.length + 1}
      >
        <div className={`${styles.row} ${styles.head}`} role="row">
          <div role="columnheader">DEPTH</div>
          <div role="columnheader">TYPE</div>
          <div role="columnheader">TRANSACTION ID</div>
          <div role="columnheader">SPENDS</div>
        </div>

        {rows.map((r) => (
          <div
            key={r.id}
            className={styles.row}
            role="row"
            tabIndex={0}
            aria-selected={r.id === selected}
            data-selected={r.id === selected || undefined}
            onClick={() => onSelect(r.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(r.id)
              }
            }}
          >
            <div className={styles.depth} role="gridcell">
              {r.depth}
            </div>
            <div role="gridcell">
              <span className={styles.pill} data-type={r.type}>
                {TYPE[r.type].l}
              </span>
            </div>
            <div className={styles.txid} role="gridcell">
              {r.id}
            </div>
            <div className={styles.spends} role="gridcell">
              {r.spends}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
