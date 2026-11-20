import React from 'react';
import { act, create } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';

import HomeCard from '../../components/UI/HomeCard';
import { PrivateGroupThemeProvider } from '../../store/privateGroupTheme-context';
import { GlobalStyle } from '../../constants/theme';
import { getPrivateGroupTheme } from '../../utils/privateGroupTheme';

describe('HomeCard', () => {
  function render(element) {
    let renderer;
    act(() => {
      renderer = create(element);
    });
    return renderer;
  }

  function findInnerContainer(renderer) {
    const textNode = renderer.root.findByType(Text);
    return textNode.parent;
  }

  it('falls back to GlobalStyle.color.primaryColor500 for the inner background when no provider is present', () => {
    const renderer = render(<HomeCard text="X" onPress={jest.fn()} />);

    const inner = findInnerContainer(renderer);
    expect(StyleSheet.flatten(inner.props.style).backgroundColor).toBe(GlobalStyle.color.primaryColor500);
  });

  it('uses the resolved group primaryColor for the inner background inside a PrivateGroupThemeProvider', () => {
    const expectedTheme = getPrivateGroupTheme({ primaryColor: '#198868' });
    const renderer = render(
      <PrivateGroupThemeProvider group={{ primary_color: '#198868', secondary_color: '#FFCC00' }}>
        <HomeCard text="X" onPress={jest.fn()} />
      </PrivateGroupThemeProvider>
    );

    const inner = findInnerContainer(renderer);
    expect(StyleSheet.flatten(inner.props.style).backgroundColor).toBe(expectedTheme.primaryColor);
  });

  it('does not apply the fallback background style when backgroundImage is provided', () => {
    const renderer = render(
      <PrivateGroupThemeProvider group={{ primary_color: '#198868', secondary_color: '#FFCC00' }}>
        <HomeCard
          text="X"
          onPress={jest.fn()}
          backgroundImage={{ uri: 'file:///tmp/waldo.png' }}
        />
      </PrivateGroupThemeProvider>
    );

    const inner = findInnerContainer(renderer);
    const backgroundColor = StyleSheet.flatten(inner.props.style).backgroundColor;
    expect(backgroundColor).not.toBe('#198868');
    expect(backgroundColor).not.toBe(GlobalStyle.color.primaryColor500);
  });
});
