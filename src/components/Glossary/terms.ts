// owner: Phase 1C (tokens + shell chrome)
// Verbatim from the prototype (VTXO Explorer.dc.html:223-227).
export const TERMS: Record<string, string> = {
  preconfirmed:
    'Preconfirmed: cosigned by the Arkade operator and spendable instantly, but not yet anchored to Bitcoin by a batch swap.',
  commitment:
    'Commitment transaction: the onchain Bitcoin transaction that anchors a batch swap. Every VTXO traces back to one.',
  checkpoint:
    'Checkpoint: an intermediate transaction the operator co-signs between Arkade transactions, preserving the unilateral exit path.',
}
