import { MessageCircle, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Digits only, Pakistani local 03XXXXXXXXX → international 92XXXXXXXXXX for wa.me. */
export function toWhatsAppNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("0092")) return digits.slice(2);
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("3")) return `92${digits}`;
  return digits;
}

export function telHref(raw: string) {
  return `tel:${raw.replace(/[^\d+]/g, "")}`;
}

/** Tappable phone number offering Call and WhatsApp. Used everywhere a number is shown. */
export function ContactLink({
  value,
  label,
  className,
}: {
  value?: string | null;
  label?: string;
  className?: string;
}) {
  const number = (value ?? "").trim();
  if (!number) return <span className="text-muted-foreground">—</span>;

  const wa = toWhatsAppNumber(number);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            "inline-flex min-h-9 max-w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium text-primary underline-offset-4 hover:underline " +
            (className ?? "")
          }
          onClick={(e) => e.stopPropagation()}
          aria-label={`Contact ${label ?? "number"} ${number}`}
        >
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{number}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-52 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {label ? (
          <p className="px-1 pb-2 text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
        ) : null}
        <div className="grid gap-1.5">
          <Button asChild variant="outline" className="justify-start">
            <a href={telHref(number)}>
              <Phone className="mr-2 h-4 w-4" /> Call
            </a>
          </Button>
          <Button asChild variant="outline" className="justify-start" disabled={!wa}>
            <a href={`https://wa.me/${wa ?? ""}`} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
            </a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
