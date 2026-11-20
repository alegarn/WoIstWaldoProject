import React from 'react';
import { ScrollView, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import ModalContent from '../components/UI/ModalContent';

describe('ModalContent', () => {
  it('renders the full hide warning inside a scrollable container', () => {
    let tree;

    act(() => {
      tree = create(
        <ModalContent
          screenHeight={600}
          screenWidth={320}
          guessPath={false}
        />
      );
    });

    expect(tree.root.findByType(ScrollView)).toBeTruthy();
    expect(
      tree.root.findAllByType(Text).some((node) => {
        const content = Array.isArray(node.props.children)
          ? node.props.children.join('')
          : node.props.children;

        return typeof content === 'string' && content.includes('Please wait for a bit');
      })
    ).toBe(true);
  });
});