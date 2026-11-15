// GroupsIconButton RED suite (private-groups-intro-plan Task 2a).
//
// Pins the header groups-icon contract: an IconButton probe (people glyph,
// testID `home.header.groups`, localized `groupsIntro.iconLabel` label) whose
// internal onPress calls `groupsIntroUiStore.signalIconTap()` BEFORE invoking
// the wired `onPress`. The button wraps itself in IconPulseRing and mirrors
// the ui-store ring phase: it subscribes once on mount and unsubscribes
// exactly once in the effect-return cleanup on unmount.
//
// Boundaries mocked with explicit factories: IconButton and IconPulseRing as
// prop-revealing probes (both real components are covered by their own
// suites), the groups-intro ui store as a jest.fn module. i18n runs real at
// the suite-wide 'en' locale (jest.setup.js).

let mockUnsubscribe;

jest.mock('../../components/UI/IconButton', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: function MockIconButton(props) {
      return React.createElement(View, { ...props, testID: props.testID });
    },
  };
});

jest.mock('../../components/UI/IconPulseRing', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: function MockIconPulseRing({ phase, onLoopEnd, children }) {
      return React.createElement(
        View,
        { testID: 'groups-intro.ring.probe', phase, onLoopEnd },
        children
      );
    },
  };
});

jest.mock('../../utils/groupsIntro/groupsIntroUiStore', () => ({
  subscribe: jest.fn(() => mockUnsubscribe),
  publish: jest.fn(),
  getUiState: jest.fn(() => ({ ringPhase: 'off', tapCount: 0 })),
  signalIconTap: jest.fn(),
  resetGroupsIntroUiStoreForTests: jest.fn(),
}));

import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import GroupsIconButton from '../../components/UI/GroupsIconButton';
import { signalIconTap, subscribe } from '../../utils/groupsIntro/groupsIntroUiStore';
import i18n from '../../i18n';

const ICON_LABEL = i18n.t('groupsIntro.iconLabel');

// The header tint the gear/logout icons receive in App.tsx (screenOptions
// `headerTintColor: "white"` → `headerRight: ({ tintColor })` → color={tintColor}).
const HEADER_TINT = 'white';
const HEADER_MARGIN = 20;

function renderButton(props = {}) {
  let renderer;
  act(() => {
    renderer = create(<GroupsIconButton onPress={props.onPress} {...props} />);
  });
  return renderer;
}

function iconProbe(renderer) {
  return renderer.root.findByProps({ testID: 'home.header.groups' });
}

function ringProbe(renderer) {
  return renderer.root.findByProps({ testID: 'groups-intro.ring.probe' });
}

function flattenedStyle(node) {
  return StyleSheet.flatten(node.props.style ?? []) ?? {};
}

describe('GroupsIconButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnsubscribe = jest.fn();
  });

  it('renders the people glyph as home.header.groups with the localized accessibility label', () => {
    const renderer = renderButton({ onPress: jest.fn() });

    const button = iconProbe(renderer);
    expect(button.props.icon).toBe('people');
    expect(button.props.accessibilityLabel).toBe(ICON_LABEL);
  });

  it('calls signalIconTap before the wired onPress on tap', () => {
    const onPress = jest.fn();
    const renderer = renderButton({ onPress });

    const button = iconProbe(renderer);
    act(() => {
      button.props.onPress();
    });

    expect(signalIconTap).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(signalIconTap.mock.invocationCallOrder[0]).toBeLessThan(onPress.mock.invocationCallOrder[0]);
  });

  it('subscribes to the groups intro ui store and mirrors ring phase patches', () => {
    const renderer = renderButton({ onPress: jest.fn() });

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(typeof subscribe.mock.calls[0][0]).toBe('function');
    expect(ringProbe(renderer).props.phase).toBe('off');

    const listener = subscribe.mock.calls[0][0];
    act(() => {
      listener({ ringPhase: 'active', tapCount: 1 });
    });

    expect(ringProbe(renderer).props.phase).toBe('active');
  });

  it('hands the ring an onLoopEnd callback and unsubscribes exactly once on unmount', () => {
    const renderer = renderButton({ onPress: jest.fn() });

    expect(typeof ringProbe(renderer).props.onLoopEnd).toBe('function');

    act(() => {
      renderer.unmount();
    });

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('passes the header tint color through to the IconButton glyph', () => {
    const renderer = renderButton({ onPress: jest.fn(), color: HEADER_TINT });

    expect(iconProbe(renderer).props.color).toBe(HEADER_TINT);
  });

  it('carries the 20px header margin on an outer wrapper View, never on the IconButton, in every phase', () => {
    const renderer = renderButton({ onPress: jest.fn() });
    const listener = subscribe.mock.calls[0][0];

    for (const phase of ['off', 'active', 'settle']) {
      act(() => {
        listener({ ringPhase: phase, tapCount: 0 });
      });

      const button = iconProbe(renderer);
      expect(flattenedStyle(button).marginRight).toBeUndefined();

      // Nearest styled ancestor must carry the header margin (composite/host
      // node pairs collapse here because the walk stops at the first match).
      let wrapper = null;
      let node = button.parent;
      while (node && wrapper === null) {
        if (flattenedStyle(node).marginRight === HEADER_MARGIN) {
          wrapper = node;
        }
        node = node.parent;
      }
      expect(wrapper).not.toBeNull();
    }
  });
});
