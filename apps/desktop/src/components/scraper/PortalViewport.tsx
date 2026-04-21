import { useEffect, useRef } from "react";

interface PortalViewportProps {
  onBoundsChange: (
    rect: { x: number; y: number; width: number; height: number } | null,
  ) => void;
  children?: React.ReactNode;
  /**
   * When true, the placeholder is rendered but no bounds are pushed to main —
   * useful for the landing / idle state where no WebContentsView should be
   * attached underneath.
   */
  inactive?: boolean;
}

/**
 * Transparent placeholder that reports its on-screen rect to the main process.
 * Main positions the WebContentsView behind this div so the portal appears
 * inline inside the renderer layout.
 *
 * When `inactive` the component still keeps its layout slot but pushes `null`
 * to main so the WebContentsView is detached/hidden.
 */
export function PortalViewport({
  onBoundsChange,
  children,
  inactive = false,
}: PortalViewportProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    if (inactive) {
      onBoundsChange(null);
      return;
    }

    const node = rootRef.current;

    const push = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        onBoundsChange(null);
        return;
      }
      onBoundsChange({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    push();

    const resizeObserver = new ResizeObserver(push);
    resizeObserver.observe(node);
    window.addEventListener("scroll", push, true);
    window.addEventListener("resize", push);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", push, true);
      window.removeEventListener("resize", push);
      onBoundsChange(null);
    };
  }, [inactive, onBoundsChange]);

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-[520px] overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-inner"
      aria-label="Zone du portail assureur"
      role="region"
    >
      {children}
    </div>
  );
}
