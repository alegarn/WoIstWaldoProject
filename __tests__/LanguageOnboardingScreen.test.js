const mockButton = jest.fn(() => null);
const mockLanguageSelector = jest.fn(() => null);

jest.mock('../components/UI/Button', () => {
  return function MockButton(props) {
    mockButton(props);
    return null;
  };
});

jest.mock('../components/UI/LanguageSelector', () => {
  return function MockLanguageSelector(props) {
    mockLanguageSelector(props);
    return null;
  };
});

jest.mock('../utils/languageDefaults', () => ({
  resolveDefaultLanguage: jest.fn(),
}));

jest.mock('../utils/storageDatum', () => ({
  savePreferredLanguage: jest.fn(),
  setOnboardingCompleted: jest.fn(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import LanguageOnboardingScreen from '../screens/LanguageOnboardingScreen';
import { resolveDefaultLanguage } from '../utils/languageDefaults';
import { savePreferredLanguage, setOnboardingCompleted } from '../utils/storageDatum';

describe('LanguageOnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveDefaultLanguage.mockReturnValue('fr');
    savePreferredLanguage.mockResolvedValue(undefined);
    setOnboardingCompleted.mockResolvedValue(undefined);
  });

  async function flushEffects() {
    await Promise.resolve();
    await Promise.resolve();
  }

  async function renderScreen(overrides = {}) {
    let renderer;

    await act(async () => {
      renderer = create(<LanguageOnboardingScreen onDone={jest.fn()} {...overrides} />);
      await flushEffects();
    });

    return renderer;
  }

  it('preselects the heuristic language and does not auto-commit on mount', async () => {
    await renderScreen();

    const selectorProps = mockLanguageSelector.mock.calls[mockLanguageSelector.mock.calls.length - 1][0];
    const buttonProps = mockButton.mock.calls[mockButton.mock.calls.length - 1][0];

    expect(selectorProps.value).toBe('fr');
    expect(selectorProps.accessibilityLabel).toBe('Select preferred language for new enigmas');
    expect(selectorProps.accessibilityHint).toBe('Opens the language list before you finish onboarding');
    expect(buttonProps.accessibilityLabel).toBe('Confirm preferred language and finish onboarding');
    expect(savePreferredLanguage).not.toHaveBeenCalled();
    expect(setOnboardingCompleted).not.toHaveBeenCalled();
  });

  it('persists the selected language and completes onboarding only after confirm', async () => {
    const onDone = jest.fn();

    await renderScreen({ onDone });

    await act(async () => {
      mockLanguageSelector.mock.calls[mockLanguageSelector.mock.calls.length - 1][0].onChange('de');
    });

    const buttonProps = mockButton.mock.calls[mockButton.mock.calls.length - 1][0];

    await act(async () => {
      await buttonProps.onPress();
      await flushEffects();
    });

    expect(savePreferredLanguage).toHaveBeenCalledWith('de');
    expect(setOnboardingCompleted).toHaveBeenCalledWith(true);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});