// owner: Phase 2D (graph canvas)
import type { TxType } from '../../graph/types'
import styles from './RunChip.module.css'

type Props = {
  /** Segment key, `from>first>to`. */
  runKey: string
  x: number
  y: number
  /** Types of the collapsed nodes, in order. */
  types: TxType[]
  expanded: boolean
  dimmed: boolean
  onToggle: (runKey: string) => void
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function RunChip({ runKey, x, y, types, expanded, dimmed, onToggle }: Props) {
  const checkpoints = types.filter((t) => t === 'C').length
  const label = `${plural(types.length, 'hop')} · ${plural(checkpoints, 'checkpoint')}`

  return (
    <button
      type="button"
      className={styles.chip}
      data-dimmed={dimmed}
      aria-expanded={expanded}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} run of ${label}`}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      onClick={() => onToggle(runKey)}
    >
      <span className={styles.caret}>{expanded ? '–' : '+'}</span>
      <span className={styles.label}>{label}</span>
      <span className={styles.spacer} />
      <span className={styles.dots}>
        {types.slice(0, 9).map((t, i) => (
          <span key={i} className={styles.dot} data-type={t} />
        ))}
      </span>
    </button>
  )
}
