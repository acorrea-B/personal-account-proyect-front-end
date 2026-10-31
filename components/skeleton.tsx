import { cx } from '@/components/ui';

// The skeleton block: the loading state of a layout cell. Content hides
// behind a soft sky-wash placeholder while the real data rides the
// network; a blurred white glow sweeps it once per cycle (none under
// prefers-reduced-motion). Invisible to assistive tech: the busy region
// carries aria-busy instead.

// The block and its glow (::after): the sweep starts off the left edge;
// under reduced motion the glow rests over the block, unblurred.
const skeletonClass =
  "relative overflow-hidden rounded-lg bg-sky-wash-soft after:absolute after:inset-0 after:animate-skeleton-glow after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.75),transparent)] after:[filter:blur(6px)] after:[transform:translateX(-100%)] after:content-[''] motion-reduce:after:animate-none motion-reduce:after:[filter:none] motion-reduce:after:[transform:none]";

interface SkeletonShape {
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function Skeleton({ width, height, className }: SkeletonShape) {
  return (
    <div aria-hidden="true" className={cx(skeletonClass, className)} style={{ width, height }} />
  );
}
