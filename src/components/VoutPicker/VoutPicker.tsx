// owner: Phase 2F (table, raw, states, picker)
//
// Shown when a BARE txid resolves to more than one VTXO. An Arkade transaction usually has
// several outputs (payment + change), each its own VTXO, so "which one did you mean?" is the
// common case rather than an edge case — in the reference chain 28 of 55 checkpoint references
// point at vout 1.
//
// Only the `many` branch of BareTxidResult renders here. `one` navigates straight through,
// `none` is <NotFound>, and `error` is <FetchError> — never <NotFound>, because an unreachable
// operator makes every probe come back empty and would otherwise read as "no VTXOs exist".
import type { BareHit } from '../../lib/parseQuery'
import { sats, short } from '../../lib/format'
import styles from './VoutPicker.module.css'

type Props = {
  txid: string
  hits: BareHit[]
  onPick: (vout: number) => void
}

export function VoutPicker({ txid, hits, onPick }: Props) {
  return (
    <div className={styles.screen}>
      <div className={styles.panel}>
        <p className={styles.kicker}>MULTIPLE OUTPUTS</p>
        <h2 className={styles.title}>This transaction has {hits.length} VTXOs</h2>
        <p className={styles.subject}>{short(txid)}</p>
        <p className={styles.hint}>Pick the output you want to trace.</p>

        <ul className={styles.list}>
          {hits.map((hit) => (
            <li key={hit.vout}>
              <button type="button" className={styles.row} onClick={() => onPick(hit.vout)}>
                <span className={styles.vout}>:{hit.vout}</span>
                <span className={styles.amount}>{sats(hit.amount)} sats</span>
                <span className={styles.spacer} />
                <span className={styles.status}>{hit.status}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
