import React from 'react';
import { act, create } from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';

import Button from '../../components/UI/Button';
import BigButton from '../../components/UI/BigButton';
import TableButton from '../../components/UI/TableButton';
import { PrivateGroupThemeProvider } from '../../store/privateGroupTheme-context';
import { GlobalStyle } from '../../constants/theme';
import { getPrivateGroupTheme } from '../../utils/privateGroupTheme';

const OWNER_GROUP = { primary_color: '#198868', secondary_color: '#FFCC00' };

describe('button private group theme integration', () => {
  function render(element) {
    let renderer;
    act(() => {
      renderer = create(element);
    });
    return renderer;
  }

  function readBackgroundColor(styleValue) {
    return StyleSheet.flatten(styleValue).backgroundColor;
  }

  describe('Button', () => {
    function findOuterView(renderer) {
      return renderer.root.findAllByType(View)[0];
    }

    it('falls back to GlobalStyle.color.primaryColor100 fill when no provider is present', () => {
      const renderer = render(<Button>label</Button>);
      const outer = findOuterView(renderer);
      expect(readBackgroundColor(outer.props.style)).toBe(GlobalStyle.color.primaryColor100);
    });

    it('uses the normalized owner primaryColor fill when wrapped in a PrivateGroupThemeProvider', () => {
      const expectedTheme = getPrivateGroupTheme({ primaryColor: OWNER_GROUP.primary_color });
      const renderer = render(
        <PrivateGroupThemeProvider group={OWNER_GROUP}>
          <Button>label</Button>
        </PrivateGroupThemeProvider>
      );
      const outer = findOuterView(renderer);
      expect(readBackgroundColor(outer.props.style)).toBe(expectedTheme.primaryColor);
    });
  });

  describe('BigButton', () => {
    function readPressableFill(renderer) {
      const nodes = renderer.root.findAll((inst) => typeof inst.props?.style === 'function');
      expect(nodes.length).toBeGreaterThan(0);
      const resolved = nodes[0].props.style({ pressed: false });
      return readBackgroundColor(resolved);
    }

    function readPressedFill(renderer) {
      const nodes = renderer.root.findAll((inst) => typeof inst.props?.style === 'function');
      expect(nodes.length).toBeGreaterThan(0);
      const resolved = nodes[0].props.style({ pressed: true });
      return readBackgroundColor(resolved);
    }

    it('falls back to GlobalStyle.color.primaryColor fill when no provider is present', () => {
      const renderer = render(<BigButton text="go" />);
      expect(readPressableFill(renderer)).toBe(GlobalStyle.color.primaryColor);
    });

    it('falls back to GlobalStyle.color.primaryColor700 pressed fill when no provider is present', () => {
      const renderer = render(<BigButton text="go" />);
      expect(readPressedFill(renderer)).toBe(GlobalStyle.color.primaryColor700);
    });

    it('uses the normalized owner primaryColor fill when wrapped in a PrivateGroupThemeProvider', () => {
      const expectedTheme = getPrivateGroupTheme({ primaryColor: OWNER_GROUP.primary_color });
      const renderer = render(
        <PrivateGroupThemeProvider group={OWNER_GROUP}>
          <BigButton text="go" />
        </PrivateGroupThemeProvider>
      );
      expect(readPressableFill(renderer)).toBe(expectedTheme.primaryColor);
    });
  });

  describe('TableButton', () => {
    function findBtnView(renderer) {
      return renderer.root.findByType(View);
    }

    it('falls back to GlobalStyle.color.primaryColor fill when no provider is present', () => {
      const renderer = render(<TableButton onPress={jest.fn()} />);
      const btn = findBtnView(renderer);
      expect(readBackgroundColor(btn.props.style)).toBe(GlobalStyle.color.primaryColor);
    });

    it('uses the normalized owner primaryColor fill when wrapped in a PrivateGroupThemeProvider', () => {
      const expectedTheme = getPrivateGroupTheme({ primaryColor: OWNER_GROUP.primary_color });
      const renderer = render(
        <PrivateGroupThemeProvider group={OWNER_GROUP}>
          <TableButton onPress={jest.fn()} />
        </PrivateGroupThemeProvider>
      );
      const btn = findBtnView(renderer);
      expect(readBackgroundColor(btn.props.style)).toBe(expectedTheme.primaryColor);
    });
  });
});
