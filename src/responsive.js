// src/responsive.js — mobile-native layout primitives.
//
// Tailwind is not installed, so `sm:` / `md:` / `lg:` prefixes do nothing in
// this project. These hooks resolve the same breakpoints in JS and are
// measured against the CONTAINER rather than the viewport, because every
// terminal renders beside a ~250px sidebar on desktop and full-bleed on
// mobile — a viewport query gets that wrong at exactly the sizes that matter.

import { useEffect, useState } from "react";

// Container-relative equivalents of the Tailwind viewport breakpoints, minus a
// typical sidebar. A 1024px viewport with a sidebar leaves ~780px of panel.
export const BP = {
  narrow: 480,  // phone portrait — KPI rail, stacked everything
  sm: 560,      // large phone / small tablet
  md: 780,      // tablet — 2-up grids
  lg: 1040,     // desktop — full multi-column
};

export function useContainerWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return undefined;
    let ro;
    let raf;
    // Every terminal renders a boot/loading state first, so on the effect's
    // only run ref.current is still null. A plain early-return there meant the
    // observer never attached once the real root mounted, cw stayed 0, and the
    // layout silently stayed on the desktop branch forever — including on a
    // 390px phone. Retry on animation frames until the node exists.
    const attach = () => {
      const el = ref?.current;
      if (!el) { raf = requestAnimationFrame(attach); return; }
      ro = new ResizeObserver((entries) => {
        const r = entries[0]?.contentRect;
        if (r) setW(r.width);
      });
      ro.observe(el);
      setW(el.getBoundingClientRect().width);
    };
    attach();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
    };
  }, [ref]);
  return w;
}

/**
 * Resolves a container width into the booleans every terminal needs.
 * Width 0 means the observer has not measured yet — assume desktop so the
 * first paint is the full layout rather than a flash of the phone layout.
 */
export function breakpoints(cw) {
  const unmeasured = cw === 0;
  return {
    cw,
    narrow: !unmeasured && cw < BP.narrow,
    sm: unmeasured || cw >= BP.sm,
    md: unmeasured || cw >= BP.md,
    lg: unmeasured || cw >= BP.lg,
    /** true on phone-sized panels — the trigger for rails and sheets */
    mobile: !unmeasured && cw < BP.md,
  };
}

/**
 * KPI container props.
 *
 * Mobile gets a horizontal snap-scroll rail so a four-across grid never
 * squeezes a currency figure into "$3…". Desktop keeps the real grid.
 * Cards carry a min-width so the figure always has room to render whole.
 */
export function kpiRail(bp, { cols = 4, minCard = 168 } = {}) {
  if (bp.mobile) {
    return {
      className: "spark-rail flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-3 pb-2 w-full",
      // stretch so every card in the rail shares the tallest card's height —
      // otherwise ragged card bottoms make the track look broken.
      style: { alignItems: "stretch" },
      cardStyle: {
        minWidth: bp.narrow ? 196 : 216,
        maxWidth: 280,
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
      },
    };
  }
  const n = bp.lg ? cols : Math.min(2, cols);
  return {
    className: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${cols} gap-4 w-full`,
    style: {
      display: "grid",
      width: "100%",
      gap: 16,
      gridTemplateColumns: `repeat(${n}, minmax(0,1fr))`,
    },
    cardStyle: { minWidth: 0 },
  };
}

/**
 * Metric type scale. A currency figure must never be clipped, so instead of
 * nowrap + ellipsis the size steps down on narrow panels.
 */
export function figureSize(bp, base = 25) {
  if (bp.narrow) return Math.round(base * 0.76);
  if (bp.mobile) return Math.round(base * 0.86);
  return base;
}

/** Page/section heading scale — `text-lg sm:text-2xl` equivalent. */
export function headingSize(bp, base = 21) {
  if (bp.narrow) return 16;
  if (bp.mobile) return 18;
  return base;
}

/** Chart height — `h-48 md:h-72` equivalent. */
export function chartHeight(bp, desktop = 260) {
  if (bp.narrow) return 180;
  if (bp.mobile) return 200;
  return desktop;
}

/**
 * Recharts axis config for the current breakpoint. On phones the tick count
 * drops and the vertical grid disappears, both of which otherwise crush the
 * plot area until the line is unreadable.
 */
export function axisProps(bp) {
  return {
    tick: { fill: "#71717a", fontSize: bp.mobile ? 9 : 10, fontFamily: "'JetBrains Mono','SF Mono',monospace" },
    axisLine: false,
    tickLine: false,
    ...(bp.mobile ? { interval: "preserveStartEnd", minTickGap: 24 } : {}),
  };
}

export function gridProps(bp) {
  return {
    stroke: "#27272a",
    strokeDasharray: "3 3",
    vertical: !bp.mobile,
    horizontal: true,
  };
}

/** Legend sits under the plot on mobile so it stops stealing canvas width. */
export function legendProps(bp) {
  return {
    wrapperStyle: {
      fontFamily: "'JetBrains Mono','SF Mono',monospace",
      fontSize: bp.mobile ? 9 : 10,
      color: "#71717a",
      ...(bp.mobile ? { paddingTop: 6, lineHeight: 1.6 } : {}),
    },
    ...(bp.mobile ? { layout: "horizontal", verticalAlign: "bottom", align: "center" } : {}),
  };
}
