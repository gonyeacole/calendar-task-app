// The shared-calendar endpoint: checks the household code, merges what a phone sends into what is stored, and returns the result.
import { createHash, timingSafeEqual } from "node:crypto";
import { cleanDoc, emptyDoc, mergeDocs, sameDoc } from "../../merge.js";

const digest = (s) => createHash("sha256").update(String(s)).digest();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_BYTES = 1_500_000;

export function createHandler({ store, getCode }) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    try {
      const expected = getCode();
      if (!expected) return res.status(500).json({ error: "not configured" });
      const given = req.headers["x-app-code"] || "";
      if (!timingSafeEqual(digest(given), digest(expected))) {
        await sleep(400);   // slows down anyone guessing
        return res.status(401).json({ error: "wrong code" });
      }
      if (req.method === "GET") {
        const { doc } = await store.read();
        return res.status(200).json({ data: cleanDoc(doc) });
      }
      if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
      if (JSON.stringify(req.body || {}).length > MAX_BYTES) return res.status(413).json({ error: "too big" });
      const incoming = cleanDoc(req.body && req.body.data);
      for (let attempt = 0; attempt < 4; attempt++) {
        const { doc, etag } = await store.read();
        const merged = mergeDocs(doc || emptyDoc(), incoming);
        if (doc && sameDoc(doc, merged)) return res.status(200).json({ data: merged });
        try {
          await store.write(merged, etag);
          return res.status(200).json({ data: merged });
        } catch (e) {
          if (e && e.code !== "CONFLICT") throw e;   // someone else saved at the same moment: read again and retry
        }
      }
      return res.status(409).json({ error: "busy, try again" });
    } catch (e) {
      console.error("sync failed", e && e.message);
      return res.status(500).json({ error: "server error" });
    }
  };
}
