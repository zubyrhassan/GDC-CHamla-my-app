import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { extractFromPhoto } from "@/lib/vision.functions";

export type ScanKind = "student" | "marks" | "fee" | "attendance";

/**
 * Shrinks a camera photo before it travels to the reader — phone pictures are
 * several megabytes and the extra pixels do not improve the reading.
 */
export async function fileToDataUrl(file: File, maxSide = 1600): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that picture."));
    reader.readAsDataURL(file);
  });

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("unsupported"));
      el.src = dataUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    if (scale === 1 && dataUrl.length < 1_500_000) return dataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return dataUrl;
  }
}

/** Reads a PDF as a data URL so it can travel to the reader unchanged. */
export function pdfToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that PDF."));
    reader.readAsDataURL(file);
  });
}

/** Reads a photographed document and returns the fields the model could find. */
export function usePhotoScan(kind: ScanKind, hint?: string) {
  const extract = useServerFn(extractFromPhoto);
  return useMutation({
    mutationFn: async (file: File) => {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const image = isPdf ? await pdfToDataUrl(file) : await fileToDataUrl(file);
      const res = await extract({ data: { image, kind, ...(hint ? { hint } : {}) } });
      return JSON.parse(res.json) as Record<string, unknown>;
    },
  });
}

/** Normalises a Pakistani mobile number to local 03XXXXXXXXX form. */
export function localPhone(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("92")) return `0${digits.slice(2)}`;
  if (digits.startsWith("0")) return digits;
  if (digits.length === 10) return `0${digits}`;
  return digits;
}

export const asText = (v: unknown) => String(v ?? "").trim();

export const asNumber = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Accepts YYYY-MM-DD, DD/MM/YYYY and similar; returns "" when unusable. */
export function asDate(v: unknown): string {
  const raw = asText(v);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}
