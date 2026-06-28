jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
}));

jest.mock('../utils/auth', () => ({
  getBackendHeaders: jest.fn(),
  setHeaders: jest.fn(),
}));

jest.mock('../utils/e2eMode', () => ({
  isE2EMode: jest.fn(),
  buildE2EImageRating: jest.fn(),
  buildE2EImageTags: jest.fn(),
}));

import axios from 'axios';

import { getBackendHeaders, setHeaders } from '../utils/auth';
import { buildE2EImageRating, buildE2EImageTags, isE2EMode } from '../utils/e2eMode';
import {
  addImageTag,
  deleteImageTag,
  getImageRating,
  getImageTags,
  submitRating,
} from '../utils/ratingRequests';

const E2E_RATING_VALUES = {
  global_rating: 4,
  quality_rating: 4,
  enigma_rating: 3,
  fun_rating: 5,
  difficulty_rating: 2,
};

const E2E_RATING = {
  ...E2E_RATING_VALUES,
  id: 'e2e-image-rating-id',
  image_id: 'e2e-image-id',
  user_id: 'e2e-rater-id',
};

const E2E_TAGS = [
  { id: 'e2e-image-tag-1', name: 'scenic', user_id: 'e2e-tagger-id', username: 'e2e_tagger' },
];

describe('ratingRequests utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isE2EMode.mockReturnValue(false);
    buildE2EImageRating.mockReturnValue({ ...E2E_RATING_VALUES });
    buildE2EImageTags.mockReturnValue(E2E_TAGS.map((tag) => ({ ...tag })));
    process.env.EXPO_PUBLIC_APP_BACKEND_URL = 'https://backend.example/';
    getBackendHeaders.mockResolvedValue({
      token: 'Bearer token',
      userId: '42',
    });
    setHeaders.mockReturnValue({ Authorization: 'Bearer token' });
  });

  describe('submitRating', () => {
    it('posts the rating payload with snake_case keys to the singular image_rating route', async () => {
      axios.post.mockResolvedValue({ status: 201, data: { data: E2E_RATING } });

      const response = await submitRating({
        pictureId: 'image-1',
        context: { token: 'Bearer token' },
        payload: {
          global_rating: 5,
          quality_rating: 4,
          enigma_rating: 3,
          fun_rating: 2,
          difficulty_rating: 1,
        },
      });

      expect(axios.post).toHaveBeenCalledWith(
        'https://backend.example/api/v1/users/42/images/image-1/image_rating',
        {
          image_rating: {
            global_rating: 5,
            quality_rating: 4,
            enigma_rating: 3,
            fun_rating: 2,
            difficulty_rating: 1,
          },
        },
        { headers: { Authorization: 'Bearer token' } }
      );
      expect(getBackendHeaders).toHaveBeenCalledWith({ token: 'Bearer token' });
      expect(response).toEqual({ data: E2E_RATING });
    });

    it('omits sub-ratings when payload only carries global_rating', async () => {
      axios.post.mockResolvedValue({ status: 201, data: { data: { id: 'r1', global_rating: 5 } } });

      await submitRating({
        pictureId: 'image-1',
        context: { token: 'Bearer token' },
        payload: { global_rating: 5 },
      });

      expect(axios.post).toHaveBeenCalledWith(
        'https://backend.example/api/v1/users/42/images/image-1/image_rating',
        { image_rating: { global_rating: 5 } },
        { headers: { Authorization: 'Bearer token' } }
      );
    });

    it('returns a seeded rating fixture in e2e mode without calling axios', async () => {
      isE2EMode.mockReturnValue(true);

      const response = await submitRating({
        pictureId: 'image-1',
        context: { token: 'Bearer token' },
        payload: { global_rating: 5 },
      });

      expect(response).toEqual({ data: E2E_RATING });
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('normalizes a network failure into isError + message without throwing', async () => {
      axios.post.mockRejectedValue({ message: 'Network Error' });

      const response = await submitRating({
        pictureId: 'image-1',
        context: { token: 'Bearer token' },
        payload: { global_rating: 5 },
      });

      expect(response).toEqual({ isError: true, message: 'Network Error' });
    });
  });

  describe('getImageRating', () => {
    it('gets the singular image_rating route for the current user', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { data: E2E_RATING } });

      const response = await getImageRating({
        pictureId: 'image-1',
        context: { token: 'Bearer token' },
      });

      expect(axios.get).toHaveBeenCalledWith(
        'https://backend.example/api/v1/users/42/images/image-1/image_rating',
        { headers: { Authorization: 'Bearer token' } }
      );
      expect(response).toEqual({ data: E2E_RATING });
    });

    it('returns a seeded rating fixture in e2e mode without calling axios', async () => {
      isE2EMode.mockReturnValue(true);

      const response = await getImageRating({
        pictureId: 'image-1',
        context: { token: 'Bearer token' },
      });

      expect(response).toEqual({ data: E2E_RATING });
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('getImageTags', () => {
    it('gets the image_tags collection route', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { data: E2E_TAGS } });

      const response = await getImageTags({
        pictureId: 'image-1',
        context: { token: 'Bearer token' },
      });

      expect(axios.get).toHaveBeenCalledWith(
        'https://backend.example/api/v1/users/42/images/image-1/image_tags',
        { headers: { Authorization: 'Bearer token' } }
      );
      expect(response).toEqual({ data: E2E_TAGS });
    });

    it('returns a seeded tag list in e2e mode without calling axios', async () => {
      isE2EMode.mockReturnValue(true);

      const response = await getImageTags({
        pictureId: 'image-1',
        context: { token: 'Bearer token' },
      });

      expect(response).toEqual({ data: E2E_TAGS });
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('maps a tag load failure into isError + message', async () => {
      axios.get.mockRejectedValue({ message: 'timeout' });

      const response = await getImageTags({
        pictureId: 'image-1',
        context: { token: 'Bearer token' },
      });

      expect(response).toEqual({ isError: true, message: 'timeout' });
    });
  });

  describe('addImageTag', () => {
    it('posts the tag wrapper object to the image_tags collection route', async () => {
      const created = { id: 'tag-1', name: 'hard', user_id: '42', username: 'waldo' };
      axios.post.mockResolvedValue({ status: 201, data: { data: created } });

      const response = await addImageTag({
        pictureId: 'image-1',
        context: { token: 'Bearer token' },
        name: 'Hard',
      });

      expect(axios.post).toHaveBeenCalledWith(
        'https://backend.example/api/v1/users/42/images/image-1/image_tags',
        { tag: { name: 'Hard' } },
        { headers: { Authorization: 'Bearer token' } }
      );
      expect(response).toEqual({ data: created });
    });

    it('returns a downcased inline tag fixture in e2e mode without calling axios', async () => {
      isE2EMode.mockReturnValue(true);

      const response = await addImageTag({
        pictureId: 'image-1',
        context: { token: 'Bearer token' },
        name: 'Hard',
      });

      expect(response).toEqual({
        data: {
          id: 'e2e-image-tag-new',
          name: 'hard',
          user_id: 'e2e-tagger-id',
          username: 'e2e_tagger',
        },
      });
      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe('deleteImageTag', () => {
    it('deletes by id at the image_tags member route', async () => {
      axios.delete.mockResolvedValue({ status: 204, data: '' });

      const response = await deleteImageTag({
        pictureId: 'image-1',
        context: { token: 'Bearer token' },
        id: 'tag-9',
      });

      expect(axios.delete).toHaveBeenCalledWith(
        'https://backend.example/api/v1/users/42/images/image-1/image_tags/tag-9',
        { headers: { Authorization: 'Bearer token' } }
      );
      expect(response).toEqual({ data: '' });
    });

    it('returns a minimal id-bearing fixture in e2e mode without calling axios', async () => {
      isE2EMode.mockReturnValue(true);

      const response = await deleteImageTag({
        pictureId: 'image-1',
        context: { token: 'Bearer token' },
        id: 'tag-9',
      });

      expect(response).toEqual({ data: { id: 'tag-9' } });
      expect(axios.delete).not.toHaveBeenCalled();
    });

    it('maps a delete failure into isError + message', async () => {
      axios.delete.mockRejectedValue({ message: 'forbidden' });

      const response = await deleteImageTag({
        pictureId: 'image-1',
        context: { token: 'Bearer token' },
        id: 'tag-9',
      });

      expect(response).toEqual({ isError: true, message: 'forbidden' });
    });
  });
});
