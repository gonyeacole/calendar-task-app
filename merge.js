// Merging two copies of the calendar data. Used by both the server (api/sync.js) and the app, so a change made on one
// phone and a change made on the other end up in the same place. Every item has an id and a `u` (last changed, in ms);
// the newer copy of an item wins. Deleted items leave a note in `_del` so a delete on one phone isn't undone by the other.
export const COLLECTIONS = ["events", "tasks", "payments", "birthdays"];
export const emptyDoc = () => ({ events: [], tasks: [], payments: [], birthdays: [], _del: {} });

// Keep only what the app understands, in the right shape.
export function cleanDoc(d) {
  const out = emptyDoc();
  if (!d || typeof d !== "object") return out;
  for (const c of COLLECTIONS) {
    if (Array.isArray(d[c])) out[c] = d[c].filter((x) => x && typeof x === "object" && typeof x.id === "string" && x.id);
  }
  if (d._del && typeof d._del === "object") {
    for (const [id, ts] of Object.entries(d._del)) if (typeof ts === "number" && isFinite(ts)) out._del[id] = ts;
  }
  return out;
}

export function mergeDocs(a, b) {
  a = cleanDoc(a); b = cleanDoc(b);
  const out = emptyDoc();
  out._del = { ...a._del };
  for (const [id, ts] of Object.entries(b._del)) out._del[id] = Math.max(out._del[id] || 0, ts);
  for (const c of COLLECTIONS) {
    const byId = new Map();
    for (const item of [...a[c], ...b[c]]) {
      const prev = byId.get(item.id);
      if (!prev || (item.u || 0) > (prev.u || 0)) byId.set(item.id, item);
    }
    out[c] = [...byId.values()].filter((x) => !(x.id in out._del) || out._del[x.id] < (x.u || 0));
  }
  return out;
}

// Same content, whatever the order? (used to skip pointless writes)
export function sameDoc(a, b) {
  const norm = (d) => JSON.stringify([...COLLECTIONS.map((c) => [...cleanDoc(d)[c]].sort((x, y) => (x.id < y.id ? -1 : 1))), Object.entries(cleanDoc(d)._del).sort()]);
  return norm(a) === norm(b);
}
