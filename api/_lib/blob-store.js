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
