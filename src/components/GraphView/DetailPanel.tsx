// owner: Phase 2E (detail panel)
// Four stacked blocks per the handoff README §4 "Detail panel (384px)".
// Presentational: props in, callbacks out. No "Open in explorer" button (PLAN §5 item 2).
import { useEffect, useRef, useState } from 'react'
import { GlossaryTerm } from '../Glossary/Glossary'
import { TYPE } from '../../graph/constants'
import type { TxType } from '../../graph/types'
import { countdownShort, short } from '../../lib/format'
import styles from './DetailPanel.module.css'

export type DetailPanelParent = {
  id: string
  type: TxType
}

export type DetailPanelSelection = {
  txid: string
  type: TxType
  depth: number
  /** Parents present in the graph — drives both the SPENDS rows and the Inputs count. */
  parents: DetailPanelParent[]
  /** The tx that spends this one. `null` on the target VTXO. */
  spentBy: string | null
  ancestorCount: number
  /** Total nodes in the graph; "Ancestors" reads `k of nodeCount - 1`. */
  nodeCount: number
  expiresInSeconds: number
}

type Props = {
  selection: DetailPanelSelection | null
  /** Simple-path count from `countPaths()`. BigInt — it doubles per merge. */
  pathCount: bigint
  onSelect: (txid: string) => void
}

const TYPE_CLASS: Record<TxType, string> = {
  A: styles.typeA,
  C: styles.typeC,
  T: styles.typeT,
  M: styles.typeM,
}

const COPY_REVERT_MS = 2000
const ABBREVIATE_AT = 10n ** 12n

/** Grouped digits, abbreviated above 10^12 (PLAN §5 item 10). Never coerced to Number. */
function formatPathCount(n: bigint): string {
  if (n < ABBREVIATE_AT) return n.toLocaleString('en-US')
  const digits = n.toString()
  return `${digits[0]}.${digits.slice(1, 3)}e${digits.length - 1}`
}

type CopyState = 'idle' | 'copied' | 'failed'

const COPY_LABEL: Record<CopyState, string> = {
  idle: 'Copy full txid',
  copied: 'Copied',
  failed: 'Copy failed',
}

const COPY_ANNOUNCEMENT: Record<CopyState, string> = {
  idle: '',
  copied: 'Full txid copied to clipboard',
  failed: 'Could not copy the txid to the clipboard',
}

export function DetailPanel({ selection, pathCount, onSelect }: Props) {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (revertTimer.current !== null) clearTimeout(revertTimer.current)
    },
    [],
  )

  async function copyTxid() {
    if (!selection) return
    if (revertTimer.current !== null) clearTimeout(revertTimer.current)
    try {
      // Absent on insecure origins, and the write itself can reject.
      await navigator.clipboard.writeText(selection.txid)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    revertTimer.current = setTimeout(() => setCopyState('idle'), COPY_REVERT_MS)
  }

  const fields = selection
    ? [
        ['Depth', String(selection.depth)],
        [
          'Inputs',
          selection.parents.length > 1
            ? `${selection.parents.length} (merge)`
            : String(selection.parents.length),
        ],
        [
          'Spent by',
          selection.spentBy ? short(selection.spentBy) : 'None — this is the VTXO',
        ],
        ['Ancestors', `${selection.ancestorCount} of ${selection.nodeCount - 1}`],
        ['Expires', countdownShort(selection.expiresInSeconds)],
      ]
    : []

  return (
    <aside className={`vtx-scroll ${styles.panel}`} aria-label="Transaction detail">
      <div className={styles.block}>
        <div className={styles.kicker}>TRANSACTION</div>
        {selection ? (
          <>
            <span className={`${styles.pill} ${TYPE_CLASS[selection.type]}`}>
              <span className={styles.pillDot} />
              {TYPE[selection.type].l}
            </span>
            <div className={styles.txid}>{selection.txid}</div>
            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={copyTxid}>
                {COPY_LABEL[copyState]}
              </button>
            </div>
          </>
        ) : (
          <div className={styles.txid}>No transaction selected</div>
        )}
      </div>

      {selection && (
        <div className={styles.block}>
          <dl className={styles.fields}>
            {fields.map(([key, value]) => (
              <div className={styles.field} key={key}>
                <dt className={styles.fieldKey}>{key}</dt>
                <dd className={styles.fieldValue}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {selection && selection.parents.length > 0 && (
        <div className={styles.block}>
          <div className={`${styles.kicker} ${styles.kickerTight}`}>SPENDS</div>
          <div className={styles.spends}>
            {selection.parents.map(parent => (
              <button
                type="button"
                key={parent.id}
                className={`${styles.spend} ${TYPE_CLASS[parent.type]}`}
                onClick={() => onSelect(parent.id)}
              >
                <span className={styles.spendDot} />
                <span className={styles.spendTxid}>{short(parent.id)}</span>
                <span className={styles.spendType}>{TYPE[parent.type].l}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.block}>
        <p className={styles.explainer}>
          Selecting a transaction highlights its full ancestry back to the{' '}
          <GlossaryTerm term="commitment">commitment transaction</GlossaryTerm> and dims
          everything else. Runs of unbranched{' '}
          <GlossaryTerm term="checkpoint">checkpoints</GlossaryTerm> collapse into one segment —
          click a segment to open it.
        </p>
        <p className={styles.pathNote}>
          {formatPathCount(pathCount)} simple graph paths. They are not alternatives: every
          multi-input merge requires both branches, so the complete ancestry is their union.
        </p>
      </div>

      <span role="status" aria-live="polite" className={styles.srOnly}>
        {COPY_ANNOUNCEMENT[copyState]}
      </span>
    </aside>
  )
}
