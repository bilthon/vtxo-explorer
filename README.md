# VTXO Explorer

A mempool.space-style explorer for Arkade VTXOs. Paste a VTXO outpoint (`txid:vout`) and it
resolves the full transaction dependency DAG back to its onchain commitment transaction, then
renders it as a graph, a table, or the raw indexer response.

Static SPA — Vite + React 19 + TypeScript. **No backend.** The browser talks to the Arkade
operator's indexer directly (CORS is open on all three operators), plus a mempool-style block
explorer for commitment-tx block height and time.

## Quickstart

```sh
pnpm install
pnpm dev
```

Then open the dev server URL and paste an outpoint, or click one of the landing-page examples.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm build` | `tsc -b` then `vite build` — **this is the real typecheck gate** |
| `pnpm preview` | Serve the production build |
| `pnpm lint` | oxlint |
| `pnpm test` | Vitest, network tests skipped |
| `VITE_LIVE=1 pnpm test` | Also runs the live smoke test against Mutinynet |

> ⚠ `pnpm tsc --noEmit` is a **no-op** here. The root tsconfig is `files: []` plus project
> references, so bare `tsc` checks nothing and exits 0. Always gate on `pnpm build`.

## Networks

| Network | Operator | Block explorer API |
|---|---|---|
| Mutinynet (default) | `https://mutinynet.arkade.sh` | `https://mutinynet.com/api` |
| Signet | `https://signet.arkade.sh` | `https://mempool.space/signet/api` |
| Mainnet | `https://arkade.computer` | `https://mempool.space/api` |

The last-used network is persisted to `localStorage`; `?net=` in the URL always wins. Switching
network while viewing a VTXO returns to the landing page with the new network selected.

Landing-page examples are hardcoded per network (`src/lib/examples.ts`) because the indexer has
**no enumeration capability** — an unfiltered `GET /v1/indexer/vtxos` answers
`code 3, "missing outpoints or scripts filter"` on every network. Only Mutinynet ships an example;
adding one for signet or mainnet is a one-line edit, but do not guess an outpoint — an unverified
one renders a not-found page.

## Routes

Subject in the path, view state in the query.

```
/                       landing (search + examples)
/tx/:txid               bare txid — probes vouts 0–3 in one request, then redirects or picks
/vtxo/:txid/:vout       the explorer
```

Query params: `?net=` · `?tab=graph|table|raw` · `?sel=<txid>` (selected node). Network and
selection survive a share; zoom and expanded run chips do not.

Search accepts `txid:vout` and bare `txid` only. A bare txid resolves 0–3 in a single batched
request: one hit navigates, several show a picker, none is a not-found, and an unreachable
operator is an error page — not a not-found.

## Layout

```
src/
├── App.tsx          routes + top-level data orchestration
├── graph/           PURE, framework-free, unit-tested: build, layout, ancestry, paths
├── lib/             indexer client, wire types, networks, query parsing, formatting
├── hooks/           useChain, useVtxo, useOperatorHealth, useNow, useViewState
├── components/      Landing, TopBar, SubjectHeader, TabBar, GraphView, TableView,
│                    RawView, Glossary, VoutPicker, states/
├── styles/          reset.css, global.css, tokens.css
└── test/            graph.test.ts, indexer.live.test.ts, fixtures/chain-99.json
```

State is plain `useState` + `useMemo` in `App.tsx` — no Redux, no Zustand, no context. Derived
values are memoized over the graph core.

`src/styles/tokens.css` is the design-token contract (~110 custom properties). Components consume
`var(--…)`; **no literal hexes outside that file.**

## Working with the indexer

Endpoints used:

- `GET /v1/indexer/vtxo/{txid}/{vout}/chain` → `{ chain, page, authToken, nextPageToken }`
- `GET /v1/indexer/vtxos?outpoints={txid}:{vout}` (repeatable) → `{ vtxos, page }`
- `GET /v1/info` → operator config, also the `operator live` health ping

No authentication: the proto declares an `auth` oneof on `GetVtxoChain`, but all three operators
serve it unauthenticated. Do not build an auth path.

Four things that bite:

1. **`spends` mixes outpoint and bare-txid forms.** ARK and TREE spenders emit a bare `txid`;
   CHECKPOINT spenders emit `txid:vout`, and the vout is often not 0. Every parent reference must
   be normalized with `.split(':')[0]` **before** deduping — strip after and `txid:0`/`txid:1`
   survive as two parents of one node, corrupting `parents.length > 1`, which drives merge
   borders, the `MERGE` tag, and keeper selection. Skip the normalization entirely and only 51 of
   101 references resolve; the graph does not fail loudly, it renders a plausible-looking but
   shattered DAG.
2. **The API returns duplicate records** (the reference chain is 107 records / 99 unique txids).
   `buildGraph` dedupes for the graph; the Raw view dedupes separately.
3. **`expiresAt` is a string** of unix seconds. Coerce before arithmetic.
4. **Error shapes differ per endpoint** — the chain endpoint returns HTTP 500 with a gRPC-gateway
   envelope for a missing outpoint. Do not write one handler for both.

Chain results paginate on `nextPageToken` until exhausted or a 2000-node cap, after which the UI
shows a truncation banner.

## The graph core

`src/graph/` is framework-free and unit-tested against `test/fixtures/chain-99.json`, a verbatim
live capture. Four invariants break silently if changed:

- `dep` is the **longest** path from a root, not BFS distance. The memoized walk seeds
  `dep.set(id, 0)` before recursing — that is deliberate cycle protection.
- **Keeper rule:** a node is a keeper iff `parents.length !== 1 || kids.length !== 1 ||
  id === target || dep === 0`. Everything strictly between two keepers with no branching
  collapses into one run chip.
- **Compacted depth `kd`** costs a segment 2 rows if it has inner nodes, 1 otherwise — that is
  what leaves vertical room to draw the chip between its two keepers.
- **Chip column occupancy** (`mid:lane`) is a bug fix, not incidental: parallel branches between
  the same keeper pair each need their own column, or both halves of a merge draw on top of each
  other.

Constants: `NW=278 NH=54 COLW=316 ROWH=78 PADX=40 PADY=36`, chip height 36. Edges are SVG cubic
béziers, vertical-dominant: `M x1 y1 C x1 (y1+0.55·dy), x2 (y2−0.55·dy), x2 y2`. A chip splits its
edge in two.

## Testing

`pnpm test` runs the graph core against the 99-node fixture. The live smoke test exists to catch
upstream API drift and is skipped unless `VITE_LIVE=1` is set, so an unreachable network never
wedges CI.

## Further reading

`PLAN.md` holds the implementation plan: locked decisions, live-probed API facts, the porting
spec for the graph core, deliberate deviations from the design handoff, and what is still open.
