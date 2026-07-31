// Minimal slice of the AuthContext value from store/auth-context.js that this module reads.
// Kept as a tiny type-only module so billing helpers can depend on the auth shape
// without pulling store code into pure policy modules.
export type AuthContextLike = { paidTier?: number };
