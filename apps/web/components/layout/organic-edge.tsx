import { cn } from "@/lib/utils";

// PIN signature shape: hero, page-title and footer bands end in a hand-drawn
// edge instead of a hard rectangle. Shared once here — never redraw per page.
// Approximation until PIN supplies the source vector.
const EDGE_PATH =
  "M0,0 H1440 V22 C1380,30 1330,14 1262,20 C1190,27 1140,40 1068,36 C990,32 950,18 872,22 C800,26 760,42 684,40 C606,38 570,24 494,26 C420,28 380,38 306,34 C230,30 190,16 118,20 C70,23 34,30 0,28 Z";

const OrganicEdge = ({
  position = "bottom",
  className,
}: {
  /** "bottom" closes a band above it; "top" opens a band below it. */
  position?: "top" | "bottom";
  className?: string;
}) => {
  return (
    <svg
      viewBox="0 0 1440 48"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={cn(
        "block w-full h-6 md:h-10 text-canvas-dark fill-current",
        position === "top" && "-scale-y-100",
        className,
      )}
    >
      <path d={EDGE_PATH} />
    </svg>
  );
};

export default OrganicEdge;
