import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StudentPhoto, uploadStudentPhoto } from "@/lib/student-photo";

/** Photo upload/replace control reused by the hostel allotment screen. */
export function PhotoField({
  value,
  rollNumber,
  name,
  onChange,
}: {
  value: string;
  rollNumber: string;
  name: string;
  onChange: (path: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadStudentPhoto(file, rollNumber);
      onChange(path);
      toast.success("Photograph uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
      <StudentPhoto path={value} name={name} className="h-20 w-16" />
      <div className="min-w-0">
        <p className="text-sm font-medium">Photograph</p>
        <p className="text-xs text-muted-foreground">
          Confirm the boarder's photo while admitting them to the hostel.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || !rollNumber}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {uploading ? "Uploading…" : value ? "Replace photo" : "Upload photo"}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              Remove
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
