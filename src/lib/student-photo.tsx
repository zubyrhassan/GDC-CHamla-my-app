import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** First letters of the first two words of a name. */
export function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

const AVATAR_TONES = [
  "bg-primary/15 text-primary",
  "bg-accent/20 text-accent-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-muted text-foreground",
];

/** Stable colour pick so the same student always gets the same circle. */
export function toneFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

/** Round avatar: photograph when available, otherwise coloured initials. */
export function StudentAvatar({
  path,
  name,
  className,
}: {
  path: string | null | undefined;
  name: string;
  className?: string;
}) {
  const { data: url } = useSignedPhoto(path);

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-semibold",
        url ? "bg-muted" : toneFor(name),
        className ?? "h-10 w-10",
      )}
      aria-hidden="true"
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

export const PHOTO_BUCKET = "student-photos";

/** photo_url stores an object path inside the private bucket (or a full https URL). */
export function useSignedPhoto(path: string | null | undefined) {
  return useQuery({
    queryKey: ["student-photo", path],
    enabled: Boolean(path),
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path, 60 * 60);
      if (error) return null;
      return data.signedUrl;
    },
  });
}

export function StudentPhoto({
  path,
  name,
  className,
}: {
  path: string | null | undefined;
  name: string;
  className?: string;
}) {
  const { data: url } = useSignedPhoto(path);

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground",
        className ?? "h-10 w-10",
      )}
    >
      {url ? (
        <img src={url} alt={`Photograph of ${name}`} className="h-full w-full object-cover" />
      ) : (
        <User className="h-1/2 w-1/2" />
      )}
    </span>
  );
}

export async function uploadStudentPhoto(file: File, rollNumber: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeRoll = rollNumber.trim().replace(/[^a-zA-Z0-9-]/g, "_") || "student";
  const path = `${safeRoll}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}
