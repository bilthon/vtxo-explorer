// owner: Phase 2D (graph canvas)
import { TYPE } from '../../graph/constants'
import type { TxType } from '../../graph/types'
import styles from './Toolbar.module.css'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 1.4
const ZOOM_STEP = 0.15

const LEGEND: readonly TxType[] = ['M', 'T', 'C', 'A']

type Props = {
  zoom: number
  onZoomChange: (zoom: number) => void
  /** Drives the expand/collapse label. */
  anyExpanded: boolean
  onToggleAllRuns: () => void
  onClearSelection: () => void
  /** Types toggled off in the legend; their nodes render dimmed. */
  dimTypes: TxType[]
  onToggleType: (type: TxType) => void
}

export function Toolbar({
  zoom,
  onZoomChange,
  anyExpanded,
  onToggleAllRuns,
  onClearSelection,
  dimTypes,
  onToggleType,
}: Props) {
  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.icon}
        aria-label="Zoom out"
        onClick={() => onZoomChange(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
      >
        −
      </button>
      <button
        type="button"
        className={styles.icon}
        aria-label="Zoom in"
        onClick={() => onZoomChange(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
      >
        +
      </button>
      <button type="button" className={styles.button} onClick={onToggleAllRuns}>
        {anyExpanded ? 'Collapse runs' : 'Expand all runs'}
      </button>
      <button type="button" className={styles.button} onClick={onClearSelection}>
        Clear trace
      </button>
      <div className={styles.spacer} />
      <div className={styles.legend}>
        {LEGEND.map((type) => {
          const on = !dimTypes.includes(type)
          return (
            <button
              key={type}
              type="button"
              className={styles.chip}
              data-type={type}
              data-on={on}
              aria-pressed={on}
              onClick={() => onToggleType(type)}
            >
              <span className={styles.swatch} />
              {TYPE[type].l}
            </button>
          )
        })}
      </div>
    </div>
  )
}
