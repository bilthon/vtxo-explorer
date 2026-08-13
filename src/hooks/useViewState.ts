// owner: Phase 3G (wiring)
//
// URL <-> view state. PLAN.md §1: subject lives in the path, view state in the query
// (`?net=&tab=&sel=`). Network and selected node survive a share; zoom, expanded runs and
// dimmed types deliberately do not — run keys are `txid>txid>txid` triples and would make the
// URL enormous for no real benefit.
import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { NetworkId } from '../lib/networks'
import { resolveNetwork, saveNetwork } from '../lib/networks'
import type { TabId } from '../components/TabBar/TabBar'

const TABS: TabId[] = ['graph', 'table', 'raw']

function asTab(v: string | null): TabId {
  return TABS.includes(v as TabId) ? (v as TabId) : 'graph'
}

export type ViewState = {
  net: NetworkId
  tab: TabId
  /** Selected txid, or null when the trace is cleared. */
  sel: string | null
  setNet: (net: NetworkId) => void
  setTab: (tab: TabId) => void
  setSel: (sel: string | null) => void
}

export function useViewState(): ViewState {
  const [params, setParams] = useSearchParams()

  // `?net=` wins over localStorage; resolveNetwork() encodes that precedence in one call.
  const net = resolveNetwork(params.get('net'))
  const tab = asTab(params.get('tab'))
  const sel = params.get('sel')

  const patch = useCallback(
    (key: string, value: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value === null) next.delete(key)
          else next.set(key, value)
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const setNet = useCallback(
    (id: NetworkId) => {
      saveNetwork(id)
      patch('net', id)
    },
    [patch],
  )

  const setTab = useCallback((id: TabId) => patch('tab', id === 'graph' ? null : id), [patch])
  const setSel = useCallback((id: string | null) => patch('sel', id), [patch])

  return { net, tab, sel, setNet, setTab, setSel }
}
