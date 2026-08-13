// owner: Phase 1C (tokens + shell chrome)
import type { NetworkId } from '../../lib/networks'
import { NetworkSwitcher } from './NetworkSwitcher'
import styles from './TopBar.module.css'

/** Only `live` is designed in the handoff; the other two cover the health ping's
 * pre-first-response and failure states. */
export type OperatorStatus = 'live' | 'down' | 'unknown'

const STATUS_LABEL: Record<OperatorStatus, string> = {
  live: 'operator live',
  down: 'operator down',
  unknown: 'checking operator',
}

export const SEARCH_PLACEHOLDER = 'Search a VTXO outpoint - txid:vout'

type Props = {
  network: NetworkId
  onNetworkChange: (network: NetworkId) => void
  query: string
  onQueryChange: (query: string) => void
  onSubmit: (query: string) => void
  status: OperatorStatus
}

export function TopBar({
  network,
  onNetworkChange,
  query,
  onQueryChange,
  onSubmit,
  status,
}: Props) {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true" />
        <span className={styles.wordmark}>VTXO EXPLORER</span>
      </div>

      <NetworkSwitcher value={network} onChange={onNetworkChange} />

      <form
        className={styles.search}
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(query)
        }}
      >
        <input
          className={styles.input}
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={SEARCH_PLACEHOLDER}
          aria-label="Search a VTXO outpoint"
          spellCheck={false}
          autoComplete="off"
        />
      </form>

      <div className={styles.status}>
        <span
          className={styles.dot}
          data-status={status}
          aria-hidden="true"
        />
        <span>{STATUS_LABEL[status]}</span>
      </div>
    </header>
  )
}
