// owner: Phase 1B (data layer)
// Landing-page example outpoints. Hardcoded because the indexer has no enumeration capability:
// an unfiltered `GET /v1/indexer/vtxos` answers `code 3, "missing outpoints or scripts filter"`
// on every network (PLAN.md §2).
//
// Mainnet and signet are intentionally empty — the user supplies verified outpoints for those
// (PLAN.md §8). Adding one is a one-line edit; the landing page renders chips only where the
// list is non-empty. Do not guess outpoints: an unverified one renders a not-found page.

import type { NetworkId } from './networks'

export type Example = {
  txid: string
  vout: number
  /** short caption under the chip */
  label: string
}

export const EXAMPLES: Record<NetworkId, Example[]> = {
  mainnet: [],
  mutinynet: [
    {
      txid: '1291b80b71e2b289699b418543a3aa3f7e550a7385fc228bf972ae4954bd60f2',
      vout: 0,
      label: '600 sats · preconfirmed · 99-node chain',
    },
  ],
  signet: [],
}

export function examplesFor(net: NetworkId): Example[] {
  return EXAMPLES[net]
}
