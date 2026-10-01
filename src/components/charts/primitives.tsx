import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { GRANULARITIES, type Granularity } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** Chart heights tuned so a phone screen still shows the surrounding page. */
export function useChartHeight(desktop = 260, mobile = 200) {
  return useIsMobile() ? mobile : desktop;
}


/** Number that animates from zero on first paint. */
export function CountUp({
  value,
  format,
  duration = 900,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const initial = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(initial + (value - initial) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  const rounded = Math.round(shown);
  return <>{format ? format(rounded) : rounded.toLocaleString("en-PK")}</>;
}

/** Gradient-accented metric tile used across the dashboard. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: "primary" | "accent" | "success" | "destructive";
  className?: string;
}) {
  const tones = {
    primary: "from-primary/12 to-primary/0 text-primary",
    accent: "from-accent/20 to-accent/0 text-accent",
    success: "from-success/15 to-success/0 text-success",
    destructive: "from-destructive/12 to-destructive/0 text-destructive",
  } as const;

  return (
    <div
      className={cn(
        "animate-fade-in relative h-full overflow-hidden rounded-lg border bg-card p-3 shadow-panel transition-transform duration-200 hover:-translate-y-0.5 sm:p-4",
        className,
      )}
    >
      <div
        className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", tones[tone])}
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] leading-tight tracking-wide text-muted-foreground uppercase sm:text-xs">
            {label}
          </p>
          <Icon className={cn("h-4 w-4 shrink-0", tones[tone].split(" ").pop())} />
        </div>
        <p className="mt-1 font-serif text-xl font-semibold break-words sm:text-2xl">{value}</p>
        {hint ? <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{hint}</p> : null}
      </div>
    </div>
  );
}


export function GranularityToggle({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (g: Granularity) => void;
}) {
  return (
    <div className="grid w-full grid-cols-3 rounded-md border bg-muted/40 p-0.5 sm:inline-flex sm:w-auto">
      {GRANULARITIES.map((g) => (
        <button
          key={g.key}
          type="button"
          onClick={() => onChange(g.key)}
          className={cn(
            "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors sm:py-1",
            value === g.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}

/** Card shell for a chart, with an optional control slot in the header. */
export function ChartCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string | undefined;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <Card className={cn("no-print animate-fade-in overflow-hidden", className)}>
      <CardHeader className="gap-2 space-y-0 px-4 pb-2 sm:flex sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3 sm:px-6">
        <div className="min-w-0">
          <CardTitle className="font-serif text-base sm:text-lg">{title}</CardTitle>
          {description ? (
            <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>
          ) : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="px-1 pb-4 sm:px-4">{children}</CardContent>
    </Card>
  );
}


export function TooltipBox({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-panel">
      <p className="font-medium text-popover-foreground">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="mt-0.5 text-muted-foreground">
          {r.label}: <span className="font-medium text-foreground">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
