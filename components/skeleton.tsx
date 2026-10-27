// The skeleton block: the loading state of a layout cell. Content hides
// behind a soft sky-wash placeholder while the real data rides the
// network; a blurred white glow sweeps it once per cycle (none under
// prefers-reduced-motion). Invisible to assistive tech: the busy region
// carries aria-busy instead.

interface SkeletonShape {
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function Skeleton({ width, height, className }: SkeletonShape) {
  return (
    <div
      aria-hidden="true"
      className={className ? `skeleton ${className}` : 'skeleton'}
      style={{ width, height }}
    />
  );
}
