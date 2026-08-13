// owner: Phase 1C (tokens + shell chrome)
import type { NetworkId } from '../../lib/networks'
import styles from './NetworkSwitcher.module.css'

/* Type-only import: erases at build time, so the chrome stays presentational.
 * Order is the design's (Mainnet · Mutinynet · Signet), which deliberately
 * differs from the lib's NETWORK_LIST. */
const NETWORK_OPTIONS: readonly { id: NetworkId; label: string }[] = [
  { id: 'mainnet', label: 'Mainnet' },
  { id: 'mutinynet', label: 'Mutinynet' },
  { id: 'signet', label: 'Signet' },
]

type Props = {
  value: NetworkId
  onChange: (network: NetworkId) => void
}

export function NetworkSwitcher({ value, onChange }: Props) {
  return (
    <div className={styles.switcher} role="group" aria-label="Network">
      {NETWORK_OPTIONS.map((network) => (
        <button
          key={network.id}
          type="button"
          className={styles.option}
          aria-pressed={network.id === value}
          onClick={() => onChange(network.id)}
        >
          {network.label}
        </button>
      ))}
    </div>
  )
}
