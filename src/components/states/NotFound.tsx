// owner: Phase 2F (table, raw, states, picker)
//
// "This VTXO does not exist" — the *resolved* negative answer, reached only when the operator
// answered and said so. An operator we could not reach renders <FetchError> instead; the two
// must never be confused (PLAN.md §2: gRPC code 13 is INTERNAL, not NOT_FOUND).
//
// Names the network deliberately: the same txid legitimately exists on one network and not
// another, so "doesn't exist" without a network is a misleading statement.
import styles from './NotFound.module.css'

type Props = {
  /** Human label, e.g. "Mutinynet". */
  network: string
  /** The thing that was looked up, e.g. "1291b8…f2:0". Rendered verbatim when given. */
  subject?: string
}

export function NotFound({ network, subject }: Props) {
  return (
    <div className={styles.screen}>
      <div className={styles.panel}>
        <div className={styles.mark} aria-hidden="true">
          ?
        </div>
        <h2 className={styles.title}>VTXO not found</h2>
        <p className={styles.body}>
          This VTXO doesn&rsquo;t exist on <strong className={styles.network}>{network}</strong>.
        </p>
        {subject ? <p className={styles.subject}>{subject}</p> : null}
        <p className={styles.hint}>
          The same txid can exist on another network — check the network selector, or search a
          different outpoint.
        </p>
      </div>
    </div>
  )
}
