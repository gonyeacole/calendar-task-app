// Where the shared data lives: one private file in a Vercel Blob store (not reachable without the store's token).
import { get, put } from "@vercel/blob";

const PATH = "calendar-data.json";

export function blobStore() {
  return {
    async read() {
      let r;
      try { r = await get(PATH, { access: "private", useCache: false }); } catch (e) { if (e && e.name === "BlobNotFoundError") return { doc: null, etag: null }; throw e; }
      if (!r || r.statusCode !== 200) return { doc: null, etag: null };
      return { doc: JSON.parse(await new Response(r.stream).text()), etag: r.blob.etag };
    },
    async write(doc, etag) {
      try {
        await put(PATH, JSON.stringify(doc), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, ...(etag ? { ifMatch: etag } : {}) });
      } catch (e) {
        if (e && (e.name === "BlobPreconditionFailedError" || /precondition/i.test(String(e.message)))) { const c = new Error("conflict"); c.code = "CONFLICT"; throw c; }
        throw e;
      }
    },
  };
}

// Remembers recent wrong-code guesses (timestamps only) for the lockout.
const GUARD_PATH = "calendar-guard.json";
export function blobGuard() {
  async function read() {
    let r;
    try { r = await get(GUARD_PATH, { access: "private", useCache: false }); } catch (e) { if (e && e.name === "BlobNotFoundError") return { fails: [], etag: null }; throw e; }
    if (!r || r.statusCode !== 200) return { fails: [], etag: null };
    const j = JSON.parse(await new Response(r.stream).text());
    return { fails: Array.isArray(j.fails) ? j.fails.filter((x) => typeof x === "number") : [], etag: r.blob.etag };
  }
  return {
    read,
    async record(ts) {
      for (let i = 0; i < 4; i++) {
        const { fails, etag } = await read();
        const next = [...fails.filter((x) => x > ts - 3600_000), ts].slice(-200);
        try {
          await put(GUARD_PATH, JSON.stringify({ fails: next }), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, ...(etag ? { ifMatch: etag } : {}) });
          return;
        } catch (e) { if (!(e && (e.name === "BlobPreconditionFailedError" || /precondition/i.test(String(e.message))))) throw e; }
      }
    },
  };
}
