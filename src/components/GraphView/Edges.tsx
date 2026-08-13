// owner: Phase 2D (graph canvas)
import styles from './Edges.module.css'

export type Edge = {
  key: string
  /** Cubic bézier path, vertical-dominant. */
  d: string
  /** On the selected node's ancestry path. */
  hot: boolean
}

type Props = {
  width: number
  height: number
  edges: Edge[]
}

export function Edges({ width, height, edges }: Props) {
  return (
    <svg className={styles.svg} width={width} height={height} aria-hidden="true">
      {edges.map((e) => (
        <path key={e.key} className={styles.edge} data-hot={e.hot} d={e.d} fill="none" />
      ))}
    </svg>
  )
}
