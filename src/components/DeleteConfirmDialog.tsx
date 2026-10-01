import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Reusable destructive confirmation. When `confirmText` is given the user must
 * type it exactly (used for students, where linked records are removed too).
 */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  details,
  confirmText,
  confirmLabel = "Yes, delete",
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  details?: ReactNode;
  confirmText?: string | undefined;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const ready = !confirmText || typed.trim() === confirmText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {details ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm">
            {details}
          </div>
        ) : null}

        {confirmText ? (
          <div className="space-y-1.5">
            <Label className="text-xs tracking-wide text-muted-foreground uppercase">
              Type “{confirmText}” to confirm
            </Label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmText}
              autoComplete="off"
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!ready || pending} onClick={onConfirm}>
            {pending ? "Deleting…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
