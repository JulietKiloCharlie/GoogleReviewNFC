export type ReviewPanel = "feedback" | "google";

export function reviewPanels(rating: number): { primary: ReviewPanel; secondary: ReviewPanel | null } | null {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  if (rating <= 2) return { primary: "feedback", secondary: "google" };
  return { primary: "google", secondary: null };
}
