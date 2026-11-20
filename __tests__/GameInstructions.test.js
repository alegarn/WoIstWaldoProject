jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
}));

jest.mock('../components/UI/BigButton', () => {
  return function MockBigButton(props) {
    return null;
  };
});

jest.mock('../utils/e2eMode', () => ({
  isE2EMode: jest.fn(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';

import GameInstructions from '../components/Instructions/GameInstructions';
import { isE2EMode } from '../utils/e2eMode';

describe('GameInstructions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isE2EMode.mockReturnValue(false);
  });

  it('renders the guess-specific instruction copy', async () => {
    let renderer;

    await act(async () => {
      renderer = create(
        <GameInstructions
          uri="file:///fixture.jpg"
          game="guess"
          screenHeight={640}
          screenWidth={320}
          imageIsPortrait={true}
          handleFilterClick={jest.fn()}
          imageDimensionStyle={{ width: 200, height: 300 }}
        />
      );
    });

    const renderedText = renderer.root
      .findAll((node) => node.type === 'Text')
      .map((node) => node.props.children)
      .flat()
      .join(' ');

    expect(renderedText).toContain('Guess where the Waldo is,');
    expect(renderedText).toContain('touch the screen!');
    expect(renderedText).toContain('or show the description');
  });

  it('exposes a tappable e2e overlay selector that dismisses the instructions', async () => {
    isE2EMode.mockReturnValue(true);
    const handleFilterClick = jest.fn();
    let renderer;

    await act(async () => {
      renderer = create(
        <GameInstructions
          uri="file:///fixture.jpg"
          game="hide"
          screenHeight={640}
          screenWidth={320}
          imageIsPortrait={false}
          handleFilterClick={handleFilterClick}
          imageDimensionStyle={{ width: 300, height: 200 }}
        />
      );
    });

    const overlay = renderer.root.findByProps({ testID: 'game.instructions.hide.overlay' });

    await act(async () => {
      overlay.props.onPress();
    });

    expect(handleFilterClick).toHaveBeenCalledTimes(1);
  });
});