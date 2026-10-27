'use client';

import { useEffect, useRef, useState } from 'react';

// Long text renders clamped (a few lines) with a Show more / Show less
// toggle that only appears when the text truly overflows its clamped box.
// The measure runs on mount, on resize and after the fonts load, because
// the clamp boundary moves with the typography.
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

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const measure = () => setOverflows(node.scrollHeight > node.clientHeight + 1);
    measure();
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [text, lines]);

  return (
    <div>
      <p
        ref={ref}
        className={className}
        style={
          expanded
            ? undefined
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
        <button
          type="button"
          className="link"
          onClick={() => setExpanded((previous) => !previous)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}
