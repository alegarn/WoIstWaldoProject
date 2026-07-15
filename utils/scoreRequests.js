import axios from "axios";
import { getBackendHeaders } from "./auth";
import { setHeaders } from "./auth";
import { buildE2ERankingResponse, buildE2EUserScores, isE2EMode } from './e2eMode';
import {
  fetchPrivateLeaderboard,
  fetchPrivateLeaderboardNext,
} from '../services/groups/groupLeaderboardApi';

function isPrivateScope(scope) {
  return scope && typeof scope === 'object' && scope.kind === 'private' && !!scope.groupId;
}

export async function updateUserScore({ score, pictureId, context, scope }) {
  if (isE2EMode()) {
    return { status: 200, message: 'E2E score update skipped' };
  }

  if (isPrivateScope(scope)) {
    const { token, uid, expiry, access_token, client, userId, scoreId } = await getBackendHeaders(context);
    const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/scores/${scoreId}`;
    const headers = setHeaders({ token, uid, expiry, access_token, client });
    const config = {
      headers,
      params: {
        scope: 'private',
        group_id: scope.groupId,
      },
    };
    const requestData = {
      score: {
        score: score,
        image_id: pictureId,
      },
    };

    return axios
      .put(url, requestData, config)
      .then((response) => {
        return { status: response.status, message: response.data };
      })
      .catch((error) => {
        return {
          status: error?.request?.status,
          message: error?.message,
        }
      });
  }

  const { token, uid, expiry, access_token, client, userId, scoreId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/scores/${scoreId}`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });
  const config = {
    headers: headers,
  };
  const requestData = {
    score: {
      score: score,
      image_name: pictureId
    },
  };

  const response = axios
    .put(url, requestData, config)
    .then((response) => {
      return { status: 200, message: response };
    })
    .catch((error) => {
      return {
        status: error.request.status,
        message: error.message,
      }
    })
  return response;
};

export async function submitScoreBatch({ items, context }) {
  if (!Array.isArray(items) || items.length === 0) {
    return false;
  }

  const isPrivate = items[0]?.scope?.kind === 'private';
  const { token, userId } = await getBackendHeaders(context);
  const headers = setHeaders({ token });

  if (isPrivate) {
    const groupId = items[0].scope.groupId;
    const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/private_groups/${groupId}/game_complete/batch`;
    const results = items.map((item) => ({
      guess_id: item.guessId,
      image_id: item.pictureId,
      earned_points: item.points,
      streak: item.streak ?? 0,
    }));

    return axios
      .post(url, { batch: { results } }, { headers })
      .then(() => true)
      .catch(() => false);
  }

  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/scores/batch`;
  const results = items.map((item) => ({
    guess_id: item.guessId,
    image_name: item.pictureId,
    points: item.points,
    streak: item.streak ?? 0,
  }));

  return axios
    .post(url, { batch: { results } }, { headers })
    .then(() => true)
    .catch(() => false);
}

export async function getRankingData(context, { scope, top, window, page, after, limit } = {}) {
  if (isE2EMode()) {
    const e2eData = buildE2ERankingResponse({ after, limit, scope, page });
    return { status: 200, data: e2eData };
  }

  if (isPrivateScope(scope)) {
    if (after) {
      return fetchPrivateLeaderboardNext(context, { groupId: scope.groupId, after, limit });
    }
    return fetchPrivateLeaderboard(context, { groupId: scope.groupId, limit });
  }

  const { token, uid, expiry, access_token, client, userId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/scores`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });

  const params = {};
  if (scope) params.scope = scope;
  if (top) params.top = top;
  if (window) params.window = window;
  if (page) params.page = page;
  if (after) params.after = after;
  if (limit) params.limit = limit;

  const config = {
    headers: headers,
    params,
  };

  const response = await axios
    .get(url, config)
    .then((response) => {
      const payload = response.data;
      let normalized;

      if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data) && payload.data.rows) {
        normalized = {
          rows: payload.data.rows,
          nextCursor: null,
          hasMore: false,
          me: payload.data.me || null,
          meta: payload.data.meta || null,
          pagy: null,
        };
      } else if (payload.next_cursor !== undefined) {
        normalized = {
          rows: Array.isArray(payload.data) ? payload.data : [],
          nextCursor: payload.next_cursor || null,
          hasMore: !!payload.has_more,
          me: null,
          meta: null,
          pagy: null,
        };
      } else if (payload.pagy) {
        normalized = {
          rows: Array.isArray(payload.data) ? payload.data : [],
          nextCursor: null,
          hasMore: payload.pagy.next != null,
          me: null,
          meta: null,
          pagy: payload.pagy,
        };
      } else {
        normalized = {
          rows: Array.isArray(payload.data) ? payload.data : [],
          nextCursor: null,
          hasMore: false,
          me: null,
          meta: null,
          pagy: null,
        };
      }

      return { status: response.status, data: normalized };
    })
    .catch((error) => {
      return { status: error?.request?.status, message: error.message };
    });
  return response;
};

export async function getUserScores({username, context, scope}) {
  if (isE2EMode()) {
    return {
      status: 200,
      data: buildE2EUserScores(username),
    };
  }

  const { token, uid, expiry, access_token, client, userId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/get_user_scores`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });
  const params = { username };
  if (isPrivateScope(scope)) {
    params.group_id = scope.groupId;
  }
  const config = {
    headers: headers,
    params,
  };
  const response = await axios.get(url, config).then((response) => {
    return { status: response.status, data: response.data };
  })
  .catch((error) => {
    return { status: error?.request?.status, message: error.message };
  });
  return response;
};
