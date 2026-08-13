// owner: Phase 1B (data layer)
// Display formatting. Formats are transcribed from the prototype
// (`VTXO Explorer.dc.html:263, 491-493, 537-539`) — keep them byte-identical to the design.

/** `1291b80b71` … `54bd60f2` */
export function short(txid: string): string {
  return txid.slice(0, 10) + '…' + txid.slice(-8)
}

const pad = (v: number) => String(v).padStart(2, '0')

/** `Nd HH:MM:SS` — subject header countdown. */
export function countdown(secondsRemaining: number): string {
  const s = Math.max(0, Math.floor(secondsRemaining))
  return `${Math.floor(s / 86400)}d ${pad(Math.floor((s % 86400) / 3600))}:${pad(
    Math.floor((s % 3600) / 60),
  )}:${pad(s % 60)}`
}

/** `Nd HH:MM` — detail panel "Expires" field. */
export function countdownShort(secondsRemaining: number): string {
  const s = Math.max(0, Math.floor(secondsRemaining))
  return `${Math.floor(s / 86400)}d ${pad(Math.floor((s % 86400) / 3600))}:${pad(
    Math.floor((s % 3600) / 60),
  )}`
}

/** Whole seconds until a unix-seconds expiry, clamped at zero. `nowMs` from `useNow()`. */
export function secondsUntil(expiresAt: number, nowMs: number): number {
  return Math.max(0, expiresAt - Math.floor(nowMs / 1000))
}

export function sats(amount: number): string {
  return amount.toLocaleString('en-US')
}

/** ISO, first 16 chars, `T`→space, `Z` re-appended: `2026-08-12 10:41Z`. */
export function snapshot(atMs: number): string {
  return new Date(atMs).toISOString().slice(0, 16).replace('T', ' ') + 'Z'
}
