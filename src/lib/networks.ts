// owner: Phase 1B (data layer)
// The three Arkade operators, all probed live — see PLAN.md §2.

export type NetworkId = 'mainnet' | 'mutinynet' | 'signet'

export type Network = {
  id: NetworkId
  label: string
  baseUrl: string
  /**
   * Bitcoin block explorer API, a SECOND host distinct from the Arkade operator. Only used to
   * resolve block height/time for commitment transactions — Arkade's GetCommitmentTx returns
   * batch-session data (startedAt/endedAt) and no block information at all. Every other view
   * talks solely to `baseUrl`.
   */
  explorerApi: string
}

export const NETWORKS: Record<NetworkId, Network> = {
  mainnet: {
    id: 'mainnet',
    label: 'Mainnet',
    baseUrl: 'https://arkade.computer',
    explorerApi: 'https://mempool.space/api',
  },
  mutinynet: {
    id: 'mutinynet',
    label: 'Mutinynet',
    baseUrl: 'https://mutinynet.arkade.sh',
    explorerApi: 'https://mutinynet.com/api',
  },
  signet: {
    id: 'signet',
    label: 'Signet',
    baseUrl: 'https://signet.arkade.sh',
    explorerApi: 'https://mempool.space/signet/api',
  },
}

export const NETWORK_LIST: Network[] = [
  NETWORKS.mutinynet,
  NETWORKS.signet,
  NETWORKS.mainnet,
]

export const DEFAULT_NETWORK: NetworkId = 'mutinynet'

const STORAGE_KEY = 'vtxo-explorer:net'

export function isNetworkId(value: unknown): value is NetworkId {
  return value === 'mainnet' || value === 'mutinynet' || value === 'signet'
}

/** Last-used network, or the default. Safari private mode throws on storage access. */
export function loadNetwork(): NetworkId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isNetworkId(stored) ? stored : DEFAULT_NETWORK
  } catch {
    return DEFAULT_NETWORK
  }
}

export function saveNetwork(id: NetworkId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // storage unavailable — the URL param still carries the selection
  }
}

/** `?net=` always wins over the stored value. Pass the raw query param. */
export function resolveNetwork(param: string | null | undefined): NetworkId {
  return isNetworkId(param) ? param : loadNetwork()
}
