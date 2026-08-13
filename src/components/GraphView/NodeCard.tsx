// owner: Phase 2D (graph canvas)
import { TYPE } from '../../graph/constants'
import type { TxType } from '../../graph/types'
import { short } from '../../lib/format'
import styles from './NodeCard.module.css'

export type NodeTag = 'VTXO' | 'MERGE' | 'ONCHAIN'

type Props = {
  id: string
  type: TxType
  depth: number
  x: number
  y: number
  /** `VTXO` on the target, else `MERGE` / `ONCHAIN`, else nothing. */
  tag: NodeTag | null
  merge: boolean
  selected: boolean
  dimmed: boolean
  onSelect: (id: string) => void
}

export function NodeCard({ id, type, depth, x, y, tag, merge, selected, dimmed, onSelect }: Props) {
  return (
    <button
      type="button"
      className={styles.card}
      data-type={type}
      data-merge={merge}
      data-selected={selected}
      data-dimmed={dimmed}
      aria-pressed={selected}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      onClick={() => onSelect(id)}
    >
      <span className={styles.head}>
        <span className={styles.swatch} />
        <span className={styles.type}>{TYPE[type].l}</span>
        <span className={styles.depth}>DEPTH {depth}</span>
        <span className={styles.spacer} />
        {tag && (
          <span className={styles.tag} data-tag={tag}>
            {tag}
          </span>
        )}
      </span>
      <span className={styles.txid}>{short(id)}</span>
    </button>
  )
}
