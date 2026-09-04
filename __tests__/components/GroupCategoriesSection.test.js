const mockUseGroupCategories = jest.fn();

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
}));

jest.mock('../../hooks/useGroupCategories', () => ({
  useGroupCategories: () => mockUseGroupCategories(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import GroupCategoriesSection from '../../components/Groups/Settings/GroupCategoriesSection';

function hookState(overrides = {}) {
  return {
    categories: [{ id: 'cat-1', name: 'Cats' }],
    drafts: {},
    setDraft: jest.fn(),
    thumbnailUris: {},
    loading: false,
    error: null,
    newCategoryName: '',
    setNewCategoryName: jest.fn(),
    isSwappingThumbnail: false,
    add: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    swapThumbnail: jest.fn(),
    reload: jest.fn(),
    ...overrides,
  };
}

describe('GroupCategoriesSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGroupCategories.mockReturnValue(hookState());
  });

  function render(props = {}) {
    let renderer;
    act(() => {
      renderer = create(
        <GroupCategoriesSection groupId="g-3" onUpsell={jest.fn()} {...props} />
      );
    });
    return renderer;
  }

  it('shows the locked personalization row (no composer) for a free owner', () => {
    const renderer = render({ canPersonalize: false });

    expect(renderer.root.findByProps({ testID: 'group-settings.category.locked' })).toBeTruthy();
    expect(() =>
      renderer.root.findByProps({ testID: 'group-settings.category.add-composer' })
    ).toThrow();
  });

  it('renders the category list read-only (no rename/delete controls) for a free owner', () => {
    const renderer = render({ canPersonalize: false });

    expect(renderer.root.findByProps({ testID: 'group-settings.category.row.cat-1' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'group-settings.category.row.cat-1.name' }).props.children).toBe('Cats');
    expect(() =>
      renderer.root.findByProps({ testID: 'group-settings.category.row.cat-1.delete' })
    ).toThrow();
    expect(() =>
      renderer.root.findByProps({ testID: 'group-settings.category.row.cat-1.save' })
    ).toThrow();
    expect(() =>
      renderer.root.findByProps({ testID: 'group-settings.uploader.category-thumbnail' })
    ).toThrow();
  });

  it('routes the locked row tap to the personalize-group upsell', () => {
    const onUpsell = jest.fn();
    const renderer = render({ canPersonalize: false, onUpsell });

    act(() => {
      renderer.root.findByProps({ testID: 'group-settings.category.locked' }).props.onPress();
    });

    expect(onUpsell).toHaveBeenCalledTimes(1);
  });

  it('shows no locked row and renders the add composer for a tier-2 owner', () => {
    const renderer = render({ canPersonalize: true });

    expect(() =>
      renderer.root.findByProps({ testID: 'group-settings.category.locked' })
    ).toThrow();
    expect(renderer.root.findByProps({ testID: 'group-settings.category.add-composer' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'group-settings.category.row.cat-1.save' })).toBeTruthy();
  });
});
