// owner: Phase 2F (table, raw, states, picker)
//
// "We could not get an answer" — deliberately distinct from <NotFound>, which is the *resolved*
// negative. Keeping these apart is the whole point of the distinction documented in PLAN.md §2:
// gRPC code 13 is INTERNAL, not NOT_FOUND, so a genuine operator fault can arrive looking exactly
// like a missing VTXO. The user must never be told a VTXO doesn't exist when the truth is that
// the operator was unreachable.
//
// Visual separation from NotFound is intentional and load-bearing: amber framing rather than
// muted, a retry affordance rather than a redirect hint.
import styles from './FetchError.module.css'

type Props = {
  /** Human label, e.g. "Mutinynet". */
  network: string
  /** Operator-supplied or transport message. Rendered verbatim when given. */
  message?: string
  onRetry?: () => void
}

export function FetchError({ network, message, onRetry }: Props) {
  return (
    <div className={styles.screen}>
      <div className={styles.panel} role="alert">
        <div className={styles.mark} aria-hidden="true">
          !
        </div>
        <h2 className={styles.title}>Couldn&rsquo;t reach the operator</h2>
        <p className={styles.body}>
          The <strong className={styles.network}>{network}</strong> operator didn&rsquo;t answer.
          This says nothing about whether the VTXO exists.
        </p>
        {message ? <p className={styles.detail}>{message}</p> : null}
        {onRetry ? (
          <button type="button" className={styles.retry} onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    </div>
  )
}
