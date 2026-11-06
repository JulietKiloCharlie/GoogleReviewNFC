import { safeAccent } from "@/lib/validation";

export function Stars({
  value,
  onChange,
  accent,
}: {
  value: number;
  onChange: (rating: number) => void;
  accent: string;
}) {
  const colour = safeAccent(accent);
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((rating) => {
        const selected = rating <= value;
        return (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={value === rating}
            aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
            className="grid h-14 w-14 place-items-center rounded-xl border border-line text-3xl"
            style={{ color: selected ? colour : "#6d7380", background: selected ? "#ffffff14" : "transparent" }}
            onClick={() => onChange(rating)}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
