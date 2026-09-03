/**
 * Type declarations for `utils/auth.js`. The runtime module is plain
 * JavaScript; these declarations pin the structured-args contract actually
 * used at runtime. Response bodies from axios are untyped JSON, so `data`
 * fields stay `unknown` (or `any` where callers pipe mapped errors straight
 * back into their own response types).
 */

export interface StoredAuthState {
  token: string | null;
  userId: string | null;
  email: string | null;
  username: string | null;
  scoreId: string | null;
  // SecureStore values JSON-parsed back into booleans/strings/numbers/null.
  isTutorialFinished: unknown;
  isPaid: unknown;
  paidTier: unknown;
  paidExpiresAt: unknown;
  isGroupOwner: unknown;
  activeGroupId: unknown;
  isPrivateMode: unknown;
}

// Transport headers are typed to the non-null contract every typed caller
// already assumes (`token: string` as Authorization, `userId` in URL paths);
// a storage miss means no session, which callers handle before use.
export interface BackendHeaders {
  token: string;
  userId: string | number;
  scoreId: string | null;
}

export interface BackendRequestResult {
  status?: number;
  data?: unknown;
}

export function hasCompleteAuthState(authState: unknown): boolean;
export function isPersistedBearerToken(token: unknown): boolean;
export function getStoredAuthState(): Promise<StoredAuthState>;
export function bootstrapStoredAuthSession(
  restoreSession: (authState: StoredAuthState) => void | Promise<void>,
): Promise<boolean>;
export function getBackendHeadersFromStorage(): Promise<BackendHeaders>;
export function getBackendHeadersFromContext(context?: unknown): Promise<BackendHeaders>;
export function getBackendHeaders(context?: unknown): Promise<BackendHeaders>;
export function setHeaders({ token }: { token?: string | null }): Record<string, string>;
// `data` is the raw axios error payload (parsed JSON body, request object, or
// the error itself) — genuinely dynamic, kept `any` so mapped errors flow back
// into callers' own response types unchanged.
export function mapRequestError(error: unknown): { status?: number; data?: any };
export function getScoreId(context?: unknown): Promise<BackendRequestResult>;
export function createUser({ email, password, confirmPassword, username }: {
  email?: string;
  password?: string;
  confirmPassword?: string;
  username?: string;
}): Promise<unknown>;
export function login({ email, password }: { email?: string; password?: string }): Promise<unknown>;
export function checkSecureStoreItem({ secureStoreValue, context }: {
  secureStoreValue: string;
  context?: unknown;
}): Promise<string | null>;
export function validateStoredSession({ context }: { context?: unknown }): Promise<BackendRequestResult>;
export function updateUser({ context, data }: { context?: unknown; data?: unknown }): Promise<BackendRequestResult>;
export function deleteAccount({ context }: { context?: unknown }): Promise<BackendRequestResult>;
