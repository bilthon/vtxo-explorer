// owner: Phase 1C (tokens + shell chrome)
import { useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { TERMS } from './terms'
import styles from './Glossary.module.css'

/* The tooltip is viewport-fixed and positioned from the trigger's
 * getBoundingClientRect(), portalled to <body>. It must NOT be a
 * descendant-positioned popover — inside the scrolling graph pane it gets
 * clipped (documented bug fix, handoff README "Interactions"). */
const TIP_GAP = 8

type Point = { x: number; y: number }

function useGlossaryTip(term: string) {
  const id = useId()
  const [point, setPoint] = useState<Point | null>(null)
  const text = TERMS[term]

  const open = (event: { currentTarget: Element }) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setPoint({ x: rect.left, y: rect.bottom + TIP_GAP })
  }

  const triggerProps = {
    onMouseEnter: open,
    onMouseLeave: () => setPoint(null),
    onFocus: open,
    onBlur: () => setPoint(null),
    'aria-describedby': point && text ? id : undefined,
  }

  const tooltip =
    point && text
      ? createPortal(
          <div
            id={id}
            role="tooltip"
            className={styles.tooltip}
            style={{ transform: `translate(${point.x}px, ${point.y}px)` }}
          >
            {text}
          </div>,
          document.body,
        )
      : null

  return { triggerProps, tooltip, known: text !== undefined }
}

/** Dashed-underline inline term inside explainer copy. */
export function GlossaryTerm({ term, children }: { term: string; children: ReactNode }) {
  const { triggerProps, tooltip, known } = useGlossaryTip(term)

  if (!known) return <>{children}</>

  return (
    <span className={styles.term} tabIndex={0} {...triggerProps}>
      {children}
      {tooltip}
    </span>
  )
}

/** 15px circular "?" help affordance, e.g. beside the subject status pill. */
export function GlossaryHelp({ term }: { term: string }) {
  const { triggerProps, tooltip, known } = useGlossaryTip(term)

  if (!known) return null

  return (
    <button type="button" className={styles.help} aria-label={`What does ${term} mean?`} {...triggerProps}>
      ?{tooltip}
    </button>
  )
}
