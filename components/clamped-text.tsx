'use client';

import { type TransitionEvent, useEffect, useRef, useState } from 'react';

// Long text renders clamped (a few lines) with a Show more / Show less
// toggle that only appears when the text truly overflows its clamped box.
// The measure runs on mount, on resize and after the fonts load, because
// the clamp boundary moves with the typography.
//
// The fold is fluid: the paragraph's max-height travels between the
// clamped height and the content height on the house curve — the panel
// grows instead of snapping open. Opening pins at the full height once
// settled; closing restores the native clamp at the end of the fold.
// Under prefers-reduced-motion, the fold is instant.
export function ClampedText({
  text,
  lines = 3,
  className,
}: {
  text: string;
  lines?: number;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  // The fold: the inline max-height while the height travels (or until
  // the open fold settles); null means the paragraph sits at its natural
  // clamped height with no inline limit.
  const [fold, setFold] = useState<number | null>(null);
  const foldDirection = useRef<'open' | 'close' | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const measure = () => {
      // While fully open, the fold pins to the live content height: a
      // resize keeps the box honest instead of clipping at a stale px.
      if (expanded && foldDirection.current === null) {
        setFold(node.scrollHeight);
      }
      setOverflows(node.scrollHeight > node.clientHeight + 1);
    };
    measure();
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [text, lines, expanded]);

  function toggleFold() {
    const node = ref.current;
    if (!node) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // The reduced-motion voice: the clamp lifts or returns instantly.
      setExpanded((previous) => !previous);
      return;
    }
    if (!expanded) {
      // Open: start the fold at the clamped height, then travel to the
      // full content height on the next frame (the transition carries it).
      const target = node.scrollHeight;
      const source = node.clientHeight;
      foldDirection.current = 'open';
      setFold(source);
      setExpanded(true);
      requestAnimationFrame(() => setFold(target));
      return;
    }
    // Close: fold to the clamped height (line box height times lines),
    // then re-engage the native clamp at the end of the transition.
    const lineHeight = parseFloat(getComputedStyle(node).lineHeight) || 0;
    foldDirection.current = 'close';
    setFold(node.scrollHeight);
    requestAnimationFrame(() => setFold(lineHeight * lines + 1));
  }

  // The fold settles on its last transition end: opening stays pinned at
  // the full height, closing hands the height back to the native clamp —
  // the swap is exact because the fold ends at the clamp's own height.
  function settleFold(event: TransitionEvent<HTMLParagraphElement>) {
    if (event.propertyName !== 'max-height') {
      return;
    }
    if (foldDirection.current === 'close') {
      setExpanded(false);
      setFold(null);
    }
    foldDirection.current = null;
  }

  return (
    <div>
      <p
        ref={ref}
        className={className ? `clamped-fold ${className}` : 'clamped-fold'}
        onTransitionEnd={settleFold}
        style={
          expanded
            ? {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                maxHeight: fold !== null ? `${fold}px` : undefined,
              }
            : {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: String(lines),
                overflow: 'hidden',
              }
        }
      >
        {text}
      </p>
      {overflows ? (
        <button type="button" className="link" onClick={toggleFold} aria-expanded={expanded}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}
