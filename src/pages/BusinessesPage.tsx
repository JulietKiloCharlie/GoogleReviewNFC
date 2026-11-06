import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteBusiness, listBusinesses, saveError, setBusinessStatus } from "@/lib/businesses";
import { btnDanger, btnGhost, field } from "@/lib/styles";
import type { Business } from "@/lib/types";
import { businessUrl, logoPublicUrl } from "@/lib/urls";

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(new Date(value));
}

export function BusinessesPage() {
  const [rows, setRows] = useState<Business[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Business | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function refresh() {
    setRows(await listBusinesses());
  }

  useEffect(() => {
    refresh().catch((caught) => setError(saveError(caught)));
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => `${row.name} ${row.slug}`.toLowerCase().includes(needle));
  }, [query, rows]);

  async function copy(row: Business) {
    await navigator.clipboard.writeText(businessUrl(row.slug));
    setCopied(row.id);
  }

  async function toggle(row: Business) {
    setError(null);
    try {
      await setBusinessStatus(row, row.status === "active" ? "disabled" : "active");
      await refresh();
    } catch (caught) {
      setError(saveError(caught));
    }
  }

  async function remove() {
    if (!pendingDelete || confirmName !== pendingDelete.name) return;
    setError(null);
    try {
      await deleteBusiness(pendingDelete);
      setPendingDelete(null);
      setConfirmName("");
      setNotice(`${pendingDelete.name} was deleted.`);
      await refresh();
    } catch (caught) {
      setError(saveError(caught));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Businesses</h1>
          <p className="mt-1 text-sm text-muted">Search, copy a live URL, or update a page.</p>
        </div>
        <Link className={btnGhost} to="/admin/businesses/new">
          Add Business
        </Link>
      </div>
      <label className="mt-5 block text-sm">
        Search
        <input className={`${field} mt-1.5 max-w-md`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or page address" />
      </label>
      {error ? <p className="mt-4 text-sm text-bad">{error}</p> : null}
      {notice ? <p className="mt-4 text-sm text-good">{notice}</p> : null}
      <div className="mt-5 space-y-3">
        {visible.map((row) => {
          const logo = logoPublicUrl(row.logo_path);
          const live = row.status === "active";
          return (
            <article key={row.id} className="rounded-2xl border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center gap-3">
                {logo ? <img src={logo} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-lg bg-panel-2 text-sm">{row.name.slice(0, 1)}</span>}
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{row.name}</h2>
                  <p className="truncate text-sm text-muted">{businessUrl(row.slug)}</p>
                </div>
                <div className="text-sm text-muted">
                  <p>{dateLabel(row.created_at)}</p>
                  <p className="capitalize">{row.status}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {live ? (
                  <a className={btnGhost} href={businessUrl(row.slug)} target="_blank" rel="noreferrer">
                    Preview
                  </a>
                ) : (
                  <button className={btnGhost} type="button" disabled>
                    Preview
                  </button>
                )}
                <button className={btnGhost} type="button" disabled={!live} onClick={() => copy(row)}>
                  {copied === row.id ? "Copied" : "Copy URL"}
                </button>
                <Link className={btnGhost} to={`/admin/businesses/${row.id}`}>
                  Edit
                </Link>
                <button className={btnGhost} type="button" disabled={row.status === "draft"} onClick={() => toggle(row)}>
                  {row.status === "active" ? "Disable" : "Enable"}
                </button>
                <button className={btnDanger} type="button" onClick={() => { setPendingDelete(row); setConfirmName(""); }}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
        {visible.length === 0 ? <p className="text-sm text-muted">No businesses match that search.</p> : null}
      </div>
      {pendingDelete ? (
        <div className="fixed inset-0 grid place-items-center bg-black/70 px-4" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-5">
            <h2 id="delete-title" className="text-xl font-semibold">Delete {pendingDelete.name}</h2>
            <p className="mt-2 text-sm text-muted">Type the business name to confirm. The public page and its old addresses will stop working.</p>
            <input className={`${field} mt-4`} value={confirmName} onChange={(event) => setConfirmName(event.target.value)} aria-label="Business name confirmation" />
            <div className="mt-4 flex gap-2">
              <button className={btnDanger} type="button" disabled={confirmName !== pendingDelete.name} onClick={remove}>
                Delete business
              </button>
              <button className={btnGhost} type="button" onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
