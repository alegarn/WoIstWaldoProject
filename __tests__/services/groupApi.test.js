jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

jest.mock('../../utils/auth', () => ({
  getBackendHeaders: jest.fn(),
  setHeaders: jest.fn(),
  mapRequestError: jest.fn((error) => ({
    status: error?.response?.status ?? error?.request?.status,
    data: error?.response?.data ?? error,
  })),
}));

jest.mock('../../services/groups/groupFeedCache', () => ({
  clearGroupFeedCache: jest.fn(),
  purgeAllPrivateCaches: jest.fn(),
}));

jest.mock('../../services/groups/groupCategoryThumbnails', () => ({
  clearGroupThumbnails: jest.fn(),
}));

import axios from 'axios';
import { getBackendHeaders, setHeaders } from '../../utils/auth';
import { clearGroupFeedCache, purgeAllPrivateCaches } from '../../services/groups/groupFeedCache';
import { clearGroupThumbnails } from '../../services/groups/groupCategoryThumbnails';

import {
  fetchGroups,
  createGroup,
  updateGroupSettings,
  deleteGroup,
  setActiveGroup,
} from '../../services/groups/groupApi';
import {
  listMembers,
  removeMember,
  leaveGroup,
  transferOwnership,
} from '../../services/groups/groupMembershipApi';
import { joinByCode } from '../../services/groups/groupJoinApi';
import {
  listGroupCategories,
  createGroupCategory,
  deleteGroupCategory,
} from '../../services/groups/groupCategoriesApi';
import {
  fetchPrivateLeaderboard,
  fetchPrivateLeaderboardNext,
} from '../../services/groups/groupLeaderboardApi';
import { preparePrivateUpload } from '../../services/groups/groupUploadApi';

const TOKEN = 'Bearer token-1';
const AUTH_HEADERS = { Authorization: TOKEN, HTTP_AUTHORIZATION: TOKEN };
const CONTEXT = { token: TOKEN, userId: 'user-1', scoreId: 'score-1' };

describe('services/groups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_APP_BACKEND_URL = 'https://backend.example/';
    getBackendHeaders.mockResolvedValue({ token: TOKEN, userId: 'user-1', scoreId: 'score-1' });
    setHeaders.mockReturnValue(AUTH_HEADERS);
  });

  describe('groupApi', () => {
    it('fetchGroups GETs the private_groups index with the bearer token and normalizes owner/member split', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: [
          { id: 'g-1', owner_id: 'user-1', name: 'Mine' },
          { id: 'g-2', owner_id: 'user-2', name: 'Theirs' },
        ],
      });

      const response = await fetchGroups(CONTEXT);

      expect(axios.get).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/',
        { headers: AUTH_HEADERS }
      );
      expect(response.status).toBe(200);
      expect(response.data.owned).toEqual([
        expect.objectContaining({ id: 'g-1', role: 'owner' }),
      ]);
      expect(response.data.joined).toEqual([
        expect.objectContaining({ id: 'g-2', role: 'member' }),
      ]);
    });

    it('createGroup POSTs the serialized private_group payload', async () => {
      axios.post.mockResolvedValue({ status: 201, data: { id: 'g-9' } });

      const response = await createGroup(CONTEXT, {
        name: 'Waldos',
        primaryColor: '#fff',
        secondaryColor: '#000',
      });

      expect(axios.post).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/',
        {
          private_group: {
            name: 'Waldos',
            primary_color: '#fff',
            secondary_color: '#000',
          },
        },
        { headers: AUTH_HEADERS }
      );
      expect(response).toEqual({ status: 201, data: { id: 'g-9' } });
    });

    it('updateGroupSettings PATCHes only the supplied fields', async () => {
      axios.patch.mockResolvedValue({ status: 200, data: { id: 'g-1' } });

      await updateGroupSettings(CONTEXT, 'g-1', { name: 'New name' });

      expect(axios.patch).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/g-1/',
        { private_group: { name: 'New name' } },
        { headers: AUTH_HEADERS }
      );
    });

    it('deleteGroup DELETEs the group endpoint and clears private caches on success', async () => {
      axios.delete.mockResolvedValue({ status: 204, data: null });

      const response = await deleteGroup(CONTEXT, 'g-1');

      expect(axios.delete).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/g-1/',
        { headers: AUTH_HEADERS }
      );
      expect(clearGroupFeedCache).toHaveBeenCalledWith('g-1');
      expect(clearGroupThumbnails).toHaveBeenCalledWith('g-1');
      expect(purgeAllPrivateCaches).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(204);
    });

    it('setActiveGroup PATCHes the user active_group endpoint with the bearer token', async () => {
      axios.patch.mockResolvedValue({
        status: 200,
        data: { active_group_id: 'g-2' },
      });

      const response = await setActiveGroup(CONTEXT, 'g-2');

      expect(axios.patch).toHaveBeenCalledWith(
        'https://backend.example/api/v1/users/user-1/active_group',
        { active_group: { group_id: 'g-2' } },
        { headers: AUTH_HEADERS }
      );
      expect(response.status).toBe(200);
    });
  });

  describe('groupMembershipApi', () => {
    it('listMembers GETs the memberships endpoint with the bearer token', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { data: [{ id: 'm-1' }] } });

      const response = await listMembers({ context: CONTEXT, groupId: 'g-3' });

      expect(axios.get).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/g-3/memberships',
        { headers: AUTH_HEADERS }
      );
      expect(response.data).toEqual([{ id: 'm-1' }]);
    });

    it('removeMember DELETEs the targeted membership without purging caches for another member', async () => {
      axios.delete.mockResolvedValue({ status: 204, data: null });

      await removeMember({
        context: CONTEXT,
        groupId: 'g-3',
        membershipId: 'm-9',
        removedUserId: 'user-9',
      });

      expect(axios.delete).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/g-3/memberships/m-9',
        { headers: AUTH_HEADERS }
      );
      expect(clearGroupFeedCache).not.toHaveBeenCalled();
      expect(clearGroupThumbnails).not.toHaveBeenCalled();
    });

    it('removeMember clears group-private caches when current user is removed', async () => {
      axios.delete.mockResolvedValue({ status: 204, data: null });

      await removeMember({
        context: CONTEXT,
        groupId: 'g-3',
        membershipId: 'm-9',
        removedUserId: 'user-1',
      });

      expect(clearGroupFeedCache).toHaveBeenCalledWith('g-3');
      expect(clearGroupThumbnails).toHaveBeenCalledWith('g-3');
    });

    it('leaveGroup POSTs the leave action and clears group-private caches on success', async () => {
      axios.post.mockResolvedValue({ status: 204, data: null });

      await leaveGroup({ context: CONTEXT, groupId: 'g-3' });

      expect(axios.post).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/g-3/memberships/leave',
        {},
        { headers: AUTH_HEADERS }
      );
      expect(clearGroupFeedCache).toHaveBeenCalledWith('g-3');
      expect(clearGroupThumbnails).toHaveBeenCalledWith('g-3');
    });

    it('transferOwnership POSTs the serialized target_user_id payload', async () => {
      axios.post.mockResolvedValue({ status: 200, data: null });

      await transferOwnership({ context: CONTEXT, groupId: 'g-3', targetUserId: 'user-9' });

      expect(axios.post).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/g-3/memberships/transfer',
        { transfer: { target_user_id: 'user-9' } },
        { headers: AUTH_HEADERS }
      );
    });
  });

  describe('groupJoinApi', () => {
    it('joinByCode POSTs the trimmed code in the join envelope', async () => {
      axios.post.mockResolvedValue({ status: 201, data: { data: { group_id: 'g-7' } } });

      const response = await joinByCode(CONTEXT, 'CODE7');

      expect(axios.post).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/join',
        { join: { code: 'CODE7' } },
        { headers: AUTH_HEADERS }
      );
      expect(response.data).toEqual({ group_id: 'g-7' });
    });
  });

  describe('groupCategoriesApi', () => {
    it('listGroupCategories GETs the categories index', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { data: [{ id: 'c-1' }] } });

      const response = await listGroupCategories(CONTEXT, 'g-3');

      expect(axios.get).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/g-3/categories/',
        { headers: AUTH_HEADERS }
      );
      expect(response.data).toEqual([{ id: 'c-1' }]);
    });

    it('createGroupCategory POSTs the serialized private_category payload', async () => {
      axios.post.mockResolvedValue({ status: 201, data: { data: { id: 'c-2' } } });

      await createGroupCategory(CONTEXT, 'g-3', { name: 'Cities', sortOrder: 4 });

      expect(axios.post).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/g-3/categories/',
        { private_category: { name: 'Cities', sort_order: 4 } },
        { headers: AUTH_HEADERS }
      );
    });

    it('deleteGroupCategory DELETEs the category endpoint', async () => {
      axios.delete.mockResolvedValue({ status: 204, data: null });

      await deleteGroupCategory(CONTEXT, 'g-3', 'c-2');

      expect(axios.delete).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/g-3/categories/c-2/',
        { headers: AUTH_HEADERS }
      );
    });
  });

  describe('groupLeaderboardApi', () => {
    it('fetchPrivateLeaderboard GETs the leaderboard endpoint with the bearer token', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: { data: [{ user_id: 'u-1' }], next_cursor: 'cursor-1', has_more: true },
      });

      const response = await fetchPrivateLeaderboard(CONTEXT, { groupId: 'g-3', limit: 20 });

      expect(axios.get).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/g-3/leaderboard/',
        { headers: AUTH_HEADERS, params: { limit: 20 } }
      );
      expect(response.status).toBe(200);
      expect(response.data.rows).toEqual([{ user_id: 'u-1' }]);
      expect(response.data.nextCursor).toBe('cursor-1');
      expect(response.data.hasMore).toBe(true);
    });

    it('fetchPrivateLeaderboardNext GETs with the after cursor param', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: { data: [], next_cursor: null, has_more: false },
      });

      await fetchPrivateLeaderboardNext(CONTEXT, { groupId: 'g-3', after: 'cursor-1', limit: 10 });

      expect(axios.get).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/g-3/leaderboard/',
        { headers: AUTH_HEADERS, params: { after: 'cursor-1', limit: 10 } }
      );
    });
  });

  describe('groupUploadApi', () => {
    it('preparePrivateUpload POSTs the presign body with mapped kind and bearer token', async () => {
      axios.post.mockResolvedValue({
        status: 200,
        data: {
          data: {
            provider: 's3',
            url: 'https://upload.example/',
            image_id: 'img-1',
            image_key: 'img-1',
          },
        },
      });

      const response = await preparePrivateUpload({
        context: CONTEXT,
        groupId: 'g-3',
        kind: 'home-background',
        fileExtension: 'png',
        contentType: 'image/png',
        contentLength: 1234,
        isHomeBackground: true,
      });

      expect(axios.post).toHaveBeenCalledWith(
        'https://backend.example/api/v1/private_groups/g-3/images/presign',
        {
          private_image: {
            kind: 'groupUi',
            file_extension: 'png',
            content_type: 'image/png',
            content_length: 1234,
            is_home_background: true,
          },
        },
        { headers: AUTH_HEADERS }
      );
      expect(response.status).toBe(200);
      expect(response.data.imageId).toBe('img-1');
      expect(response.data.url).toBe('https://upload.example/');
    });
  });
});
