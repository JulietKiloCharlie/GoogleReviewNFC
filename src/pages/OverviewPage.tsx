import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listBusinesses, saveError } from "@/lib/businesses";
import type { Business } from "@/lib/types";

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(new Date(value));
}

export function OverviewPage() {
  const [rows, setRows] = useState<Business[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBusinesses().then(setRows).catch((caught) => setError(saveError(caught)));
  }, []);

  const active = rows.filter((row) => row.status === "active").length;
  const unpublished = rows.filter((row) => row.status === "draft").length;

  return (
    <div>
      <h1 className="text-3xl font-semibold">Overview</h1>
      {error ? <p className="mt-4 text-sm text-bad">{error}</p> : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Registered businesses", rows.length],
          ["Active review pages", active],
          ["Unpublished businesses", unpublished],
        ].map(([label, value]) => (
          <section key={String(label)} className="rounded-2xl border border-line bg-panel p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </section>
        ))}
      </div>
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recently added</h2>
          <Link className="text-sm text-accent underline" to="/admin/businesses/new">
            Add Business
          </Link>
        </div>
        <div className="space-y-2">
          {rows.slice(0, 5).map((row) => (
            <div key={row.id} className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3">
              <span>
                <strong>{row.name}</strong>
                <small className="mt-1 block text-muted">{dateLabel(row.created_at)}</small>
              </span>
              <span className="text-sm capitalize text-muted">{row.status}</span>
            </div>
          ))}
          {rows.length === 0 && !error ? <p className="text-sm text-muted">No businesses yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
