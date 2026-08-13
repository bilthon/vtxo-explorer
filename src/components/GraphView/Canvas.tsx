// owner: Phase 2D (graph canvas)
import type { ReactNode } from 'react'
import styles from './Canvas.module.css'

type Props = {
  width: number
  height: number
  zoom: number
  children: ReactNode
}

/** Scrolling dot-grid surface holding the zoomed graph plane. */
export function Canvas({ width, height, zoom, children }: Props) {
  return (
    <div className={`vtx-scroll ${styles.canvas}`}>
      <div className={styles.plane} style={{ width, height, transform: `scale(${zoom})` }}>
        {children}
      </div>
    </div>
  )
}
