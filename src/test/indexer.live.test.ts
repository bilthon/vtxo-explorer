// owner: Phase 1B (data layer)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_CHAIN_NODES, getVtxoChain, getVtxos } from '../lib/indexer'
import { parseQuery, resolveBareTxid } from '../lib/parseQuery'
import type { IndexerChain } from '../lib/indexer.types'

const REFERENCE = {
  txid: '1291b80b71e2b289699b418543a3aa3f7e550a7385fc228bf972ae4954bd60f2',
  vout: 0,
}

// Live tests hit Mutinynet. They exist to catch upstream API drift, so they must not wedge CI
// when the network is unreachable: they are skipped unless `VITE_LIVE=1 pnpm test`.
const live = import.meta.env.VITE_LIVE ? describe : describe.skip

live('indexer (live, Mutinynet)', () => {
  it(
    'resolves the reference outpoint to 99 unique txids',
    async () => {
      const res = await getVtxoChain('mutinynet', REFERENCE, AbortSignal.timeout(20_000))
      expect(res.kind).toBe('ok')
      if (res.kind !== 'ok') return

      expect(res.value.truncated).toBe(false)
      const unique = new Set(res.value.chain.map((r) => r.txid))
      expect(unique.size).toBe(99)
      expect(res.value.chain.length).toBe(107) // the API returns duplicate records
    },
    30_000,
  )

  it(
    'reports a missing outpoint as notFound, not as an error',
    async () => {
      const res = await getVtxoChain(
        'mutinynet',
        { txid: '0'.repeat(64), vout: 0 },
        AbortSignal.timeout(20_000),
      )
      expect(res.kind).toBe('notFound')
    },
    30_000,
  )

  it(
    'reads the subject amount and status',
    async () => {
      const res = await getVtxos('mutinynet', [REFERENCE], AbortSignal.timeout(20_000))
      expect(res.kind).toBe('ok')
      if (res.kind !== 'ok') return

      expect(res.value).toHaveLength(1)
      expect(res.value[0].amount).toBe(600)
      expect(res.value[0].status).toBe('PRECONFIRMED')
      expect(res.value[0].expiresAt).toBe(1788857636)
    },
    30_000,
  )

  it(
    'resolves a bare txid to a single hit',
    async () => {
      const res = await resolveBareTxid('mutinynet', REFERENCE.txid, AbortSignal.timeout(20_000))
      expect(res).toEqual({
        kind: 'one',
        hits: [{ vout: 0, amount: 600, status: 'PRECONFIRMED' }],
      })
    },
    30_000,
  )
})

// ---------------------------------------------------------------------------
// Offline coverage for paths live data cannot exercise: the operators return the whole chain
// in one page with an empty nextPageToken, so paging and the cap need a stubbed fetch.
// ---------------------------------------------------------------------------

function record(txid: string): IndexerChain {
  return { txid, expiresAt: '1788857636', type: 'INDEXER_CHAINED_TX_TYPE_ARK', spends: [] }
}

function stubFetch(pages: Array<{ chain: IndexerChain[]; nextPageToken: string }>) {
  const urls: string[] = []
  const fetchMock = vi.fn(async (url: string | URL) => {
    urls.push(String(url))
    const page = pages[urls.length - 1]
    return new Response(JSON.stringify({ ...page, page: null, authToken: '' }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return urls
}

afterEach(() => vi.unstubAllGlobals())

describe('getVtxoChain paging', () => {
  it('follows nextPageToken until it comes back empty', async () => {
    const urls = stubFetch([
      { chain: [record('aa'), record('bb')], nextPageToken: 'tok-2' },
      { chain: [record('cc')], nextPageToken: 'tok-3' },
      { chain: [record('dd')], nextPageToken: '' },
    ])

    const res = await getVtxoChain('mutinynet', REFERENCE, new AbortController().signal)

    expect(res).toEqual({
      kind: 'ok',
      value: { chain: [record('aa'), record('bb'), record('cc'), record('dd')], truncated: false },
    })
    expect(urls).toHaveLength(3)
    expect(urls[0]).not.toContain('pageToken')
    expect(urls[1]).toContain('pageToken=tok-2')
    expect(urls[2]).toContain('pageToken=tok-3')
  })

  it('stops at the node cap and flags truncation', async () => {
    const full = Array.from({ length: 1500 }, (_, i) => record(`tx-${i}`))
    const urls = stubFetch([
      { chain: full, nextPageToken: 'tok-2' },
      { chain: full, nextPageToken: 'tok-3' },
      { chain: full, nextPageToken: '' },
    ])

    const res = await getVtxoChain('mutinynet', REFERENCE, new AbortController().signal)

    expect(res.kind).toBe('ok')
    if (res.kind !== 'ok') return
    expect(res.value.chain).toHaveLength(MAX_CHAIN_NODES)
    expect(res.value.truncated).toBe(true)
    expect(urls).toHaveLength(2) // gave up before the third page
  })
})

describe('error discrimination', () => {
  it('maps HTTP 500 / code 13 "not found" to notFound', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 13,
              message: 'vtxo not found for outpoint: [abc:0]',
              details: [],
            }),
            { status: 500 },
          ),
      ),
    )

    const res = await getVtxoChain('mutinynet', REFERENCE, new AbortController().signal)
    expect(res.kind).toBe('notFound')
  })

  it('keeps a code 13 without a "not found" message as an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: 13, message: 'internal database failure' }), {
            status: 500,
          }),
      ),
    )

    const res = await getVtxoChain('mutinynet', REFERENCE, new AbortController().signal)
    expect(res).toEqual({ kind: 'error', message: 'internal database failure' })
  })

  it('reports an unreachable operator as an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    )

    const res = await getVtxoChain('mutinynet', REFERENCE, new AbortController().signal)
    expect(res).toEqual({ kind: 'error', message: 'Failed to fetch' })
  })
})

describe('parseQuery', () => {
  it.each([
    ['bare txid', REFERENCE.txid, { kind: 'txid', txid: REFERENCE.txid }],
    ['outpoint', `${REFERENCE.txid}:0`, { kind: 'outpoint', outpoint: REFERENCE }],
    ['non-zero vout', `${REFERENCE.txid}:12`, {
      kind: 'outpoint',
      outpoint: { txid: REFERENCE.txid, vout: 12 },
    }],
    ['surrounding whitespace', `  ${REFERENCE.txid}:1 `, {
      kind: 'outpoint',
      outpoint: { txid: REFERENCE.txid, vout: 1 },
    }],
  ])('accepts %s', (_name, input, expected) => {
    expect(parseQuery(input)).toEqual(expected)
  })

  it.each([
    ['empty', ''],
    ['too short', 'abc'],
    ['uppercase hex', REFERENCE.txid.toUpperCase()],
    ['non-hex', 'z'.repeat(64)],
    ['negative vout', `${REFERENCE.txid}:-1`],
    ['non-numeric vout', `${REFERENCE.txid}:x`],
    ['empty vout', `${REFERENCE.txid}:`],
    ['extra segment', `${REFERENCE.txid}:0:1`],
  ])('rejects %s without spending a request', (_name, input) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(parseQuery(input).kind).toBe('invalid')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('resolveBareTxid', () => {
  it('probes vouts 0-3 and classifies multiple hits', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        urls.push(String(url))
        return new Response(
          JSON.stringify({
            vtxos: [1, 0].map((vout) => ({
              outpoint: { txid: REFERENCE.txid, vout },
              createdAt: '1785435157',
              expiresAt: '1788857636',
              amount: String(100 * (vout + 1)),
              script: '51',
              isPreconfirmed: false,
              isSwept: false,
              isUnrolled: false,
              isSpent: vout === 1,
              spentBy: '',
              settledBy: '',
              arkTxid: '',
              commitmentTxids: [],
              depth: 3,
            })),
            page: null,
          }),
          { status: 200 },
        )
      }),
    )

    const res = await resolveBareTxid('mutinynet', REFERENCE.txid, new AbortController().signal)

    expect(res).toEqual({
      kind: 'many',
      hits: [
        { vout: 0, amount: 100, status: 'SETTLED' },
        { vout: 1, amount: 200, status: 'SPENT' },
      ],
    })
    for (const vout of [0, 1, 2, 3]) {
      expect(urls[0]).toContain(`outpoints=${REFERENCE.txid}:${vout}`)
    }
  })

  it('distinguishes "no such vtxo" from "operator down"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ vtxos: [], page: null }), { status: 200 })),
    )
    expect(await resolveBareTxid('mutinynet', REFERENCE.txid, new AbortController().signal)).toEqual(
      { kind: 'none', hits: [] },
    )

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    )
    expect(await resolveBareTxid('mutinynet', REFERENCE.txid, new AbortController().signal)).toEqual(
      { kind: 'error', message: 'Failed to fetch' },
    )
  })
})
