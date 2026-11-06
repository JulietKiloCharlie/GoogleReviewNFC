import { LIMITS } from "./constants";

const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp"]);

export function logoFileError(file: File): string | null {
  if (!ACCEPTED.has(file.type)) return "Upload a PNG, JPG, or WebP logo.";
  if (file.size > LIMITS.logoBytes) return "That logo is larger than 8 MB.";
  return null;
}

export async function optimiseLogo(file: File): Promise<Blob> {
  const problem = logoFileError(file);
  if (problem) throw new Error(problem);

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the logo.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.86);
  });
  if (!blob) throw new Error("This browser could not prepare the logo.");
  return blob;
}
