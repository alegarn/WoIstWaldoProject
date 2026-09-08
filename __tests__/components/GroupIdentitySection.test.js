const mockButton = jest.fn(() => null);

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
}));

jest.mock('../../components/UI/ColorPalettePicker', () => {
  return function MockColorPalettePicker() {
    return null;
  };
});

jest.mock('../../components/Groups/Settings/SettingsSection', () => {
  const React = require('react');
  return function MockSettingsSection({ children }) {
    return React.createElement(React.Fragment, null, children);
  };
});

jest.mock('../../services/groups/groupApi', () => ({
  updateGroupSettings: jest.fn(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { Alert } from 'react-native';

import GroupIdentitySection from '../../components/Groups/Settings/GroupIdentitySection';
import { updateGroupSettings } from '../../services/groups/groupApi';

describe('GroupIdentitySection', () => {
  let alertSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  async function render(props = {}) {
    let renderer;
    await act(async () => {
      renderer = create(
        <GroupIdentitySection
          groupId="g-3"
          initialName="Mine"
          initialPrimaryColor="#6528F7"
          initialSecondaryColor="#FFCC00"
          {...props}
        />,
      );
      await Promise.resolve();
    });
    return renderer;
  }

  async function pressSave(renderer) {
    await act(async () => {
      renderer.root.findByProps({ testID: 'group-settings.button.save-colors' }).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('shows the store-linked upsell alert with a CTA that fires onUpsell when the save PATCH returns 403', async () => {
    updateGroupSettings.mockResolvedValue({ status: 403 });
    const onUpsell = jest.fn();
    const renderer = await render({ onUpsell });

    await pressSave(renderer);

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title, , buttons] = alertSpy.mock.calls[0];
    expect(title).toBe('Personalization is a Creator feature');

    const storeCta = buttons.find((button) => button.text === 'View plans');
    expect(storeCta).toBeTruthy();

    await act(async () => {
      storeCta.onPress();
    });
    expect(onUpsell).toHaveBeenCalledTimes(1);
    expect(buttons.some((button) => button.style === 'cancel')).toBe(true);
  });

  it('fires onUpsell from the upsell alert when the save PATCH rejects with a 403 error', async () => {
    updateGroupSettings.mockRejectedValue({ response: { status: 403 } });
    const onUpsell = jest.fn();
    const renderer = await render({ onUpsell });

    await pressSave(renderer);

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [, , buttons] = alertSpy.mock.calls[0];
    const storeCta = buttons.find((button) => button.text === 'View plans');
    expect(storeCta).toBeTruthy();

    await act(async () => {
      storeCta.onPress();
    });
    expect(onUpsell).toHaveBeenCalledTimes(1);
  });

  it('keeps the plain saved alert (no store CTA) on success', async () => {
    updateGroupSettings.mockResolvedValue({ status: 200 });
    const onRefresh = jest.fn();
    const onSaved = jest.fn();
    const renderer = await render({ onRefresh, onSaved });

    await pressSave(renderer);

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe('Saved');
  });
});
