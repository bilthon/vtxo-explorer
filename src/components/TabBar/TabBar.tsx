// owner: Phase 1C (tokens + shell chrome)
import styles from './TabBar.module.css'

export type TabId = 'graph' | 'table' | 'raw'

const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'graph', label: 'Dependency graph' },
  { id: 'table', label: 'Full table' },
  { id: 'raw', label: 'Raw chain' },
]

type Props = {
  value: TabId
  onChange: (tab: TabId) => void
}

export function TabBar({ value, onChange }: Props) {
  return (
    <div className={styles.bar} role="tablist" aria-label="View">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          className={styles.tab}
          aria-selected={tab.id === value}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
