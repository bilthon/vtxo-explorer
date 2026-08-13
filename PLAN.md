# VTXO Explorer — Implementation Plan

A mempool.space-style explorer for Arkade VTXOs. Landing page is a bare search bar; pasting a
VTXO outpoint (`txid:vout`) resolves the full transaction dependency DAG back to its onchain
commitment transaction and renders it per the design handoff at
`/Users/bilthon/Development/Arkade/Projects/design_handoff_vtxo_explorer`.

---

## 0. Status

| Phase | State |
|---|---|
| 0 scaffold · 1A graph core · 1B data layer · 1C tokens+shell · 1.5 strict | ✅ |
| 2D graph canvas · 2E detail panel | ✅ (agents ended without reports; verified by inspection) |
| 2F table/raw/states/picker | ✅ (agent hit the account spend limit mid-run; `NotFound.module.css`, `FetchError`, `VoutPicker` finished inline) |
| 3G wiring — `App.tsx`, `App.module.css`, `useViewState`, `SubjectHeader` | ✅ (done inline; spawns were blocked by the spend limit) |
| 3H additional tests | ⬜ pending |
| 3I independent review | ⬜ **deferred** until the spend limit is lifted — the builder–validator rule matters most for 2F's tail and 3G, which the orchestrator wrote |

**Verified end-to-end against live Mutinynet** (headless Chrome over the production build):
stat grid `99 · 101 · 47 · 50 · 3 · 8`, depth 95, `PRECONFIRMED` pill, 52 node cards + 10 run
chips + bézier edges, all three tabs, not-found naming the network, landing examples present on
Mutinynet and absent on Mainnet, and `?sel=` deep-link restore.

⚠ **`pnpm tsc --noEmit` is a no-op in this repo** — the root tsconfig is `files: []` + project
references, so bare `tsc` checks nothing and reports success. **The real typecheck gate is
`pnpm build` (`tsc -b`).** A signature error slipped past `tsc --noEmit` and was only caught by
`pnpm build`.

## 1. Locked decisions

| Area | Decision |
|---|---|
| Stack | Vite + React 19 + TypeScript, static SPA. **No backend.** |
| Styling | CSS Modules + a single `tokens.css` of CSS custom properties, mapped 1:1 to the handoff's token table |
| Data layer | Hand-written thin `fetch` client (~80 lines). **Do not install `@arkade-os/sdk`** |
| Landing | Centered wordmark + network switcher + one search input + 2–3 clickable example txids per network |
| Search v1 | `txid:vout` and bare `txid` only. Arkade-address and commitment-txid lookup are **out of scope** |
| Bare txid | Probe vouts 0–3 in **one** request (repeated `outpoints=` params). 1 hit → navigate; >1 → picker showing amount + status per hit; 0 → not-found; operator unreachable → error, **not** not-found |
| Wordmark | **`VTXO EXPLORER`** (not the handoff's `VTXOSCOPE`), same treatment: 700 14px, `.22em`, amber 11×11 square |
| Network switch | While viewing a VTXO, switching network **returns to the landing page** with the new network selected |
| Routing | Subject in path, view state in query: `/vtxo/{txid}/{vout}?net=&tab=&sel=` |
| Default network | Mutinynet; last-used persisted to `localStorage`; `?net=` always wins |
| Liveness | `operator live` dot = periodic `GET /v1/info` health ping. Chain is a per-search snapshot + manual refresh. Countdown ticks live at 1s |
| Pagination | Follow `nextPageToken` until exhausted or a 2000-node cap, then show a truncation banner |
| Responsive | Explorer view honors the 1180px floor with horizontal scroll; **landing page reflows to phone widths** |
| "Open in explorer" | **Removed.** Detail panel keeps only *Copy full txid* |
| Testing | Vitest over the graph core against the 99-node fixture, plus one live smoke test against Mutinynet |
| Package manager | pnpm |

---

## 2. Verified API facts

All three operators were probed live. **These are confirmed, not assumed.**

```
Mainnet    https://arkade.computer
Mutinynet  https://mutinynet.arkade.sh
Signet     https://signet.arkade.sh
```

- `GET /v1/indexer/vtxo/{txid}/{vout}/chain` → `{ chain: IndexerChain[], page, authToken, nextPageToken }`
- `GET /v1/indexer/vtxos?outpoints={txid}:{vout}` → `{ vtxos: IndexerVtxo[], page }`
- `GET /v1/info` → operator config (`network`, `signerPubkey`, `dust`, …)

**There is no enumeration capability.** `GET /v1/indexer/vtxos` with no filter returns
`{"code":3,"message":"missing outpoints or scripts filter"}` / HTTP 400. The indexer only answers
questions about outpoints or scripts you already know — no "recent", no "list all", on any
network. Consequences: landing-page examples must be hardcoded, and a "recent activity" feed is
impossible without an external data source.

**No authentication required.** The proto declares an `auth` oneof (`IndexerIntent` | `token`) on
`GetVtxoChain`, but all three operators serve it unauthenticated. Do not build an auth path.

**CORS is fully open** (`access-control-allow-origin: *`) — the browser calls the indexer directly.

```ts
type IndexerChain = {
  txid: string;
  expiresAt: string;   // unix seconds, as a STRING
  type: 'INDEXER_CHAINED_TX_TYPE_COMMITMENT' | '..._ARK' | '..._TREE' | '..._CHECKPOINT';
  spends: string[];
};
```

### Three gotchas the static prototype hides

1. **`spends` mixes outpoint and bare-txid forms, correlated with the spender's role:**

   | Spending tx | Format | References |
   |---|---|---|
   | ARK | bare `txid` | a CHECKPOINT |
   | TREE | bare `txid` | the COMMITMENT |
   | CHECKPOINT | `txid:vout` | an ARK or TREE output |

   The vout is emitted only where it disambiguates: a checkpoint checkpoints one *specific*
   output of an ark tx, and ark txs have several outputs (payment, change) each with its own
   checkpoint. **The vout is not always 0** — in the reference chain, 28 of 55 are vout `1`.

   **Every parent reference must be normalized with `.split(':')[0]` before graph construction.**
   Without it only **51 of 101** references resolve to a node — the graph does not fail loudly,
   it silently drops half its edges and renders a plausible-looking but shattered DAG.

   **Strip before deduping, not after.** `Array.from(new Set(r.s))` on raw strings would keep
   `txid:0` and `txid:1` as two parents of the same node, corrupting `parents.length > 1` — which
   drives merge borders, the `MERGE` tag, and keeper selection. This case does not occur in the
   reference chain (verified: 0 occurrences); the guard is defensive and costs one line.
2. **The API returns duplicate records.** The reference chain is 107 records / 99 unique txids.
   `build()`'s `if (!nodes.has(r.t))` already dedupes for the graph, but the Raw view must dedupe
   too or it shows the same tx twice.
3. **`expiresAt` is a string,** not a number. Coerce before arithmetic.

### Error shape — differs per endpoint. Do not write one handler for both.

**Chain endpoint**, missing outpoint → **HTTP 500**, gRPC-gateway envelope:

```json
{ "code": 13, "message": "vtxo not found for outpoint: [<txid>:<vout>]", "details": [] }
```

**Vtxos endpoint**, missing outpoint → **HTTP 200 `{"vtxos":[],"page":null}`**. There is no
code-13 path here at all. "Subject not found" is an empty array, not an error envelope.

⚠ **Match on `code === 13` AND a message containing "not found" — never the code alone.**
gRPC code 13 is `INTERNAL`, the generic server-fault code; `NOT_FOUND` is 5. Arkade returns 13
for a missing outpoint, so keying on the code alone silently reclassifies real operator faults as
"this VTXO does not exist". Requiring the message to corroborate keeps genuine failures in the
error state.

### Pagination — the request param is NOT the response field name

⚠ The response carries `nextPageToken`, but the request param is **`pageToken`**. The gateway
**ignores unknown query params instead of rejecting them**, so a client that sends
`?nextPageToken=` receives page 1 forever — a silent infinite loop that only manifests on a chain
large enough to paginate. Verified: `?nextPageToken=abc` returns all 107 records with no error;
`?pageToken=abc` returns `code 3, "invalid page_token: invalid JSON"`. The token is
base64-of-JSON; round-trip response `nextPageToken` → request `pageToken`.

A **second, independent paging mechanism also works** and is the fallback if the token path turns
out to be vestigial: `?page.size=N&page.index=N` → `page: {current, next, total}` where `total`
is a page *count* and `index` is **1-based** (0 and 1 both yield page 1; `next` clamps to `total`).
Verified: `page.size=10` → 10 records, `{current:1, next:2, total:11}`.

Unpaginated requests return everything with `page: null`, so neither path is exercised by the
reference chain — **construct a stubbed-fetch test rather than relying on live data**.

### Batch outpoint lookup

`outpoints=` accepts **repeated params** in a single request:
`?outpoints=T:0&outpoints=T:1&outpoints=T:2` returns only those that exist. `resolveBareTxid()`
uses one request for vouts 0–3 rather than four concurrent ones.

### Reference dataset (use as the test fixture)

`1291b80b71e2b289699b418543a3aa3f7e550a7385fc228bf972ae4954bd60f2:0` on Mutinynet.

Raw response: 107 records · 50 ARK · 55 CHECKPOINT · 1 TREE · 1 COMMITMENT.
After strip-then-dedupe: **99 nodes · 101 edges · 3 merge nodes · max depth 95**,
type counts **47 ARK · 50 CHECKPOINT · 1 TREE · 1 COMMITMENT** (= 99).
Subject: 600 sats · `isPreconfirmed: true` · `expiresAt 1788857636`.

⚠ **Two different "depth" metrics exist. Do not conflate them** (I did, in an earlier revision):

| Metric | Value | Source |
|---|---|---|
| Graph longest path | **95** | Derived by `buildGraph`. Counts every node, checkpoints included |
| Indexer `depth` field | **47** | `GetVtxos` response. Counts Arkade tx hops only |

Checkpoints interleave between ark txs, so the graph value is ≈2× the indexer's. The handoff's
template renders the **graph-derived** value in `depth {maxDepth} from Bitcoin`, so **95 is what
the UI shows**. Confirmed by running the prototype's own `build()` over the handoff's `chain.js`.

Likewise the stat grid's per-type counts are **deduped node** counts (47/50), not raw record
counts (50/55). The prototype's `byType` iterates the node map, not the response array.

These numbers are cross-validated: the handoff's own pre-deduped `chain.js` (99 records) yields
the identical 99 / 101 / 3, so a correct live pipeline reproduces the design's stat grid exactly.
**If your port reports 107 nodes or 111 edges, dedupe or stripping is wrong.**

Spent VTXOs resolve fine (returns ancestors only — no descendants).
Commitment txids do **not** resolve on the chain endpoint.

---

## 3. Architecture

```
vtxo-explorer/
├── index.html
├── package.json  tsconfig.json  vite.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx                     # routes + top-level data orchestration
│   ├── styles/
│   │   ├── reset.css
│   │   └── tokens.css              # THE design token file — single owner
│   ├── lib/
│   │   ├── examples.ts             # hardcoded landing examples, per network (owner 1B)
│   │   ├── networks.ts             # network registry, default, localStorage
│   │   ├── indexer.ts              # thin fetch client
│   │   ├── indexer.types.ts        # wire types from the proto
│   │   ├── parseQuery.ts           # search string -> Outpoint | ParseError
│   │   └── format.ts               # short(), countdown(), sats(), snapshot()
│   ├── graph/                      # PURE, framework-free, fully unit-tested
│   │   ├── constants.ts            # TYPE map + NW/NH/COLW/ROWH/PADX/PADY
│   │   ├── types.ts
│   │   ├── build.ts
│   │   ├── layout.ts
│   │   ├── ancestry.ts
│   │   └── paths.ts
│   ├── hooks/
│   │   ├── useChain.ts             # fetch + paginate + cap
│   │   ├── useVtxo.ts              # subject amount/status/expiry
│   │   ├── useOperatorHealth.ts    # /v1/info ping
│   │   ├── useNow.ts               # 1s tick, cleared on unmount
│   │   └── useViewState.ts         # URL <-> {net, tab, sel}
│   ├── components/
│   │   ├── Landing/
│   │   ├── TopBar/                 # logo, network switcher, search, live dot
│   │   ├── SubjectHeader/          # kicker, status pill, txid, facts, stat grid
│   │   ├── TabBar/
│   │   ├── GraphView/
│   │   │   ├── GraphView.tsx  Toolbar.tsx  Canvas.tsx
│   │   │   ├── NodeCard.tsx   RunChip.tsx  Edges.tsx
│   │   │   └── DetailPanel.tsx
│   │   ├── TableView/
│   │   ├── RawView/
│   │   ├── Glossary/               # viewport-fixed tooltip + TERMS
│   │   ├── VoutPicker/             # bare-txid multi-hit picker (owner 2F)
│   │   └── states/                 # GraphSkeleton, NotFound, FetchError
│   └── test/
│       ├── fixtures/chain-99.json  # captured live response, verbatim
│       ├── graph.test.ts
│       └── indexer.live.test.ts
```

**State** lives in `App.tsx` as plain `useState` + `useMemo`: `sel, expanded, tab, net, zoom,
dimTypes, copied` — plus `now` from `useNow()`. **No Redux, no Zustand, no context gymnastics.**
Derived values are `useMemo` over the graph core.

`tip` is deliberately **not** App state, unlike the handoff's 9-field list: each glossary trigger
portals its own viewport-fixed tooltip to `<body>`, so no phase does prop plumbing for it.

The design-token contract lives in `src/styles/tokens.css` (~110 custom properties, established
by 1C). Components consume `var(--…)`; **no literal hexes outside that file**. Type pills need
`{type}55` border + `{type}14` background — use the per-type tokens rather than concatenating
hex strings.

---

## 4. The graph core — porting spec

This is the only genuinely subtle part. It is framework-agnostic and lives in
`VTXO Explorer.dc.html:244-354`. **Port it close to verbatim**, converting to typed exported
functions instead of class methods. Threading a mutable `this.state` through is not allowed —
each function takes explicit arguments.

| Prototype | Port to |
|---|---|
| `build(raw)` :244 | `buildGraph(records: IndexerChain[]): Graph` — dedupe by txid, normalize `spends` (strip `:vout`), reverse `kids` map, memoized longest-path `dep` |
| `ancestry(id)` :265 | `ancestry(g, id): { up: Set<string>; down: Set<string> }` — iterative up/down DFS |
| `layout()` :281 | `layout(g, target, expanded): Layout` — keeper selection, run segments, compacted depth `kd`, lane assignment, chip column occupancy |
| `paths(target)` :482 | `countPaths(g, id): number` — memoized sum over parents |

Constants: `NW=278 NH=54 COLW=316 ROWH=78 PADX=40 PADY=36`, chip height 36.
Positions: `x = PADX + lane*COLW`, `y = PADY + kd*ROWH`, chip `y = PADY + mid*ROWH + 9`.

Four things that will silently break if changed:

1. **`dep` is the *longest* path from a root**, not BFS distance. The memoized `walk` seeds
   `dep.set(id, 0)` *before* recursing — that is deliberate cycle protection. Keep it.
2. **Keeper rule** (`layout` :285-288): a node is a keeper iff
   `parents.length !== 1 || kids.length !== 1 || id === target || dep === 0`.
   Everything strictly between two keepers with no branching collapses into one run chip.
3. **Compacted depth `kd`** costs a segment **2 rows if it has inner nodes, 1 otherwise** — this
   is what leaves vertical room to draw the chip between its two keepers.
4. **The chip column-occupancy set** (`layout` :340-349) is a bug fix, not incidental. Parallel
   branches between the same pair of keepers must each get their own column; without the
   `chipOcc` `mid:lane` guard, both halves of a merge draw on top of each other. **Assert this
   in a test.**

Edges are SVG cubic béziers, vertical-dominant:
`M x1 y1 C x1 (y1+0.55·dy), x2 (y2−0.55·dy), x2 y2`. A chip splits its edge into two.

**Dead code — do not port.** `renderVals()` also builds `ribbon`, `ribbonRows`, `mergeMap`,
`merges`, `hoverDepth`, `focus*`, and an `allRows` that sorts on a nonexistent `n.depth`. These
belong to two abandoned design directions and are rendered by nothing. The handoff README
confirms this at its "Dead code to ignore" section.

---

## 5. Deviations from the handoff (deliberate, flag to the designer)

| # | Deviation | Reason |
|---|---|---|
| 1 | Landing page invented | The handoff starts at a resolved VTXO; no landing screen exists |
| 2 | "Open in explorer" button removed | Explicit product decision; only *Copy full txid* remains |
| 3 | Status pill generalized | Handoff only designs `PRECONFIRMED` (`#EAB040`). Add, reusing existing tokens: `SETTLED` `#4FD1A5`, `SPENT` `#7C8798`, `SWEPT` `#B08CF0`, `UNROLLED` `#B08CF0`. Same pill geometry |
| 4 | Loading / not-found / error states invented | Handoff explicitly leaves these open |
| 5 | Truncation banner invented | New, for the pagination cap |
| 6 | Raw view shows real deduped payload, virtualized | Handoff truncates at 14 records and says to fix this in production |
| 7 | `Copy full txid` actually writes to the clipboard and reverts the label after 2s | Handoff says the prototype only fakes it |
| 8 | Fonts self-hosted via `@fontsource` | Handoff says to self-host in production |
| 9 | Wordmark is `VTXO EXPLORER`, not `VTXOSCOPE` | Product decision. It is ~40% wider, so the 62px top bar's `gap: 24px` flex row has less room — the search input (`flex: 1`) absorbs it. Verify at exactly 1180px that nothing wraps |
| 10 | `paths` stat computed in `BigInt` | The count doubles per merge. >53 merges overflows `Number.MAX_SAFE_INTEGER` and silently reports wrong values. Display abbreviated above 10¹² |
| 11 | Bare-txid picker screen invented | Not designed; reuse the table-row visual language (type pill + mono txid + amount) |

---

## 6. Execution — sub-agent phases

File ownership is exclusive. **Two agents must never hold the same file.** Phases are barriers.

### Phase 0 — scaffold (blocking, done first, single agent)
`devops-engineer`
- `pnpm create vite` → React + TS. Add `react-router-dom`, `vitest`, `@fontsource/instrument-sans`,
  `@fontsource/jetbrains-mono`. Nothing else.
- `src/styles/reset.css`, empty module stubs so Phase 1 agents never collide on creation.
- Capture the fixture verbatim:
  `curl -s "https://mutinynet.arkade.sh/v1/indexer/vtxo/1291b80b71e2b289699b418543a3aa3f7e550a7385fc228bf972ae4954bd60f2/0/chain" > src/test/fixtures/chain-99.json`
- Verify: `pnpm build` and `pnpm test` both exit 0 on an empty suite.

### Phase 1 — three agents in parallel (disjoint trees)

**1A · `typescript-pro` — graph core.** Owns `src/graph/**`, `src/test/graph.test.ts`.
Port per §4. Pure functions, no React import anywhere in this tree.
Verify: fixture yields 99 nodes, 101 edges, 3 distinct merge nodes, maxDepth 95,
`countPaths(TARGET)` stable, and **no two chips share a `mid:lane` slot**.

**1B · `typescript-pro` — data layer.** Owns `src/lib/**`, `src/hooks/useChain.ts`,
`useVtxo.ts`, `useOperatorHealth.ts`, `useNow.ts`, `src/test/indexer.live.test.ts`.
Thin client per §2 including `code 13` → `NotFound` discrimination, `nextPageToken` paging with
the 2000-node cap, `AbortController` on unmount. `parseQuery.ts` accepts `txid:vout` and bare
`txid`; bare → `resolveBareTxid()` fires `GetVtxos` for vouts 0–3 concurrently and returns
`{kind:'one'|'many'|'none', hits}` carrying amount + status per hit for the picker.
Reject anything that isn't 64 lowercase hex chars before spending a request.
Verify: live smoke test resolves the reference outpoint and asserts 99 unique txids.

**1C · `ui-designer` — tokens + shell chrome.** Owns `src/styles/tokens.css`,
`components/TopBar/**`, `components/TabBar/**`, `components/Landing/**`, `components/Glossary/**`.
Transcribe every value from the handoff README's Design Tokens section into `tokens.css`.
The glossary tooltip **must be viewport-fixed and positioned from `getBoundingClientRect()`** —
a descendant-positioned popover gets clipped by the scrolling graph pane (documented bug fix).
Landing reflows to phone widths; the explorer shell keeps `min-width: 1180px`.

### Phase 1.5 — strict mode ✅ DONE

`"strict": true` added to `tsconfig.app.json` and `tsconfig.node.json`. Fallout was **zero
errors** — 1A/1B/1C all wrote strict-safe code before the flag existed. Gates green.

Remaining 1.5 work assigned back to 1C (it owns styles and had the design context loaded):
`src/styles/global.css` — the prototype's unowned global block (`dc.html:14-23`): body
background, anchor colors, `::selection`, and the **`.vtx-scroll` scrollbar class that 2D/2E/2F
all apply**. Plus reconciling NetworkSwitcher's duplicate `NetworkId` to a type-only import from
`lib/networks`. Orchestrator wires the `global.css` import into `main.tsx`.

<details><summary>original Phase 1.5 brief</summary>

The Vite react-ts template shipped **without `"strict"`** in `tsconfig.app.json` or
`tsconfig.node.json` — so `strictNullChecks` is off repo-wide and Phases 2–3 would write a large
amount of unprotected code. Enable `"strict": true` in both, then fix the fallout across whatever
1A/1B/1C landed. Deliberately sequenced *after* Phase 1 rather than before: changing the compiler
contract under three running agents causes more confusion than one focused cleanup pass.
Gate: `pnpm tsc --noEmit`, `pnpm build`, `pnpm test` all exit 0.

**Signature drift** (Phase 0's stubs guessed; 1A's brief won): `layout()` takes
`expanded: string[]`, not `Set<string>`; `countPaths()` returns `bigint`, not `number`.
Phase 2D must code against 1A's actual exports.
</details>

### Phase 2 — three agents in parallel (depends on 1A + 1C + 1.5)

**2D · `react-specialist` — graph canvas.** Owns `components/GraphView/{GraphView,Toolbar,Canvas,NodeCard,RunChip,Edges}.tsx`.
Node 278×54 absolutely positioned via `transform: translate(x,y)`; chip 278×36; dot-grid canvas
background; zoom 0.5–1.4 step 0.15 as `scale()` with `transform-origin: 0 0`; type-filter chips
dim to `opacity .22` (dim, never remove).

**2E · `react-specialist` — detail panel.** Owns `components/GraphView/DetailPanel.tsx`.
Four stacked blocks per handoff §4. **No "Open in explorer" button.** Clipboard write + 2s label
revert. SPENDS rows navigate selection to that parent.

**2F · `frontend-developer` — table, raw, states, picker.** Owns `components/TableView/**`,
`components/RawView/**`, `components/states/**`, `components/VoutPicker/**`.
Table sorted by depth ascending, sticky header, `70px 132px 1fr 1fr`. Raw view virtualized over
the deduped payload. `VoutPicker` renders the `kind:'many'` result from `resolveBareTxid()`
using the table's row language (type pill + mono txid + amount + status).

### Phase 3 — sequential

**3G · `react-specialist` — wiring.** Owns `src/App.tsx`, `src/main.tsx`,
`components/SubjectHeader/**`, `src/hooks/useViewState.ts`. Routes, URL⇄state sync,
initial selection = target, stat grid (**inset box-shadow for internal rules, not borders** —
documented bug fix so the rounded outer edge stays clean).

**3H · `test-automator`** — fill coverage gaps left by 1A/1B.

**3I · `code-reviewer` (read-only)** — full review against this plan and the handoff README.
Nobody reviews their own phase.

---

## 7. Acceptance criteria

1. `/` renders the centered search; pasting the reference outpoint navigates to
   `/vtxo/1291b8…f2/0?net=mutinynet` and renders the graph from **live** Mutinynet data.
2. Graph is visually indistinguishable from `VTXO Explorer.dc.html` at zoom 1 — same node
   positions, same collapsed runs, same merge columns.
3. Stat grid reads **99 · 101 · 47 · 50 · 3 · 8**. Subject header shows **depth 95** from
   Bitcoin (graph longest path — NOT the indexer's `depth: 47` field; see §2). Countdown ticks.
4. Clicking a node dims everything outside `{self} ∪ ancestors ∪ descendants` to `.22` and turns
   ancestry edges `#EAB040`. Clear trace resets.
5. Run chips expand individually and via the toolbar toggle.
6. All three tabs render; deep links restore `net`, `tab` and `sel`.
7. A bogus txid shows *not found*, a network failure shows the error state — neither shows a
   blank page or an unhandled rejection.
8. Network switching re-resolves against the new operator.
9. `pnpm build` clean, `pnpm test` green, no console errors, no `@arkade-os/sdk` in the lockfile.

---

## 8. Open / deferred

- Arkade-address search (`ark1…`/`tark1…`) — needs `ArkAddress.decode()` → `5120<vtxoTaprootKey>`
  → `GetVtxos?scripts=`, and an intermediate "pick a VTXO" screen that isn't designed.
- Commitment-txid search — `GetCommitmentTx` returns batch summary data, a different view entirely.
- **Top-bar placeholder copy** (decided): `Search a VTXO outpoint - txid:vout`, replacing the
  handoff's "Search txid, Arkade address, or commitment". Use the same string on the landing
  page's search input.
- Deploy target unspecified; assume static hosting at root. If it lands on a sub-path,
  `vite.config.ts` needs `base`.
- **Accessibility not specified by the handoff.** Baseline only: real `<button>`/`<input>`
  elements, visible focus rings, `aria-label` on icon-only controls. No keyboard graph
  navigation in v1.
- Not a git repo yet — `git init` during Phase 0.

### ⚠ Blocking input needed (does not block Phase 0 or 1)

`src/lib/examples.ts` needs **known-good VTXO outpoints for mainnet and signet**, supplied by
the user. Mutinynet is covered by the reference outpoint above. Until they arrive, ship the
config with Mutinynet populated and the other two as empty arrays — the landing page renders
example chips only for networks that have them. Each supplied outpoint gets verified against
its operator before it lands.
