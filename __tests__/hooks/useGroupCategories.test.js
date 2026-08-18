import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { useGroupCategories } from '../../hooks/useGroupCategories';
import { AuthContext } from '../../store/auth-context';

jest.mock('../../services/groups/groupCategoriesApi', () => ({
  createGroupCategory: jest.fn(),
  updateGroupCategory: jest.fn(),
  deleteGroupCategory: jest.fn(),
}));

jest.mock('../../services/groups/groupCategoriesStore', () => ({
  loadGroupCategoriesOptimistic: jest.fn(),
  refreshGroupCategories: jest.fn(),
  normalizePrivateCategory: jest.fn((category) => category),
}));

jest.mock('../../services/groups/groupCategoryThumbnails', () => ({
  deleteCategoryThumbnailFile: jest.fn(),
  resolveCategoryThumbnail: jest.fn(),
}));

jest.mock('../../services/groups/categoryThumbnailUpload', () => ({
  uploadCategoryThumbnail: jest.fn(),
}));

import {
  createGroupCategory,
  updateGroupCategory,
  deleteGroupCategory,
} from '../../services/groups/groupCategoriesApi';
import {
  loadGroupCategoriesOptimistic,
  refreshGroupCategories,
} from '../../services/groups/groupCategoriesStore';
import {
  deleteCategoryThumbnailFile,
  resolveCategoryThumbnail,
} from '../../services/groups/groupCategoryThumbnails';
import { uploadCategoryThumbnail } from '../../services/groups/categoryThumbnailUpload';

function makeWrapper() {
  return function Wrapper({ children }) {
    return (
      <AuthContext.Provider value={{ token: 'Bearer t', userId: 'u-1' }}>
        {children}
      </AuthContext.Provider>
    );
  };
}

function renderCategories({ groupId = 'g-1', onRefresh = jest.fn() } = {}) {
  return renderHook(({ groupId, onRefresh }) => useGroupCategories({ groupId, onRefresh }), {
    wrapper: makeWrapper(),
    initialProps: { groupId, onRefresh },
  });
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function optimisticFrom(cached, fresh) {
  return async ({ onCategories }) => {
    if (cached) onCategories(cached);
    if (fresh && fresh !== cached) onCategories(fresh);
  };
}

describe('useGroupCategories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    resolveCategoryThumbnail.mockResolvedValue(null);
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  it('loads categories, seeds drafts, and resolves thumbnails only for categories with an image id', async () => {
    resolveCategoryThumbnail.mockResolvedValue('file:///cat-1.webp');
    loadGroupCategoriesOptimistic.mockImplementation(optimisticFrom(null, [
      { id: 'cat-1', name: 'Nature', thumbnail_image_id: 'img-1' },
      { id: 'cat-2', name: 'City' },
    ]));

    const { result } = renderCategories();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.categories).toHaveLength(2);
    expect(result.current.drafts).toEqual({ 'cat-1': 'Nature', 'cat-2': 'City' });

    await settle();

    expect(result.current.thumbnailUris).toEqual({ 'cat-1': 'file:///cat-1.webp', 'cat-2': null });
    expect(resolveCategoryThumbnail).toHaveBeenCalledTimes(1);
    expect(resolveCategoryThumbnail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ groupId: 'g-1', category: expect.objectContaining({ id: 'cat-1' }) }),
    );
  });

  it('renders cached categories first, then replaces state when the fresh payload differs', async () => {
    const cached = [{ id: 'cat-1', name: 'Nature' }];
    const fresh = [
      { id: 'cat-1', name: 'Nature' },
      { id: 'cat-2', name: 'City' },
    ];
    loadGroupCategoriesOptimistic.mockImplementation(async ({ onCategories }) => {
      onCategories(cached);
      onCategories(fresh);
    });

    const { result } = renderCategories();

    await waitFor(() => expect(result.current.categories).toEqual(fresh));

    expect(result.current.categories).toEqual(fresh);
    expect(result.current.drafts).toEqual({ 'cat-1': 'Nature', 'cat-2': 'City' });
  });

  it('does not double-write state when optimistic payload equals fresh (store dedups)', async () => {
    const same = [{ id: 'cat-1', name: 'Nature', thumbnail_image_id: 'img-1' }];
    loadGroupCategoriesOptimistic.mockImplementation(async ({ onCategories }) => {
      onCategories(same);
    });

    const { result } = renderCategories();

    await waitFor(() => expect(result.current.categories).toEqual(same));

    expect(result.current.drafts).toEqual({ 'cat-1': 'Nature' });
    expect(resolveCategoryThumbnail).toHaveBeenCalledTimes(1);
  });

  it('clears initial loading once the first categories arrive, avoiding flicker on later reloads', async () => {
    loadGroupCategoriesOptimistic.mockImplementation(optimisticFrom(null, [
      { id: 'cat-1', name: 'Nature' },
    ]));

    const { result } = renderCategories();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loading).toBe(false);

    const loadingDuringReload = result.current.loading;
    await act(async () => {
      await result.current.reload();
    });
    expect(loadingDuringReload).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('after a successful add, write-through refreshes via the store and updates state from its data', async () => {
    const initial = [{ id: 'cat-1', name: 'Nature' }];
    const afterAdd = [
      { id: 'cat-1', name: 'Nature' },
      { id: 'cat-2', name: 'Animals' },
    ];
    loadGroupCategoriesOptimistic.mockImplementation(optimisticFrom(null, initial));
    createGroupCategory.mockResolvedValue({ status: 201, data: {} });
    refreshGroupCategories.mockResolvedValue({ data: afterAdd });

    const { result } = renderCategories();
    await waitFor(() => expect(result.current.categories).toEqual(initial));

    act(() => result.current.setNewCategoryName('Animals'));

    await act(async () => {
      await result.current.add();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createGroupCategory).toHaveBeenCalledWith(
      expect.anything(),
      'g-1',
      { name: 'Animals' },
    );
    expect(refreshGroupCategories).toHaveBeenCalledWith({ context: expect.anything(), groupId: 'g-1' });
    expect(result.current.categories).toEqual(afterAdd);
    expect(result.current.drafts).toEqual({ 'cat-1': 'Nature', 'cat-2': 'Animals' });
    expect(result.current.newCategoryName).toBe('');
  });

  it('alerts and leaves state intact when create fails', async () => {
    const initial = [{ id: 'cat-1', name: 'Nature' }];
    loadGroupCategoriesOptimistic.mockImplementation(optimisticFrom(null, initial));
    createGroupCategory.mockResolvedValue({ status: 500 });

    const { result } = renderCategories();
    await waitFor(() => expect(result.current.categories).toEqual(initial));

    act(() => result.current.setNewCategoryName('Animals'));

    await act(async () => {
      await result.current.add();
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(result.current.categories).toEqual(initial);
    expect(refreshGroupCategories).not.toHaveBeenCalled();
  });

  it('skips the PATCH when the draft equals the saved name and updates when dirty', async () => {
    const initial = [{ id: 'cat-1', name: 'Nature' }];
    loadGroupCategoriesOptimistic.mockImplementation(optimisticFrom(null, initial));

    const { result } = renderCategories();
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Clean draft -> no-op.
    await act(async () => {
      await result.current.save({ id: 'cat-1', name: 'Nature' });
    });
    expect(updateGroupCategory).not.toHaveBeenCalled();

    // Dirty draft -> PATCH + write-through.
    updateGroupCategory.mockResolvedValue({ status: 200, data: {} });
    refreshGroupCategories.mockResolvedValue({ data: [{ id: 'cat-1', name: 'Nature 2' }] });
    act(() => result.current.setDraft('cat-1', 'Nature 2'));

    await act(async () => {
      await result.current.save({ id: 'cat-1', name: 'Nature' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(updateGroupCategory).toHaveBeenCalledWith(
      expect.anything(),
      'g-1',
      'cat-1',
      { name: 'Nature 2' },
    );
    expect(refreshGroupCategories).toHaveBeenCalledWith({ context: expect.anything(), groupId: 'g-1' });
  });

  it('deletes the category (after confirming the alert) and write-through refreshes', async () => {
    const initial = [{ id: 'cat-1', name: 'Nature' }];
    loadGroupCategoriesOptimistic.mockImplementation(optimisticFrom(null, initial));
    deleteGroupCategory.mockResolvedValue({ status: 204 });
    refreshGroupCategories.mockResolvedValue({ data: [] });

    // Auto-confirm the destructive alert button.
    Alert.alert.mockImplementation((_title, _msg, buttons) => {
      const destructive = buttons.find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    });

    const { result } = renderCategories();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.remove({ id: 'cat-1', name: 'Nature' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(deleteGroupCategory).toHaveBeenCalledWith(expect.anything(), 'g-1', 'cat-1');
    expect(refreshGroupCategories).toHaveBeenCalledWith({ context: expect.anything(), groupId: 'g-1' });
    expect(result.current.categories).toEqual([]);
  });

  it('swaps the thumbnail, purges the old cache file first, then updates + refreshes', async () => {
    const category = { id: 'cat-1', name: 'Nature', thumbnail_image_id: 'old-thumb' };
    loadGroupCategoriesOptimistic.mockImplementation(optimisticFrom(null, [category]));
    uploadCategoryThumbnail.mockResolvedValue({ imageId: 'img-new' });
    updateGroupCategory.mockResolvedValue({ status: 200, data: {} });
    refreshGroupCategories.mockResolvedValue({
      data: [{ ...category, thumbnail_image_id: 'img-new' }],
    });

    const onRefresh = jest.fn();
    const { result } = renderCategories({ onRefresh });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.swapThumbnail(category);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(uploadCategoryThumbnail).toHaveBeenCalledWith({ context: expect.anything(), groupId: 'g-1' });
    expect(deleteCategoryThumbnailFile).toHaveBeenCalledWith('g-1', 'old-thumb');
    expect(deleteCategoryThumbnailFile.mock.invocationCallOrder[0]).toBeLessThan(
      updateGroupCategory.mock.invocationCallOrder[0],
    );
    expect(updateGroupCategory).toHaveBeenCalledWith(expect.anything(), 'g-1', 'cat-1', {
      thumbnailImageId: 'img-new',
    });
    expect(refreshGroupCategories).toHaveBeenCalledWith({ context: expect.anything(), groupId: 'g-1' });
    expect(onRefresh).toHaveBeenCalled();
    expect(result.current.isSwappingThumbnail).toBe(false);
  });

  it('does nothing when swapThumbnail receives a category without an id', async () => {
    loadGroupCategoriesOptimistic.mockImplementation(optimisticFrom(null, []));

    const { result } = renderCategories();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.swapThumbnail({ name: 'nope' });
    });

    expect(uploadCategoryThumbnail).not.toHaveBeenCalled();
    expect(result.current.isSwappingThumbnail).toBe(false);
  });
});
