import { ImageIcon } from "lucide-react";

import { useSiteImage } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Renders an image stored in the website media bucket (signed URL) with a placeholder. */
export function SiteImage({
  path,
  alt,
  className,
  imgClassName,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const { data: url } = useSiteImage(path);

  return (
    <span
      className={cn(
        "flex items-center justify-center overflow-hidden bg-muted text-muted-foreground",
        className,
      )}
    >
      {url ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          className={cn("h-full w-full object-cover", imgClassName)}
        />
      ) : (
        <ImageIcon className="h-6 w-6 opacity-50" aria-hidden="true" />
      )}
    </span>
  );
}
