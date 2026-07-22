import React from 'react';
import { act, create } from 'react-test-renderer';
import { BackHandler, View } from 'react-native';
import type { ReactTestRenderer } from 'react-test-renderer';
import type { ReactNode } from 'react';

import AdInterstitial from '../components/Ads/AdInterstitial';
import type { AdSource } from '../services/ads/AdSource';

const mockLoadingOverlay = jest.fn((_props: { message?: string }) => null);

jest.mock('../components/UI/LoadingOverlay', () => {
  return function MockLoadingOverlay(props: { message?: string }) {
    mockLoadingOverlay(props);
    return null;
  };
});

describe('AdInterstitial', () => {
  function makeSource(overrides: Partial<AdSource> = {}): AdSource {
    return {
      isReady: () => true,
      show: jest.fn().mockResolvedValue(undefined),
      renderSurface: (): ReactNode => null,
      ...overrides,
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('renders the source surface when renderSurface() returns non-null', async () => {
    const SURFACE_TESTID = 'ad.internal.pro.surface';
    const source = makeSource({
      renderSurface: () => <View testID={SURFACE_TESTID} />,
    });

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<AdInterstitial adSource={source} onDone={jest.fn()} />);
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(renderer.root.findByProps({ testID: SURFACE_TESTID })).toBeTruthy();
  });

  it('renders LoadingOverlay when renderSurface() returns null', async () => {
    const source = makeSource({ renderSurface: () => null });

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<AdInterstitial adSource={source} onDone={jest.fn()} />);
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(mockLoadingOverlay).toHaveBeenCalledWith({ message: 'Loading Ads…' });
  });

  it('calls onDone once after show() resolves', async () => {
    const show = jest.fn().mockResolvedValue(undefined);
    const source = makeSource({ show });
    const onDone = jest.fn();

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<AdInterstitial adSource={source} onDone={onDone} />);
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(show).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    renderer.unmount();
  });

  it('subscribes BackHandler and blocks hardware back (handler returns true) while mounted', async () => {
    const source = makeSource();
    const addSpy = jest.spyOn(BackHandler, 'addEventListener');
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<AdInterstitial adSource={source} onDone={jest.fn()} />);
    });

    expect(addSpy).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));
    const handler = addSpy.mock.calls.at(-1)![1] as () => boolean;
    expect(handler()).toBe(true);

    renderer.unmount();
  });

  it('unsubscribes BackHandler on unmount', async () => {
    const source = makeSource();
    const removeSpy = jest.fn();
    const addSpy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove: removeSpy } as unknown as ReturnType<typeof BackHandler.addEventListener>);

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<AdInterstitial adSource={source} onDone={jest.fn()} />);
    });
    expect(removeSpy).not.toHaveBeenCalled();

    await act(async () => { renderer.unmount(); });
    expect(removeSpy).toHaveBeenCalledTimes(1);
    addSpy.mockRestore();
  });

  it('guards onDone with a doneRef (subsequent invocations are no-ops)', async () => {
    let resolveShow: () => void = () => {};
    const show = jest.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveShow = resolve; }),
    );
    const source = makeSource({ show });
    const onDone = jest.fn();

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<AdInterstitial adSource={source} onDone={onDone} />);
    });

    await act(async () => { resolveShow(); });
    await act(async () => { resolveShow(); });
    await act(async () => { await Promise.resolve(); });

    expect(onDone).toHaveBeenCalledTimes(1);
    renderer.unmount();
  });

  it('calls onDone on the e2e/instant path where show() resolves immediately', async () => {
    const show = jest.fn().mockResolvedValue(undefined);
    const source = makeSource({ show, renderSurface: () => null });
    const onDone = jest.fn();

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<AdInterstitial adSource={source} onDone={onDone} />);
    });
    await act(async () => { await Promise.resolve(); });

    expect(show).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    renderer.unmount();
  });
});
