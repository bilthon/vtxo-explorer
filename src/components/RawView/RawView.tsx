// owner: Phase 2F (table, raw, states, picker)
//
// Raw chain view — handoff README §6, with the two deviations PLAN.md §5 item 6 calls for:
//
//   1. The real payload, not the prototype's first 14 records + "… N more entries".
//   2. Deduped by txid. The indexer returns duplicate records (107 for the 99-node
//      reference chain), so a verbatim render shows the same tx twice.
//
// Virtualized by hand over fixed-height lines — no dependency. The pre-formatted text is
// split into lines once, and only the visible window (plus overscan) is mounted.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { IndexerChain } from '../../lib/indexer.types'
import styles from './RawView.module.css'

/** --fs-control 12px x --lh-raw 1.75. Mirrored by `--raw-line-h` in the module CSS. */
const LINE_H = 21
const OVERSCAN = 20

/**
 * Pretty-printed JSON, one array element per unique record, as an array of lines.
 * Lines never wrap at the shell's 1180px floor (the longest is a ~84-char txid line,
 * ~605px at 12px mono), so a fixed line height is safe.
 */
function buildLines(records: IndexerChain[]): string[] {
  const seen = new Set<string>()
  const unique: IndexerChain[] = []
  for (const r of records) {
    if (seen.has(r.txid)) continue
    seen.add(r.txid)
    unique.push(r)
  }

  const lines = ['[']
  unique.forEach((r, i) => {
    const body = JSON.stringify(
      { txid: r.txid, type: r.type, expiresAt: r.expiresAt, spends: r.spends },
      null,
      2,
    )
      .split('\n')
      .map((l) => '  ' + l)
    if (i < unique.length - 1) body[body.length - 1] += ','
    lines.push(...body)
  })
  lines.push(']')
  return lines
}

type Props = {
  /** Chain records exactly as the indexer returned them, duplicates included. */
  records: IndexerChain[]
}

export function RawView({ records }: Props) {
  const lines = useMemo(() => buildLines(records), [records])
  const viewRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)

  useEffect(() => {
    const el = viewRef.current
    if (!el) return
    setViewportH(el.clientHeight)
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const start = Math.max(0, Math.floor(scrollTop / LINE_H) - OVERSCAN)
  const end = Math.min(lines.length, Math.ceil((scrollTop + viewportH) / LINE_H) + OVERSCAN)
  const window = lines.slice(start, end).join('\n')

  return (
    <div
      ref={viewRef}
      className={`vtx-scroll ${styles.view}`}
      role="region"
      aria-label="Raw indexer chain JSON"
      tabIndex={0}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div className={styles.spacer} style={{ height: lines.length * LINE_H }}>
        <pre className={styles.pre} style={{ transform: `translateY(${start * LINE_H}px)` }}>
          {window}
        </pre>
      </div>
    </div>
  )
}
