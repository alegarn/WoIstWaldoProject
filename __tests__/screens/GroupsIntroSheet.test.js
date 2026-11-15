// GroupsIntroSheet RED suite (private-groups-intro-plan Task 4a).
//
// Pins the A-modal contract: never mounted when visible=false, absolute
// bottom-anchored full-bleed wrapper (plain parent, NO RN Modal — asserted
// by source), pointerEvents="box-none" wrapper with a scrim limited to the
// lower sheet region (parent pressables above stay pressable while visible),
// safe-area bottom padding, backdrop/back/later = onLater, onOpen CTA, and
// unlock-free copy. Suite-level RED on module resolution until
// components/UI/GroupsIntroSheet.tsx lands in 4b.

import { readFileSync } from 'fs';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { BackHandler, Pressable, Text, View } from 'react-native';

import GroupsIntroSheet from '../../components/UI/GroupsIntroSheet';
import i18n from '../../i18n';

const mockUseSafeAreaInsets = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockUseSafeAreaInsets(),
}));

const COPY = {
  title: i18n.t('groupsIntro.title'),
  body: i18n.t('groupsIntro.body'),
  iconPointer: i18n.t('groupsIntro.iconPointer'),
  ctaOpen: i18n.t('groupsIntro.ctaOpen'),
  ctaLater: i18n.t('groupsIntro.ctaLater'),
};

function flattenStyle(style) {
  if (Array.isArray(style)) {
    return style.reduce((merged, entry) => ({ ...merged, ...flattenStyle(entry) }), {});
  }
  return style || {};
}

async function renderSheet({ visible = true, onOpen = jest.fn(), onLater = jest.fn() } = {}) {
  let renderer;
  await act(async () => {
    renderer = create(<GroupsIntroSheet visible={visible} onOpen={onOpen} onLater={onLater} />);
  });
  return { renderer, onOpen, onLater };
}

function sheetNode(renderer) {
  return renderer.root.findByProps({ testID: 'groups-intro.sheet' });
}

function hasText(renderer, text) {
  return renderer.root.findAll((node) => node.props?.children === text).length > 0;
}

describe('GroupsIntroSheet', () => {
  beforeEach(() => {
    mockUseSafeAreaInsets.mockReturnValue({ top: 0, bottom: 34, left: 0, right: 0 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mockUseSafeAreaInsets.mockReturnValue({ top: 0, bottom: 34, left: 0, right: 0 });
  });

  it('renders nothing at all when visible is false', async () => {
    const { renderer } = await renderSheet({ visible: false });

    expect(renderer.toJSON()).toBeNull();
    expect(renderer.root.findAllByProps({ testID: 'groups-intro.sheet' })).toHaveLength(0);
  });

  it('renders an absolute bottom-anchored full-bleed wrapper inside a plain parent without a Modal', async () => {
    let renderer;
    await act(async () => {
      renderer = create(
        <View style={{ width: 320, height: 640 }}>
          <GroupsIntroSheet visible onOpen={jest.fn()} onLater={jest.fn()} />
        </View>
      );
    });

    const sheet = sheetNode(renderer);
    const style = flattenStyle(sheet.props.style);
    expect(style.position).toBe('absolute');
    expect(style.top).toBe(0);
    expect(style.bottom).toBe(-10);
    expect(style.left).toBe(-10);
    expect(style.right).toBe(-10);
    expect(sheet.props.pointerEvents).toBe('box-none');

    const source = readFileSync(require.resolve('../../components/UI/GroupsIntroSheet'), 'utf8');
    expect(source).not.toMatch(/import\s[^;]*\bModal\b/);
  });

  it('keeps a parent pressable above the sheet pressable while the scrim only covers the lower sheet region', async () => {
    const parentOnPress = jest.fn();
    let renderer;
    await act(async () => {
      renderer = create(
        <View style={{ width: 320, height: 640 }}>
          <Pressable
            testID="sheet-test.parent-card"
            onPress={parentOnPress}
            style={{ position: 'absolute', top: 0, left: 0, width: 320, height: 120 }}
          >
            <Text>above the sheet</Text>
          </Pressable>
          <GroupsIntroSheet visible onOpen={jest.fn()} onLater={jest.fn()} />
        </View>
      );
    });

    const sheet = sheetNode(renderer);
    expect(sheet.props.pointerEvents).toBe('box-none');

    const scrim = renderer.root.findByProps({ testID: 'groups-intro.scrim' });
    const scrimStyle = flattenStyle(scrim.props.style);
    expect(scrimStyle.position).toBe('absolute');
    expect(scrimStyle.bottom).toBe(-10);
    expect(scrimStyle.top).not.toBe(0);

    const parentCard = renderer.root.findByProps({ testID: 'sheet-test.parent-card' });
    await act(async () => {
      parentCard.props.onPress();
    });

    expect(parentOnPress).toHaveBeenCalledTimes(1);
  });

  it('pads the sheet bottom with the safe-area inset', async () => {
    const { renderer } = await renderSheet();

    const paddedNodes = renderer.root.findAll(
      (node) => flattenStyle(node.props?.style)?.paddingBottom === 34
    );
    expect(paddedNodes.length).toBeGreaterThan(0);
  });

  it('invokes onLater when the scrim is pressed', async () => {
    const { renderer, onLater } = await renderSheet();

    const scrim = renderer.root.findByProps({ testID: 'groups-intro.scrim' });
    await act(async () => {
      scrim.props.onPress();
    });

    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it('invokes onLater on Android hardware back', async () => {
    const addSpy = jest.spyOn(BackHandler, 'addEventListener');
    const { renderer, onLater } = await renderSheet();

    expect(addSpy).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
    const handler = addSpy.mock.calls[addSpy.mock.calls.length - 1][1];

    await act(async () => {
      handler();
    });

    expect(onLater).toHaveBeenCalledTimes(1);
    await act(async () => {
      renderer.unmount();
    });
  });

  it('removes the BackHandler subscription on unmount', async () => {
    const removeSpy = jest.fn();
    const addSpy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove: removeSpy });

    const { renderer } = await renderSheet();
    expect(removeSpy).not.toHaveBeenCalled();

    await act(async () => {
      renderer.unmount();
    });

    expect(removeSpy).toHaveBeenCalledTimes(1);
    addSpy.mockRestore();
  });

  it('shows the pointer copy and both CTAs with no unlock wording, wiring onOpen and onLater', async () => {
    const { renderer, onOpen, onLater } = await renderSheet();

    expect(hasText(renderer, COPY.title)).toBe(true);
    expect(hasText(renderer, COPY.body)).toBe(true);
    expect(hasText(renderer, COPY.iconPointer)).toBe(true);
    expect(hasText(renderer, COPY.ctaOpen)).toBe(true);
    expect(hasText(renderer, COPY.ctaLater)).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).not.toMatch(/unlock/i);

    await act(async () => {
      renderer.root.findByProps({ testID: 'groups-intro.cta-open' }).props.onPress();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.root.findByProps({ testID: 'groups-intro.cta-later' }).props.onPress();
    });
    expect(onLater).toHaveBeenCalledTimes(1);
  });
});
