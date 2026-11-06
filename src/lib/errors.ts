export function readableError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && error.code === "23505") {
    return "Another business already uses that page address.";
  }
  if (error instanceof Error && error.message) {
    if (error.message.includes("slug_taken")) return "Another business already uses that page address.";
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    if (error.message.includes("slug_taken")) return "Another business already uses that page address.";
    return error.message;
  }
  return "Something went wrong. Try again.";
}
