jest.mock('../components/UI/IconButton', () => {
  return function MockIconButton(props) {
    return null;
  };
});

jest.mock('../components/UI/CenteredModal', () => {
  return function MockCenteredModal(props) {
    return null;
  };
});

jest.mock('../components/UI/MovableTextBox', () => {
  return function MockMovableTextBox(props) {
    return null;
  };
});

import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import ShowPicture from '../components/Picture/ShowPicture';

describe('ShowPicture', () => {
  const baseProps = {
    uri: 'file:///fixture.jpg',
    guess: false,
    description: 'Look near the tree.',
    touchLocation: null,
    handlePress: jest.fn(),
    handleLongPress: jest.fn(),
    target: null,
    handleIconPress: jest.fn(),
    showModal: false,
    handleConfirm: jest.fn(),
    onCancel: jest.fn(),
    imageDimensionStyle: { width: 240, height: 160 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the clear icon hidden until a point has been selected', async () => {
    let renderer;

    await act(async () => {
      renderer = create(<ShowPicture {...baseProps} />);
    });

    expect(renderer.root.findAllByProps({ testID: 'game.picture.clear-hide' })).toHaveLength(0);
  });

  it('uses an image-sized press surface and forwards press handlers', async () => {
    const handlePress = jest.fn();
    const handleLongPress = jest.fn();
    let renderer;

    await act(async () => {
      renderer = create(
        <ShowPicture
          {...baseProps}
          guess={true}
          handlePress={handlePress}
          handleLongPress={handleLongPress}
          imageDimensionStyle={{ width: 320, height: 180 }}
        />
      );
    });

    const surface = renderer.root.findByProps({ testID: 'game.picture.guess-surface' });
    const flattenedStyle = StyleSheet.flatten(surface.props.style);

    expect(flattenedStyle.width).toBe(320);
    expect(flattenedStyle.height).toBe(180);

    await act(async () => {
      surface.props.onPress();
      surface.props.onLongPress();
    });

    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(handleLongPress).toHaveBeenCalledTimes(1);
  });
});