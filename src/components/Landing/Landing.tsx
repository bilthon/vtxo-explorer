// owner: Phase 1C (tokens + shell chrome)
import type { NetworkId } from '../../lib/networks'
import { NetworkSwitcher } from '../TopBar/NetworkSwitcher'
import { SEARCH_PLACEHOLDER } from '../TopBar/TopBar'
import styles from './Landing.module.css'

export type LandingExample = { label: string; value: string }

type Props = {
  network: NetworkId
  onNetworkChange: (network: NetworkId) => void
  query: string
  onQueryChange: (query: string) => void
  /** Submitting the form or clicking an example both resolve a query string. */
  onSubmit: (query: string) => void
  /** Empty for networks with no known-good outpoints yet — the row is then omitted. */
  examples: readonly LandingExample[]
}

export function Landing({
  network,
  onNetworkChange,
  query,
  onQueryChange,
  onSubmit,
  examples,
}: Props) {
  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true" />
        <h1 className={styles.wordmark}>VTXO EXPLORER</h1>
      </div>

      <p className={styles.tagline}>Trace a VTXO back to its onchain commitment transaction.</p>

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
          autoFocus
        />
      </form>

      <NetworkSwitcher value={network} onChange={onNetworkChange} />

      {examples.length > 0 && (
        <div className={styles.examples}>
          <span className={styles.examplesLabel}>examples</span>
          <div className={styles.chips}>
            {examples.map((example) => (
              <button
                key={example.value}
                type="button"
                className={styles.chip}
                onClick={() => onSubmit(example.value)}
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
