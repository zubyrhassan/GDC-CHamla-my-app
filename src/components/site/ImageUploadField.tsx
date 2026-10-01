import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SiteImage } from "@/components/site/SiteImage";
import { uploadSiteImage } from "@/lib/site";

/** Upload control with a live preview of the stored image. */
export function ImageUploadField({
  value,
  folder,
  label = "Image",
  previewClassName = "h-24 w-32 rounded-md border",
  onChange,
}: {
  value: string | null;
  folder: string;
  label?: string;
  previewClassName?: string;
  onChange: (path: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadSiteImage(file, folder);
      onChange(path);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <SiteImage path={value} alt={`${label} preview`} className={previewClassName} />
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              Remove
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handle(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
