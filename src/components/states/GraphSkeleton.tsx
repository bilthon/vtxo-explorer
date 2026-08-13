// owner: Phase 2F (table, raw, states, picker)
//
// Loading state. Not designed (PLAN.md §5 item 4) — invented from existing tokens: the real
// dot-grid canvas with node-card-shaped placeholders on the same 316x78 grid the layout uses,
// so the graph does not jump when the data lands.
import { COLW, NH, NW, PADX, PADY, ROWH } from '../../graph/constants'
import styles from './GraphSkeleton.module.css'

/** [lane, row] — a spine with one short branch, roughly what a real chain looks like. */
const CARDS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [1, 2],
  [1, 3],
]

export function GraphSkeleton() {
  return (
    <div className={styles.canvas} role="status" aria-busy="true">
      <span className={styles.srOnly}>Loading dependency graph…</span>
      {CARDS.map(([lane, row], i) => (
        <div
          key={`${lane}:${row}`}
          className={styles.card}
          style={{
            width: NW,
            height: NH,
            transform: `translate(${PADX + lane * COLW}px, ${PADY + row * ROWH}px)`,
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
    </div>
  )
}
