import axios from 'axios';
import { getBackendHeaders, setHeaders, mapRequestError } from '../../utils/auth';

function leaderboardUrl(groupId) {
  return `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/private_groups/${groupId}/leaderboard`;
}

function normalizeLeaderboard(payload) {
  const cursorRows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : null;

  if (cursorRows) {
    const nextCursor = payload?.next_cursor ?? payload?.nextCursor ?? null;
    const hasMore = payload?.has_more ?? !!nextCursor;

    return { rows: cursorRows, nextCursor, hasMore };
  }

  const initial = payload?.data ?? payload;
  const rows = Array.isArray(initial?.rows) ? initial.rows : [];

  return {
    rows,
    nextCursor: initial?.next_cursor ?? initial?.nextCursor ?? payload?.next_cursor ?? null,
    hasMore: initial?.has_more ?? payload?.has_more ?? false,
    meta: initial?.meta ?? null,
    me: initial?.me ?? null,
  };
}

async function fetchLeaderboardPage(context, groupId, params) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }), params };

  return axios.get(`${leaderboardUrl(groupId)}/`, config)
    .then((response) => ({ status: response.status, data: normalizeLeaderboard(response.data) }))
    .catch(mapRequestError);
}

export async function fetchPrivateLeaderboard(context, { groupId, limit, board } = {}) {
  const params = {};
  if (limit) params.limit = limit;
  if (board) params.board = board;

  return fetchLeaderboardPage(context, groupId, params);
}

export async function fetchPrivateLeaderboardNext(context, { groupId, after, limit, board } = {}) {
  const params = {};
  if (after) params.after = after;
  if (limit) params.limit = limit;
  if (board) params.board = board;

  return fetchLeaderboardPage(context, groupId, params);
}
