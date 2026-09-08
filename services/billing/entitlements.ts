// Minimal slice of the AuthContext value from store/auth-context.js that this
// module (and its importers) reads. Kept as a tiny type-only module so billing
// helpers and upload services can depend on the auth shape without pulling
// store code into pure policy modules. `token` covers transport-level callers
// (e.g. services/groups/categoryThumbnailUpload.ts).
export type AuthContextLike = { paidTier?: number; token?: string | null };
