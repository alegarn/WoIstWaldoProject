import React from 'react';
import { act } from 'react';
import { Keyboard, Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import ShowHideDescription from '../components/Picture/Descriptions/ShowHideDescription';

jest.mock('../components/UI/LanguageSelector', () => {
  return function MockLanguageSelector() {
    return null;
  };
});

jest.mock('../components/UI/CategoryChips', () => {
  return function MockCategoryChips() {
    return null;
  };
});

const DESCRIBE_LABEL = 'Describe the hidden point';
const LANGUAGE_LABEL = 'Language';

async function renderWizard(props = {}) {
  return render(
    <ShowHideDescription
      inputChangeHandler={jest.fn()}
      submitHandler={jest.fn()}
      onCancel={jest.fn()}
      language={null}
      onLanguageChange={jest.fn()}
      languageError={false}
      categories={[]}
      categoriesError={null}
      onRetryCategories={jest.fn()}
      selectedCategory={null}
      onCategorySelect={jest.fn()}
      windowWidth={320}
      windowHeight={500}
      {...props}
    />
  );
}

function getKeyboardAvoidElement() {
  return screen.getByTestId('set-instructions.keyboard-avoid');
}

function flatStyle(element) {
  const style = element.props.style;
  return Array.isArray(style) ? style.flat(Infinity) : [style];
}

function captureKeyboardListeners() {
  const listeners = {};
  const removes = [];
  const addListenerSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
    listeners[event] = callback;
    const remove = jest.fn();
    removes.push(remove);
    return { remove };
  });

  return { listeners, removes, addListenerSpy };
}

const KEYBOARD_SHOW_EVENT = {
  duration: 220,
  easing: 'keyboard',
  endCoordinates: { height: 296, screenY: 204, screenX: 0, width: 320 },
};

const LAYOUT_EVENT = {
  persist: jest.fn(),
  nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 500 } },
};

async function showKeyboardOver(wrapperElement, listeners, showEventName = 'keyboardWillShow') {
  await fireEvent(wrapperElement, 'layout', LAYOUT_EVENT);
  await act(async () => {
    listeners[showEventName](KEYBOARD_SHOW_EVENT);
  });
  return screen.getByTestId('set-instructions.keyboard-avoid');
}

describe('ShowHideDescription keyboard avoidance', () => {
  it('renders a keyboard-avoiding wrapper around the wizard content with the description input reachable', async () => {
    await renderWizard();

    expect(getKeyboardAvoidElement()).toBeTruthy();
    expect(screen.getByTestId('set-instructions.input.description')).toBeTruthy();
  });

  it('lifts wizard content above the keyboard for a landscape image (isPortrait false)', async () => {
    const { listeners, addListenerSpy } = captureKeyboardListeners();

    await renderWizard({ isPortrait: false });

    const wrapperElement = await showKeyboardOver(getKeyboardAvoidElement(), listeners);

    expect(flatStyle(wrapperElement)).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: 296 })])
    );

    addListenerSpy.mockRestore();
  });

  it('keeps wizard content untouched by the keyboard for a portrait image (isPortrait true)', async () => {
    const { listeners, addListenerSpy } = captureKeyboardListeners();

    await renderWizard({ isPortrait: true });

    const wrapperElement = await showKeyboardOver(getKeyboardAvoidElement(), listeners);

    expect(flatStyle(wrapperElement)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: 296 })])
    );

    addListenerSpy.mockRestore();
  });

  it('lifts wizard content above the keyboard on android for a landscape image (isPortrait false)', async () => {
    const { listeners, addListenerSpy } = captureKeyboardListeners();
    const originalOS = Platform.OS;
    Platform.OS = 'android';

    try {
      await renderWizard({ isPortrait: false });

      const wrapperElement = await showKeyboardOver(getKeyboardAvoidElement(), listeners, 'keyboardDidShow');

      expect(flatStyle(wrapperElement)).toEqual(
        expect.arrayContaining([expect.objectContaining({ paddingBottom: 296 })])
      );
    } finally {
      Platform.OS = originalOS;
      addListenerSpy.mockRestore();
    }
  });

  it('keeps wizard content untouched by the keyboard on android for a portrait image (isPortrait true)', async () => {
    const { listeners, addListenerSpy } = captureKeyboardListeners();
    const originalOS = Platform.OS;
    Platform.OS = 'android';

    try {
      await renderWizard({ isPortrait: true });

      const wrapperElement = await showKeyboardOver(getKeyboardAvoidElement(), listeners, 'keyboardDidShow');

      expect(flatStyle(wrapperElement)).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ paddingBottom: 296 })])
      );
    } finally {
      Platform.OS = originalOS;
      addListenerSpy.mockRestore();
    }
  });

  it('subscribes to android keyboardDid show/hide events while mounted on android', async () => {
    const { addListenerSpy } = captureKeyboardListeners();
    const originalOS = Platform.OS;
    Platform.OS = 'android';

    try {
      await renderWizard({ isPortrait: false });

      expect(addListenerSpy).toHaveBeenCalledWith('keyboardDidShow', expect.any(Function));
      expect(addListenerSpy).toHaveBeenCalledWith('keyboardDidHide', expect.any(Function));
      expect(addListenerSpy).not.toHaveBeenCalledWith('keyboardWillShow', expect.any(Function));
      expect(addListenerSpy).not.toHaveBeenCalledWith('keyboardWillHide', expect.any(Function));
    } finally {
      Platform.OS = originalOS;
      addListenerSpy.mockRestore();
    }
  });

  it('subscribes to keyboard show/hide while mounted in landscape and unsubscribes on unmount', async () => {
    const { listeners, removes, addListenerSpy } = captureKeyboardListeners();

    await renderWizard({ isPortrait: false });

    expect(addListenerSpy).toHaveBeenCalledWith('keyboardWillShow', expect.any(Function));
    expect(addListenerSpy).toHaveBeenCalledWith('keyboardWillHide', expect.any(Function));

    expect(() => {
      act(() => {
        listeners.keyboardWillShow(KEYBOARD_SHOW_EVENT);
      });
    }).not.toThrow();

    await screen.unmount();

    expect(removes.length).toBeGreaterThan(0);
    removes.forEach((remove) => {
      expect(remove).toHaveBeenCalledTimes(1);
    });

    addListenerSpy.mockRestore();
  });

  it('dismisses the keyboard and advances to the language step when Next is pressed on the describe step', async () => {
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});

    await renderWizard();

    await fireEvent.press(screen.getByTestId('set-instructions.button.next'));

    expect(dismissSpy).toHaveBeenCalled();
    expect(screen.getByText(LANGUAGE_LABEL)).toBeTruthy();

    dismissSpy.mockRestore();
  });

  it('dismisses the keyboard and returns to the describe step when Back is pressed on the language step', async () => {
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});

    await renderWizard();

    await fireEvent.press(screen.getByTestId('set-instructions.button.next'));
    const callsAfterNext = dismissSpy.mock.calls.length;

    await fireEvent.press(screen.getByTestId('set-instructions.button.back'));

    expect(dismissSpy.mock.calls.length).toBeGreaterThan(callsAfterNext);
    expect(screen.getByText(DESCRIBE_LABEL)).toBeTruthy();
    expect(screen.queryByTestId('set-instructions.button.back')).toBeNull();

    dismissSpy.mockRestore();
  });

  it('navigates describe, language, then category; next button absent on category, back button absent on describe', async () => {
    await renderWizard({ language: 'en' });

    expect(screen.queryByTestId('set-instructions.button.back')).toBeNull();

    await fireEvent.press(screen.getByTestId('set-instructions.button.next'));
    expect(screen.getByText(LANGUAGE_LABEL)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('set-instructions.button.next'));
    expect(screen.getByTestId('set-instructions.button.confirm-description')).toBeTruthy();
    expect(screen.queryByTestId('set-instructions.button.next')).toBeNull();
  });

  it('blocks Next on the language step without a language and shows the inline error', async () => {
    await renderWizard({ language: null });

    await fireEvent.press(screen.getByTestId('set-instructions.button.next'));
    expect(screen.getByTestId('set-instructions.language.error')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('set-instructions.button.next'));

    expect(screen.getByTestId('set-instructions.language.error')).toBeTruthy();
    expect(screen.queryByTestId('set-instructions.button.confirm-description')).toBeNull();
  });

  it('shows the language error when the languageError prop is true', async () => {
    await renderWizard({ language: null, languageError: true });

    await fireEvent.press(screen.getByTestId('set-instructions.button.next'));

    expect(screen.getByTestId('set-instructions.language.error')).toBeTruthy();
  });

  it('shows the confirm button only on the category step and calls submitHandler on press', async () => {
    const submitHandler = jest.fn();

    await renderWizard({ language: 'en', submitHandler });

    expect(screen.queryByTestId('set-instructions.button.confirm-description')).toBeNull();

    await fireEvent.press(screen.getByTestId('set-instructions.button.next'));
    await fireEvent.press(screen.getByTestId('set-instructions.button.next'));

    await fireEvent.press(screen.getByTestId('set-instructions.button.confirm-description'));

    expect(submitHandler).toHaveBeenCalledTimes(1);
  });

  it('shows the cancel button on every step and calls onCancel on press', async () => {
    const onCancel = jest.fn();

    await renderWizard({ language: 'en', onCancel });

    await fireEvent.press(screen.getByTestId('set-instructions.button.cancel-description'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('set-instructions.button.next'));
    await fireEvent.press(screen.getByTestId('set-instructions.button.cancel-description'));
    expect(onCancel).toHaveBeenCalledTimes(2);

    await fireEvent.press(screen.getByTestId('set-instructions.button.next'));
    await fireEvent.press(screen.getByTestId('set-instructions.button.cancel-description'));
    expect(onCancel).toHaveBeenCalledTimes(3);
  });
});

describe('ShowHideDescription overlay sizing', () => {
  it('sizes the overlay explicitly independent of parent bounds', async () => {
    await renderWizard();

    const overlayStyle = flatStyle(screen.getByTestId('set-instructions.overlay'));

    expect(overlayStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ position: 'absolute', width: 320, height: 500 }),
      ])
    );
  });

  it('lets the scroll view fill the keyboard-lifted area with flex 1', async () => {
    await renderWizard();

    const scrollStyle = flatStyle(screen.getByTestId('set-instructions.scroll'));

    expect(scrollStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ flex: 1 })])
    );
  });
});
