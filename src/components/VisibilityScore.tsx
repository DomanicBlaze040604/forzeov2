import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// VisibilityScore — colored pill for 0-100 visibility scores
// Blue/sky tone palette, no red coloring
// ---------------------------------------------------------------------------

interface VisibilityScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showPercent?: boolean;
  className?: string;
}

function getScoreStyle(score: number) {
  if (score >= 75) return "bg-blue-600 text-white";
  if (score >= 50) return "bg-sky-500 text-white";
  if (score >= 25) return "bg-sky-200 text-sky-800";
  if (score >= 1)  return "bg-gray-100 text-gray-500";
  return "bg-gray-100 text-gray-400";
}

const sizeClasses = {
  sm: "text-xs px-2 py-0.5 rounded-full",
  md: "text-sm px-2.5 py-1 rounded-full font-medium",
  lg: "text-base px-3 py-1.5 rounded-full font-semibold",
};

export function VisibilityScore({
  score,
  size = "md",
  showPercent = true,
  className,
}: VisibilityScoreProps) {
  const display = score === 0 && showPercent ? "0%" : showPercent ? `${score}%` : `${score}`;
  return (
    <span className={cn("inline-flex items-center tabular-nums", sizeClasses[size], getScoreStyle(score), className)}>
      {display}
    </span>
  );
}

// ---------------------------------------------------------------------------
// PositionBadge — shows #1, #2, etc.
// ---------------------------------------------------------------------------

interface PositionBadgeProps {
  position: number | null;
  className?: string;
}

export function PositionBadge({ position, className }: PositionBadgeProps) {
  if (position == null) {
    return <span className={cn("text-gray-400 text-sm", className)}>—</span>;
  }
  return (
    <span className={cn(
      "inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium",
      "bg-blue-50 text-blue-700 border border-blue-200",
      className
    )}>
      #{position}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ChangeBadge — shows +9.7% / -1.8% / 0.0% with arrows
// ---------------------------------------------------------------------------

interface ChangeBadgeProps {
  change: number; // positive or negative
  className?: string;
}

export function ChangeBadge({ change, className }: ChangeBadgeProps) {
  const isPos = change > 0;
  const isNeg = change < 0;
  const display = `${isPos ? "+" : ""}${change.toFixed(1)}%`;

  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
      isPos && "text-emerald-600",
      isNeg && "text-red-500",
      !isPos && !isNeg && "text-gray-400",
      className
    )}>
      {isPos && "↑"}
      {isNeg && "↓"}
      {!isPos && !isNeg && "—"}
      {(isPos || isNeg) && display}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SharePill — colored pill for SOV share percentage
// ---------------------------------------------------------------------------

interface SharePillProps {
  share: number; // 0-100
  className?: string;
}

export function SharePill({ share, className }: SharePillProps) {
  const style = share >= 15
    ? "bg-blue-100 text-blue-700 border border-blue-200"
    : share >= 8
    ? "bg-sky-100 text-sky-700 border border-sky-200"
    : share >= 3
    ? "bg-gray-100 text-gray-600 border border-gray-200"
    : "bg-gray-50 text-gray-400 border border-gray-100";

  return (
    <span className={cn("inline-flex items-center text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums", style, className)}>
      {share.toFixed(1)}%
    </span>
  );
}
