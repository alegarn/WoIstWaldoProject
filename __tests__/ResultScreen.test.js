const mockShowSuccess = jest.fn(() => null);
const mockShowFailure = jest.fn(() => null);

jest.mock('../utils/orientation', () => ({
  handleOrientation: jest.fn(),
}));

jest.mock('../components/Results/ShowSuccess', () => {
  return function MockShowSuccess(props) {
    mockShowSuccess(props);
    return null;
  };
});

jest.mock('../components/Results/ShowFailure', () => {
  return function MockShowFailure(props) {
    mockShowFailure(props);
    return null;
  };
});

import React from 'react';
import { act, create } from 'react-test-renderer';

import ResultScreen from '../screens/GuessScreens/ResultScreen';
import { handleOrientation } from '../utils/orientation';

describe('ResultScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('locks the screen back to portrait and renders the success branch', async () => {
    const navigation = { reset: jest.fn() };
    const route = { params: { onTarget: true } };

    await act(async () => {
      create(<ResultScreen route={route} navigation={navigation} />);
    });

    expect(handleOrientation).toHaveBeenCalledWith('portrait');
    expect(mockShowSuccess).toHaveBeenCalledWith({ navigation, route });
    expect(mockShowFailure).not.toHaveBeenCalled();
  });

  it('renders the failure branch when the guess misses the target', async () => {
    const navigation = { reset: jest.fn() };
    const route = { params: { onTarget: false } };

    await act(async () => {
      create(<ResultScreen route={route} navigation={navigation} />);
    });

    expect(mockShowFailure).toHaveBeenCalledWith({ navigation, route });
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });
});