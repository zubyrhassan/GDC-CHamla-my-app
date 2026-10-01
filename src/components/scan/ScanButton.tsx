import { useRef } from "react";
import { toast } from "sonner";
import { Camera, ImageUp, Loader2, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePhotoScan, type ScanKind } from "@/lib/photo-scan";

/**
 * Camera / gallery capture that reads a paper document and hands the detected
 * values back to the form. Nothing is saved until the clerk reviews it.
 */
export function ScanButton({
  kind,
  hint,
  label = "Scan photo",
  disabled,
  variant = "outline",
  size = "default",
  className,
  onResult,
}: {
  kind: ScanKind;
  hint?: string;
  label?: string;
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm";
  className?: string;
  onResult: (data: Record<string, unknown>) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const scan = usePhotoScan(kind, hint);

  const handle = (file: File | undefined) => {
    if (!file) return;
    scan.mutate(file, {
      onSuccess: (data) => onResult(data),
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : "The picture could not be read."),
    });
  };

  return (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size}
            disabled={disabled || scan.isPending}
            className={className}
          >
            {scan.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <ScanLine className="mr-1.5 h-4 w-4" />
            )}
            {scan.isPending ? "Reading…" : label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => cameraRef.current?.click()}>
            <Camera className="mr-2 h-4 w-4" /> Take a photo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => galleryRef.current?.click()}>
            <ImageUp className="mr-2 h-4 w-4" /> Choose from gallery
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
