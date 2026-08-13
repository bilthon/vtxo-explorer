// owner: Phase 3G (wiring)
//
// Handoff README §2 "Subject header". Two columns: identity/facts left, a six-cell stat grid
// right. The stat grid's internal rules are inset box-shadows, NOT borders — that is a
// documented bug fix so the grid's rounded outer edge stays clean.
import { useMemo } from 'react'
import { GlossaryHelp } from '../Glossary/Glossary'
import { countPaths } from '../../graph/paths'
import type { Graph } from '../../graph/types'
import { countdown, sats, secondsUntil, snapshot } from '../../lib/format'
import type { Vtxo, VtxoStatus } from '../../lib/indexer.types'
import styles from './SubjectHeader.module.css'

/** Only PRECONFIRMED is designed in the handoff; the rest reuse existing tokens (PLAN §5 item 3). */
const STATUS_CLASS: Record<VtxoStatus, string> = {
  PRECONFIRMED: styles.statusPreconfirmed,
  SETTLED: styles.statusSettled,
  SPENT: styles.statusSpent,
  SWEPT: styles.statusSwept,
  UNROLLED: styles.statusUnrolled,
}

/** The `?` affordance only has copy for `preconfirmed`; other statuses render without it. */
const STATUS_TERM: Partial<Record<VtxoStatus, string>> = { PRECONFIRMED: 'preconfirmed' }

type Props = {
  txid: string
  vout: number
  graph: Graph
  /** null while the subject lookup is still in flight — facts degrade to em dashes. */
  vtxo: Vtxo | null
  /** ms timestamp of the chain response on screen. */
  snapshotAt: number | null
  /** ms, ticked every second by useNow(). */
  now: number
}

export function SubjectHeader({ txid, vout, graph, vtxo, snapshotAt, now }: Props) {
  const stats = useMemo(() => {
    let edges = 0
    let merges = 0
    let maxDepth = 0
    const byType = { A: 0, C: 0, T: 0, M: 0 }

    graph.nodes.forEach((n) => {
      edges += n.parents.length
      byType[n.type] += 1
      if (n.parents.length > 1) merges += 1
    })
    graph.dep.forEach((d) => {
      if (d > maxDepth) maxDepth = d
    })

    return { edges, merges, maxDepth, byType, paths: countPaths(graph, txid) }
  }, [graph, txid])

  const status = vtxo?.status ?? null
  const term = status ? STATUS_TERM[status] : undefined
  const remaining = vtxo ? secondsUntil(vtxo.expiresAt, now) : null

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.kickerRow}>
          <span className={styles.kicker}>VTXO</span>
          {status ? (
            <span className={`${styles.status} ${STATUS_CLASS[status]}`}>
              <span className={styles.statusDot} aria-hidden="true" />
              {status}
            </span>
          ) : null}
          {term ? <GlossaryHelp term={term} /> : null}
        </div>

        <p className={styles.txid}>
          {txid}
          <span className={styles.vout}>:{vout}</span>
        </p>

        <div className={styles.facts}>
          <span>
            <strong>{vtxo ? sats(vtxo.amount) : '—'}</strong> sats
          </span>
          <span>
            expires in <strong>{remaining === null ? '—' : countdown(remaining)}</strong>
          </span>
          <span>
            depth <strong>{stats.maxDepth}</strong> from Bitcoin
          </span>
          <span>
            snapshot <strong>{snapshotAt ? snapshot(snapshotAt) : '—'}</strong>
          </span>
        </div>
      </div>

      <dl className={styles.stats}>
        <Stat value={graph.nodes.size} label="nodes" />
        <Stat value={stats.edges} label="edges" />
        <Stat value={stats.byType.A} label="arkade tx" tone={styles.toneAccent} />
        <Stat value={stats.byType.C} label="checkpoints" tone={styles.toneMuted} />
        <Stat value={stats.merges} label="merges" tone={styles.tonePurple} />
        <Stat value={stats.paths.toLocaleString('en-US')} label="paths" tone={styles.toneGreen} />
      </dl>
    </header>
  )
}

function Stat({ value, label, tone }: { value: number | string; label: string; tone?: string }) {
  return (
    <div className={styles.cell}>
      <dd className={`${styles.value} ${tone ?? ''}`}>{value}</dd>
      <dt className={styles.label}>{label}</dt>
    </div>
  )
}
