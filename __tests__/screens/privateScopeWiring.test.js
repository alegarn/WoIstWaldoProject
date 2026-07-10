jest.mock('../../utils/scoreRequests', () => ({
  getRankingData: jest.fn(),
  getUserScores: jest.fn(),
}));

jest.mock('../../utils/targetLocation', () => ({
  isOnTarget: jest.fn(),
}));

jest.mock('../../components/Picture/GuessPicture', () => {
  const React = require('react');
  return function MockGuessPicture(props) {
    return React.createElement('GuessPicture', props);
  };
});

jest.mock('../../components/Picture/HidePicture', () => {
  const React = require('react');
  return function MockHidePicture(props) {
    return React.createElement('HidePicture', props);
  };
});

jest.mock('../../components/UI/TutorialOverlay', () => () => null);

jest.mock('../../components/UI/TableComponent', () => {
  const React = require('react');
  return function MockTableComponent() {
    return React.createElement('TableComponent');
  };
});

jest.mock('../../components/UI/LoadingOverlay', () => () => null);

jest.mock('../../hooks/useActiveGroup', () => ({
  useActiveGroup: () => ({
    scope: { kind: 'public' },
    activeGroupId: null,
    setActive: jest.fn(),
    clear: jest.fn(),
  }),
}));

jest.mock('../../hooks/useGroupsHub', () => ({
  useGroupsHub: () => ({ data: null, isLoading: false, error: null, refresh: jest.fn() }),
}));

jest.mock('../../store/auth-context', () => {
  const React = require('react');
  return {
    AuthContext: React.createContext({ token: 'Bearer token-1', userId: 'user-1' }),
  };
});

import React from 'react';
import { Dimensions } from 'react-native';
import { act, create } from 'react-test-renderer';

import GuessScreen from '../../screens/GuessScreens/GuessScreen';
import HideScreen from '../../screens/HideScreens/HideScreen';
import RankingScreen from '../../screens/RankingScreen';
import { isOnTarget } from '../../utils/targetLocation';
import { getRankingData } from '../../utils/scoreRequests';

const PRIVATE_SCOPE = { kind: 'private', groupId: 'g-123' };

describe('reused screens — private scope wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 320,
      height: 640,
      scale: 1,
      fontScale: 1,
    });
  });

  afterEach(() => {
    Dimensions.get.mockRestore();
  });

  it('GuessScreen skips AdScreen and forwards scope=private+groupId to ResultScreen', async () => {
    const navigation = { replace: jest.fn() };
    const route = {
      params: {
        imageFile: 'file:///waldo.jpg',
        pictureId: 'img-1',
        description: 'Find Waldo',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        hiddenLocation: { x: 0.5, y: 0.5 },
        listId: 1,
        isTutorial: false,
        scope: PRIVATE_SCOPE,
      },
    };
    isOnTarget.mockReturnValue(true);

    let renderer;
    await act(async () => {
      renderer = create(<GuessScreen navigation={navigation} route={route} />);
    });

    const guessPictureInstance = renderer.root.findByType('GuessPicture');

    await act(async () => {
      guessPictureInstance.props.toAdScreen({ location: { x: 0.5, y: 0.5 } });
    });

    const targets = navigation.replace.mock.calls.map(([target]) => target);
    expect(targets).not.toContain('AdScreen');
    expect(navigation.replace).toHaveBeenCalledWith(
      'ResultScreen',
      expect.objectContaining({ scope: PRIVATE_SCOPE })
    );
  });

  it('HideScreen forwards the private scope into HidePicture so the hide flow stays scoped', async () => {
    const navigation = { navigate: jest.fn(), replace: jest.fn() };
    const route = {
      params: {
        uri: 'file:///hide.jpg',
        imageHeight: 1200,
        imageWidth: 800,
        isPortrait: true,
        isTutorial: false,
        scope: PRIVATE_SCOPE,
      },
    };

    let renderer;
    await act(async () => {
      renderer = create(<HideScreen navigation={navigation} route={route} />);
    });

    const hidePictureProps = renderer.root.findByType('HidePicture').props;
    expect(hidePictureProps.scope).toEqual(PRIVATE_SCOPE);

    expect(hidePictureProps.navigation).toBe(navigation);
  });

  it('RankingScreen calls getRankingData with the private group scope (not the public "initial" string)', async () => {
    getRankingData.mockResolvedValue({
      status: 200,
      data: { rows: [], nextCursor: null, hasMore: false },
    });

    const navigation = { setOptions: jest.fn(), replace: jest.fn() };
    const route = { params: { scope: PRIVATE_SCOPE } };

    await act(async () => {
      create(<RankingScreen route={route} navigation={navigation} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getRankingData).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'Bearer token-1' }),
      expect.objectContaining({ scope: PRIVATE_SCOPE })
    );

    const allCalls = getRankingData.mock.calls;
    for (const call of allCalls) {
      expect(call[1].scope).not.toBe('initial');
    }
  });
});
