// owner: Phase 1A (graph core)
// Locked geometry constants — see PLAN.md §4. Do not change without updating the plan.
import type { IndexerChain } from '../lib/indexer.types'
import type { TxType } from './types'

export const NW = 278
export const NH = 54
export const COLW = 316
export const ROWH = 78
export const PADX = 40
export const PADY = 36
export const CHIP_H = 36

export const TYPE: Record<TxType, { l: string; c: string }> = {
  A: { l: 'ARKADE', c: '#EAB040' },
  C: { l: 'CHECKPOINT', c: '#7C8798' },
  T: { l: 'TREE', c: '#B08CF0' },
  M: { l: 'COMMITMENT', c: '#4FD1A5' },
}

/** Wire enum -> the prototype's single-letter type code. */
export const TYPE_CODE: Record<IndexerChain['type'], TxType> = {
  INDEXER_CHAINED_TX_TYPE_ARK: 'A',
  INDEXER_CHAINED_TX_TYPE_CHECKPOINT: 'C',
  INDEXER_CHAINED_TX_TYPE_TREE: 'T',
  INDEXER_CHAINED_TX_TYPE_COMMITMENT: 'M',
}
