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

    expect(flattenedStyle.position).toBe('absolute');

    await act(async () => {
      surface.props.onPress();
      surface.props.onLongPress();
    });

    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(handleLongPress).toHaveBeenCalledTimes(1);
  });

  it('attaches the target pan handlers to the wrapping view when a target is set', async () => {
    const onResponderGrant = jest.fn();
    const targetPanHandlers = { onResponderGrant };
    const target = {
      targetSize: 16,
      targetStyle: { position: 'absolute', width: 16, height: 16, left: 40, top: 20 },
      dragSize: 32,
      dragStyle: {
        position: 'absolute',
        width: 32,
        height: 32,
        left: 32,
        top: 12,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
      },
    };
    let renderer;

    await act(async () => {
      renderer = create(
        <ShowPicture
          {...baseProps}
          guess={true}
          touchLocation={{ x: '0.50', y: '0.50' }}
          target={target}
          targetPanHandlers={targetPanHandlers}
        />
      );
    });

    const wrapper = renderer.root.findByProps({ testID: 'game.picture.guess-target-wrap' });
    expect(wrapper.props.onResponderGrant).toBe(onResponderGrant);
    const flattenedStyle = StyleSheet.flatten(wrapper.props.style);
    expect(flattenedStyle.width).toBe(32);
    expect(flattenedStyle.borderRadius).toBe(16);
    expect(flattenedStyle.borderColor).toBe('#6528F7');

    const icon = renderer.root.findByProps({ testID: 'game.picture.clear-guess' });
    expect(icon).toBeTruthy();
  });
});