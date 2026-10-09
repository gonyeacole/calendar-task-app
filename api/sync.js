import { createHandler } from "./_lib/sync-core.js";
import { blobStore } from "./_lib/blob-store.js";

export default createHandler({ store: blobStore(), getCode: () => process.env.APP_CODE });
