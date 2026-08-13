// owner: Phase 3G (wiring)
//
// Routes (PLAN.md §1): subject in the path, view state in the query.
//   /                     landing
//   /tx/:txid             bare txid -> resolve vouts 0-3, then redirect or pick
//   /vtxo/:txid/:vout     the explorer
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'

import { TopBar } from './components/TopBar/TopBar'
import { TabBar } from './components/TabBar/TabBar'
import { Landing } from './components/Landing/Landing'
import { SubjectHeader } from './components/SubjectHeader/SubjectHeader'
import { GraphView } from './components/GraphView/GraphView'
import { DetailPanel } from './components/GraphView/DetailPanel'
import { TableView } from './components/TableView/TableView'
import { RawView } from './components/RawView/RawView'
import { GraphSkeleton } from './components/states/GraphSkeleton'
import { NotFound } from './components/states/NotFound'
import { FetchError } from './components/states/FetchError'
import { VoutPicker } from './components/VoutPicker/VoutPicker'

import { buildGraph } from './graph/build'
import { ancestry } from './graph/ancestry'
import { countPaths } from './graph/paths'
import type { TxType } from './graph/types'
import { NETWORKS, type NetworkId } from './lib/networks'
import { examplesFor } from './lib/examples'
import { parseQuery, resolveBareTxid, type BareTxidResult } from './lib/parseQuery'
import { secondsUntil } from './lib/format'
import { useViewState } from './hooks/useViewState'
import { useChain } from './hooks/useChain'
import { useVtxo } from './hooks/useVtxo'
import { useNow } from './hooks/useNow'
import { useOperatorHealth } from './hooks/useOperatorHealth'
import styles from './App.module.css'

/** Turns a submitted query string into a route, or an inline complaint. */
function useSubmitQuery(net: NetworkId) {
  const navigate = useNavigate()
  const [queryError, setQueryError] = useState<string | null>(null)

  const submit = useCallback(
    (raw: string) => {
      const parsed = parseQuery(raw)
      if (parsed.kind === 'invalid') {
        setQueryError(parsed.message)
        return
      }
      setQueryError(null)
      const q = `?net=${net}`
      if (parsed.kind === 'outpoint') {
        navigate(`/vtxo/${parsed.outpoint.txid}/${parsed.outpoint.vout}${q}`)
      } else {
        navigate(`/tx/${parsed.txid}${q}`)
      }
    },
    [navigate, net],
  )

  return { submit, queryError }
}

function LandingRoute() {
  const { net, setNet } = useViewState()
  const [query, setQuery] = useState('')
  const { submit, queryError } = useSubmitQuery(net)

  const examples = useMemo(
    () => examplesFor(net).map((e) => ({ label: e.label, value: `${e.txid}:${e.vout}` })),
    [net],
  )

  return (
    <main className={styles.landing}>
      <Landing
        network={net}
        onNetworkChange={setNet}
        query={query}
        onQueryChange={setQuery}
        onSubmit={submit}
        examples={examples}
      />
      {queryError ? (
        <p className={styles.queryError} role="alert">
          {queryError}
        </p>
      ) : null}
    </main>
  )
}

/**
 * A bare txid names a transaction, not a VTXO — an Arkade tx usually has several outputs, each
 * its own VTXO. Resolve vouts 0-3 in one request, then redirect or ask.
 */
function BareTxidRoute() {
  const { txid = '' } = useParams()
  const { net } = useViewState()
  const navigate = useNavigate()
  const [result, setResult] = useState<BareTxidResult | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setResult(null)
    resolveBareTxid(net, txid, ac.signal).then((r) => {
      if (!ac.signal.aborted) setResult(r)
    })
    return () => ac.abort()
  }, [net, txid])

  const go = useCallback(
    (vout: number) => navigate(`/vtxo/${txid}/${vout}?net=${net}`, { replace: true }),
    [navigate, net, txid],
  )

  useEffect(() => {
    if (result?.kind === 'one') go(result.hits[0].vout)
  }, [result, go])

  if (!result || result.kind === 'one') return <Shell net={net}>{<GraphSkeleton />}</Shell>

  return (
    <Shell net={net}>
      {result.kind === 'many' ? (
        <VoutPicker txid={txid} hits={result.hits} onPick={go} />
      ) : result.kind === 'error' ? (
        // Never NotFound: an unreachable operator makes every probe come back empty, which
        // would otherwise read as "this txid has no VTXOs".
        <FetchError network={NETWORKS[net].label} message={result.message} />
      ) : (
        <NotFound network={NETWORKS[net].label} subject={txid} />
      )}
    </Shell>
  )
}

function ExplorerRoute() {
  const { txid = '', vout: voutParam = '0' } = useParams()
  const vout = Number(voutParam)
  const { net, setNet, tab, setTab, sel, setSel } = useViewState()
  const navigate = useNavigate()

  const outpoint = useMemo(() => ({ txid, vout }), [txid, vout])
  const { state, snapshotAt, refresh } = useChain(net, outpoint)
  const vtxoState = useVtxo(net, outpoint)
  const now = useNow()

  const [zoom, setZoom] = useState(1)
  const [expanded, setExpanded] = useState<string[]>([])
  const [dimTypes, setDimTypes] = useState<TxType[]>([])

  // Switching network abandons the subject: the same txid rarely exists on two networks.
  const onNetworkChange = useCallback(
    (id: NetworkId) => {
      setNet(id)
      navigate(`/?net=${id}`)
    },
    [navigate, setNet],
  )

  const [query, setQuery] = useState('')
  const { submit, queryError } = useSubmitQuery(net)

  const graph = useMemo(
    () => (state.status === 'ready' ? buildGraph(state.value.chain) : null),
    [state],
  )

  // Initial selection is the target VTXO (handoff: "Initial selection is the target").
  const selected = sel ?? txid
  const vtxo = vtxoState.status === 'ready' ? vtxoState.value : null
  const pathCount = useMemo(() => (graph ? countPaths(graph, txid) : 0n), [graph, txid])

  const selection = useMemo(() => {
    if (!graph) return null
    const node = graph.nodes.get(selected)
    if (!node) return null
    const kids = graph.kids.get(selected) ?? []
    return {
      txid: selected,
      type: node.type,
      depth: graph.dep.get(selected) ?? 0,
      parents: node.parents
        .filter((p) => graph.nodes.has(p))
        .map((p) => ({ id: p, type: graph.nodes.get(p)!.type })),
      spentBy: kids.length ? kids[0] : null,
      ancestorCount: ancestry(graph, selected).up.size,
      nodeCount: graph.nodes.size,
      expiresInSeconds: vtxo ? secondsUntil(vtxo.expiresAt, now) : 0,
    }
  }, [graph, selected, vtxo, now])

  return (
    <Shell
      net={net}
      onNetworkChange={onNetworkChange}
      query={query}
      onQueryChange={setQuery}
      onSubmit={submit}
    >
      {queryError ? (
        <p className={styles.queryErrorBar} role="alert">
          {queryError}
        </p>
      ) : null}

      {state.status === 'notFound' ? (
        <NotFound network={NETWORKS[net].label} subject={`${txid}:${vout}`} />
      ) : state.status === 'error' ? (
        <FetchError network={NETWORKS[net].label} message={state.message} onRetry={refresh} />
      ) : !graph ? (
        <GraphSkeleton />
      ) : (
        <>
          <SubjectHeader
            txid={txid}
            vout={vout}
            graph={graph}
            vtxo={vtxo}
            snapshotAt={snapshotAt}
            now={now}
          />
          {state.status === 'ready' && state.value.truncated ? (
            <p className={styles.truncated} role="status">
              Chain truncated at {graph.nodes.size} nodes — this VTXO's history is longer than the
              explorer renders.
            </p>
          ) : null}

          <TabBar value={tab} onChange={setTab} />

          {tab === 'graph' ? (
            <GraphView
              graph={graph}
              target={txid}
              selected={selected}
              expanded={expanded}
              zoom={zoom}
              dimTypes={dimTypes}
              onSelect={setSel}
              onExpandedChange={setExpanded}
              onZoomChange={setZoom}
              onDimTypesChange={setDimTypes}
              panel={
                <DetailPanel selection={selection} pathCount={pathCount} onSelect={setSel} />
              }
            />
          ) : tab === 'table' ? (
            <TableView graph={graph} selected={selected} onSelect={setSel} />
          ) : (
            <RawView records={state.status === 'ready' ? state.value.chain : []} />
          )}
        </>
      )}
    </Shell>
  )
}

type ShellProps = {
  net: NetworkId
  onNetworkChange?: (id: NetworkId) => void
  query?: string
  onQueryChange?: (q: string) => void
  onSubmit?: (q: string) => void
  children: React.ReactNode
}

/** The explorer chrome. Keeps the handoff's 1180px floor; the landing deliberately does not. */
function Shell({ net, onNetworkChange, query, onQueryChange, onSubmit, children }: ShellProps) {
  const { setNet } = useViewState()
  const health = useOperatorHealth(net)
  const [localQuery, setLocalQuery] = useState('')

  return (
    <div className={styles.shell}>
      <TopBar
        network={net}
        onNetworkChange={onNetworkChange ?? setNet}
        query={query ?? localQuery}
        onQueryChange={onQueryChange ?? setLocalQuery}
        onSubmit={onSubmit ?? (() => {})}
        status={health}
      />
      {children}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/tx/:txid" element={<BareTxidRoute />} />
        <Route path="/vtxo/:txid/:vout" element={<ExplorerRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
