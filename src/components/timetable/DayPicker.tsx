import { CalendarDays, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DAY_NAMES, WORK_DAYS } from "@/lib/timetable";

/** "Mon, Wed, Fri" for a list of day numbers (0 = Sunday). */
export function daySummary(days: number[]) {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 0) return "No days selected";
  if (sorted.length === WORK_DAYS.length) return "Every day (Mon–Sat)";
  return sorted.map((d) => DAY_NAMES[d]?.slice(0, 3)).join(", ");
}

/** Popup with one toggle chip per teaching day plus a Mon–Sat shortcut. */
export function DayPicker({
  value,
  onChange,
  disabled,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}) {
  const allOn = WORK_DAYS.every((d) => value.includes(d));

  const toggle = (day: number) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="w-full justify-start font-normal">
          <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{value.length ? daySummary(value) : "Select days"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <div>
          <p className="text-sm font-medium">Teaching days</p>
          <p className="text-xs text-muted-foreground">Tap the days this class meets.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WORK_DAYS.map((d) => {
            const on = value.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(d)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent/10",
                )}
              >
                {DAY_NAMES[d]?.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={() => onChange(allOn ? [] : [...WORK_DAYS])}
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            {allOn ? "Clear all" : "Select all (Mon–Sat)"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{daySummary(value)}</p>
      </PopoverContent>
    </Popover>
  );
}
