import { createHandler } from "./_lib/sync-core.js";
import { blobStore, blobGuard } from "./_lib/blob-store.js";

export default createHandler({ store: blobStore(), guard: blobGuard(), getCode: () => process.env.APP_CODE });
