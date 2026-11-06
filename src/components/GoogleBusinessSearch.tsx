import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  googleMapsKey,
  listingFromPrediction,
  loadPlaces,
  placesErrorMessage,
  searchBusinesses,
  type GoogleListing,
  type PlaceHit,
} from "@/lib/googlePlaces";
import { field, hint } from "@/lib/styles";

type Props = {
  onApply: (listing: GoogleListing) => boolean;
};

export function GoogleBusinessSearch({ onApply }: Props) {
  const configured = Boolean(googleMapsKey());
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestId = useRef(0);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setHits([]);
      setSearching(false);
      return;
    }
    const handle = window.setTimeout(() => {
      void runSearch(trimmed);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [configured, query]);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function sessionToken() {
    const places = await loadPlaces();
    if (!tokenRef.current) tokenRef.current = new places.AutocompleteSessionToken();
    return tokenRef.current;
  }

  async function runSearch(input: string) {
    const id = ++requestId.current;
    setSearching(true);
    setError(null);
    setOpen(true);
    try {
      const next = await searchBusinesses(input, await sessionToken());
      if (id !== requestId.current) return;
      setHits(next);
      setActive(0);
      if (next.length === 0) setError("No Google listings matched. Add the town or street, or paste a review link.");
    } catch (caught) {
      if (id !== requestId.current) return;
      setHits([]);
      setError(placesErrorMessage(caught));
    } finally {
      if (id === requestId.current) setSearching(false);
    }
  }

  async function choose(hit: PlaceHit) {
    setSelecting(true);
    setError(null);
    try {
      const listing = await listingFromPrediction(hit.prediction);
      if (!onApply(listing)) return;
      const places = await loadPlaces();
      tokenRef.current = new places.AutocompleteSessionToken();
      setQuery(listing.name || hit.name);
      setHits([]);
      setOpen(false);
    } catch (caught) {
      setError(placesErrorMessage(caught));
    } finally {
      setSelecting(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => Math.min(current + 1, Math.max(hits.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = hits[active];
      if (open && hit) void choose(hit);
    }
  }

  const showMenu = open && (searching || hits.length > 0 || Boolean(error));

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold">Find Business on Google</h2>
        <p className={hint}>Type the business name, then choose the right listing. The Google review link is filled in automatically.</p>
      </div>
      {configured ? (
        <div className="relative" ref={boxRef}>
          <label className="block text-sm font-medium">
            Search Google for a business
            <input
              className={`${field} mt-1.5`}
              role="combobox"
              aria-expanded={showMenu}
              aria-controls={listId}
              aria-autocomplete="list"
              value={query}
              placeholder="Search Google for a business..."
              autoComplete="off"
              disabled={selecting}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                if (hits.length > 0 || error) setOpen(true);
              }}
              onKeyDown={onKeyDown}
            />
          </label>
          {showMenu ? (
            <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-panel shadow-lg">
              {searching ? <li className="px-3 py-2 text-sm text-muted">Searching…</li> : null}
              {hits.map((hit, index) => (
                <li key={hit.placeId} role="option" aria-selected={index === active}>
                  <button
                    className={`w-full px-3 py-2 text-left ${index === active ? "bg-panel-2" : "hover:bg-panel-2"}`}
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void choose(hit)}
                  >
                    <span className="block font-medium">{hit.name}</span>
                    {hit.address ? <span className="block text-sm text-muted">{hit.address}</span> : null}
                  </button>
                </li>
              ))}
              {error ? <li className="px-3 py-2 text-sm text-bad">{error}</li> : null}
              <li className="border-t border-line px-3 py-2">
                <img className="h-4 w-auto" alt="Powered by Google" src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-non-white3.png" />
              </li>
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">Google search is not configured yet. Paste a review link below until a Maps key is added.</p>
      )}
    </section>
  );
}
