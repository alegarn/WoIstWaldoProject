// IconPulseRing RED suite (private-groups-intro-plan Task 2a).
//
// Pins the pulse-ring contract: a phase-driven wrapper ('active' | 'settle' |
// 'off') around the header icon. 'active' loops a single-direction 700ms
// 1→1.12 scale timing 3 times (2.1s total), 'settle' loops it 2 times (1.4s),
// and an 'active' completion swaps to a CONSTANT-opacity static ring at the
// 1.12-scale footprint — a plain styled View, never an animated-opacity node.
// Loop completion is callback-driven (`loop.start(({ finished }) => ...)`):
// the component schedules ZERO timers, so the only way a phase end happens is
// the start-callback firing. 'off' renders the children bare — no
// Animated.View, no extra nodes, no listeners. Never starts in E2E mode;
// never animates under reduce-motion; `loop.stop()` runs on unmount AND on
// every phase change; every timing is useNativeDriver: true; the Animated.Value
// is a stable useRef identity across re-renders; `iterations` overrides the
// phase default.
//
// Harness: jest.spyOn(Animated, ...) like ModeCue.test.tsx, but Animated.loop
// is REPLACED by fake handles whose start callback the test invokes manually —
// exactly the callback-driven end the Gate/IconButton owner drives via
// `onLoopEnd` in production.

import React from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { act, create } from 'react-test-renderer';

import IconPulseRing from '../../components/UI/IconPulseRing';
import { GlobalStyle } from '../../constants/theme';
import { isE2EMode } from '../../utils/e2eMode';

jest.mock('../../utils/e2eMode', () => ({
  isE2EMode: jest.fn(() => false),
}));

const PULSE_MS = 700;

let fakeLoops;
let motionSubscriptions;
let valueSpy;
let timingSpy;
let loopSpy;

function makeFakeLoop() {
  const handle = { start: jest.fn(), stop: jest.fn() };
  fakeLoops.push(handle);
  return handle;
}

function styleOf(node) {
  return StyleSheet.flatten(node.props.style ?? []) ?? {};
}

// Bare-children reference JSON, mounted through the same act path as the ring
// (outside act, a root fragment serializes to null instead of its child).
async function bareChildrenJson() {
  let renderer;
  await act(async () => {
    renderer = create(
      <>
        <View testID="ring-child" />
      </>
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  return renderer.toJSON();
}

// Both helpers await the ring's reduce-motion init so the loop-start effects
// settle inside act before assertions run (sync act does not flush native
// promise jobs — without the await, loop creation would land after the test).
async function renderRing(phase, extraProps = {}, childStyle = undefined) {
  let renderer;
  await act(async () => {
    renderer = create(
      <IconPulseRing phase={phase} testID="ring-under-test" {...extraProps}>
        <View testID="ring-child" style={childStyle} />
      </IconPulseRing>
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  return renderer;
}

function startCallbackOf(loopHandle) {
  expect(loopHandle.start).toHaveBeenCalledTimes(1);
  return loopHandle.start.mock.calls[0][0];
}

function finishLoop(loopHandle) {
  const callback = startCallbackOf(loopHandle);
  act(() => {
    callback({ finished: true });
  });
}

describe('IconPulseRing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fakeLoops = [];
    motionSubscriptions = [];
    jest.useFakeTimers();

    isE2EMode.mockReturnValue(false);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((eventName, handler) => {
      const subscription = { eventName, handler, remove: jest.fn() };
      motionSubscriptions.push(subscription);
      return subscription;
    });

    valueSpy = jest.spyOn(Animated, 'Value');
    timingSpy = jest.spyOn(Animated, 'timing');
    loopSpy = jest.spyOn(Animated, 'loop').mockImplementation(makeFakeLoop);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders the wrapped children with the testID passed through to the ring wrapper', async () => {
    const renderer = await renderRing('active');

    expect(renderer.root.findByProps({ testID: 'ring-under-test' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'ring-child' })).toBeTruthy();
    expect(loopSpy).toHaveBeenCalledTimes(1);
    expect(fakeLoops[0].start).toHaveBeenCalledTimes(1);
  });

  it('never starts the loop in E2E mode', async () => {
    isE2EMode.mockReturnValue(true);

    const renderer = await renderRing('active');

    expect(loopSpy).not.toHaveBeenCalled();
    expect(timingSpy).not.toHaveBeenCalled();
    renderer.unmount();
  });

  it('loops a single-direction 700ms 1→1.12 timing three times for phase active', async () => {
    const renderer = await renderRing('active');

    expect(timingSpy).toHaveBeenCalledTimes(1);
    const [, timingConfig] = timingSpy.mock.calls[0];
    expect(timingConfig.toValue).toBe(1.12);
    expect(timingConfig.duration).toBe(PULSE_MS);
    expect(loopSpy).toHaveBeenCalledTimes(1);
    expect(loopSpy.mock.calls[0][1]).toEqual({ iterations: 3 });

    for (const [, config] of timingSpy.mock.calls) {
      expect(config.useNativeDriver).toBe(true);
    }
    renderer.unmount();
  });

  it('loops the same timing twice for phase settle', async () => {
    const renderer = await renderRing('settle');

    expect(timingSpy).toHaveBeenCalledTimes(1);
    const [, timingConfig] = timingSpy.mock.calls[0];
    expect(timingConfig.toValue).toBe(1.12);
    expect(timingConfig.duration).toBe(PULSE_MS);
    expect(loopSpy.mock.calls[0][1]).toEqual({ iterations: 2 });
    renderer.unmount();
  });

  it('lets the optional iterations prop override the phase default', async () => {
    const renderer = await renderRing('active', { iterations: 5 });

    expect(loopSpy.mock.calls[0][1]).toEqual({ iterations: 5 });
    renderer.unmount();
  });

  it('every Animated.timing config runs on the native driver', async () => {
    const renderer = await renderRing('active');

    expect(timingSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    for (const [, config] of timingSpy.mock.calls) {
      expect(config.useNativeDriver).toBe(true);
    }
    renderer.unmount();
  });

  it('schedules zero timers and fires onLoopEnd only via the start callback with finished true', async () => {
    const onLoopEnd = jest.fn();
    const renderer = await renderRing('settle', { onLoopEnd });

    // React's scheduler leaves its own pending immediates after a mount; drain
    // them so the count reflects only timers the ring itself scheduled.
    act(() => {
      jest.runAllTimers();
    });
    expect(jest.getTimerCount()).toBe(0);
    act(() => {
      jest.advanceTimersByTime(3 * PULSE_MS + 100);
    });
    expect(onLoopEnd).not.toHaveBeenCalled();

    const callback = startCallbackOf(fakeLoops[0]);
    act(() => {
      callback({ finished: false });
    });
    expect(onLoopEnd).not.toHaveBeenCalled();

    act(() => {
      callback({ finished: true });
    });
    expect(onLoopEnd).toHaveBeenCalledTimes(1);
    renderer.unmount();
  });

  it('renders the accent ring inside the animated branch, visible throughout the pulse and seamless into the static 1.12 footprint', async () => {
    const renderer = await renderRing('active');

    const wrapper = renderer.root
      .findAllByProps({ testID: 'ring-under-test' })
      .find((node) => node.props.style !== undefined);
    const wrapperStyle = styleOf(wrapper);

    const pulseRing = renderer.root.findByProps({ testID: 'groups-intro.ring.pulse' });
    const pulseStyle = styleOf(pulseRing);
    expect(pulseStyle.opacity).toBeUndefined();
    expect(pulseStyle.borderWidth).toBe(2);
    expect(pulseStyle.borderColor).toBe(GlobalStyle.color.secondaryColor);
    expect(pulseStyle.width).toBe(wrapperStyle.width);
    expect(pulseStyle.height).toBe(wrapperStyle.height);
    expect(pulseStyle.borderRadius).toBeCloseTo(wrapperStyle.width / 2, 2);
    expect(typeof pulseStyle.position).toBe('string');
    expect(pulseStyle.width).toBe(32);
    expect(pulseStyle.height).toBe(32);

    finishLoop(fakeLoops[0]);

    const staticRing = renderer.root.findByProps({ testID: 'groups-intro.ring.static' });
    const staticStyle = styleOf(staticRing);
    expect(staticStyle.width).toBeCloseTo(35.84, 2);
    expect(staticStyle.height).toBeCloseTo(35.84, 2);
    renderer.unmount();
  });

  it('ends phase active on a constant-opacity static ring at the 1.12-scale footprint', async () => {
    const renderer = await renderRing('active');

    // findByProps would match the composite root first (it also carries the
    // testID prop); pick the host node, which is the one holding the style.
    const activeRing = renderer.root
      .findAllByProps({ testID: 'ring-under-test' })
      .find((node) => node.props.style !== undefined);
    const activeStyle = styleOf(activeRing);
    expect(typeof activeStyle.width).toBe('number');
    expect(typeof activeStyle.height).toBe('number');
    expect(activeStyle.width).toBe(32);
    expect(activeStyle.height).toBe(32);

    finishLoop(fakeLoops[0]);

    const staticRing = renderer.root.findByProps({ testID: 'groups-intro.ring.static' });
    const staticStyle = styleOf(staticRing);
    expect(typeof staticStyle.width).toBe('number');
    expect(typeof staticStyle.height).toBe('number');
    expect(staticStyle.width).toBeCloseTo(35.84, 2);
    expect(staticStyle.height).toBeCloseTo(35.84, 2);
    expect(staticStyle.opacity).toBeUndefined();
    expect(renderer.root.findAllByType(Animated.View)).toHaveLength(0);
    renderer.unmount();
  });

  it('renders a static constant-opacity ring without a loop under reduce motion', async () => {
    AccessibilityInfo.isReduceMotionEnabled.mockResolvedValue(true);

    const renderer = await renderRing('active');

    expect(loopSpy).not.toHaveBeenCalled();
    expect(timingSpy).not.toHaveBeenCalled();
    const staticRing = renderer.root.findByProps({ testID: 'groups-intro.ring.static' });
    const staticStyle = styleOf(staticRing);
    expect(typeof staticStyle.width).toBe('number');
    expect(typeof staticStyle.height).toBe('number');
    expect(staticStyle.width).toBeCloseTo(35.84, 2);
    expect(staticStyle.height).toBeCloseTo(35.84, 2);
    expect(staticStyle.opacity).toBeUndefined();
    renderer.unmount();
  });

  it('renders phase off as bare children with no extra nodes and no listeners', async () => {
    const bare = await bareChildrenJson();
    const renderer = await renderRing('off');

    const tree = renderer.toJSON();
    const nodes = Array.isArray(tree) ? tree : [tree];
    expect(nodes).toHaveLength(1);
    expect(renderer.root.findAllByType(Animated.View)).toHaveLength(0);
    expect(tree).toEqual(bare);
    expect(loopSpy).not.toHaveBeenCalled();
    expect(timingSpy).not.toHaveBeenCalled();
    expect(AccessibilityInfo.isReduceMotionEnabled).not.toHaveBeenCalled();
    expect(AccessibilityInfo.addEventListener).not.toHaveBeenCalled();
    renderer.unmount();
  });

  it('keeps one stable Animated.Value identity across re-renders', async () => {
    const renderer = await renderRing('active');
    const initialCreateCount = valueSpy.mock.calls.length;
    expect(initialCreateCount).toBeGreaterThanOrEqual(1);

    act(() => {
      renderer.update(
        <IconPulseRing phase="active" testID="ring-under-test">
          <View testID="ring-child" />
        </IconPulseRing>
      );
    });
    act(() => {
      renderer.update(
        <IconPulseRing phase="settle" testID="ring-under-test">
          <View testID="ring-child" />
        </IconPulseRing>
      );
    });

    expect(valueSpy.mock.calls.length).toBe(initialCreateCount);
    renderer.unmount();
  });

  it('stops the loop on every phase change and on unmount', async () => {
    const renderer = await renderRing('active');
    expect(fakeLoops).toHaveLength(1);

    act(() => {
      renderer.update(
        <IconPulseRing phase="settle" testID="ring-under-test">
          <View testID="ring-child" />
        </IconPulseRing>
      );
    });

    expect(fakeLoops[0].stop).toHaveBeenCalledTimes(1);
    expect(fakeLoops[1].start).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.update(
        <IconPulseRing phase="off" testID="ring-under-test">
          <View testID="ring-child" />
        </IconPulseRing>
      );
    });

    expect(fakeLoops[1].stop).toHaveBeenCalledTimes(1);
    expect(fakeLoops).toHaveLength(2);

    renderer.unmount();
  });

  it('subscribes to reduce-motion changes only while the ring is visible', async () => {
    const renderer = await renderRing('settle');

    expect(AccessibilityInfo.addEventListener).toHaveBeenCalledTimes(1);
    expect(motionSubscriptions[0].eventName).toBe('reduceMotionChanged');
    expect(motionSubscriptions[0].remove).not.toHaveBeenCalled();

    act(() => {
      renderer.update(
        <IconPulseRing phase="off" testID="ring-under-test">
          <View testID="ring-child" />
        </IconPulseRing>
      );
    });

    expect(motionSubscriptions[0].remove).toHaveBeenCalledTimes(1);

    const renderer2 = await renderRing('active');
    expect(motionSubscriptions).toHaveLength(2);
    await act(async () => {
      renderer2.unmount();
    });
    expect(motionSubscriptions[1].remove).toHaveBeenCalledTimes(1);
  });

  it('sizes the ring box to the glyph-only footprint of 32, not the 44 header-spacing box', async () => {
    const renderer = await renderRing('active');

    const wrapper = renderer.root
      .findAllByProps({ testID: 'ring-under-test' })
      .find((node) => node.props.style !== undefined);
    const wrapperStyle = styleOf(wrapper);
    expect(wrapperStyle.width).toBe(32);
    expect(wrapperStyle.height).toBe(32);

    const pulseStyle = styleOf(renderer.root.findByProps({ testID: 'groups-intro.ring.pulse' }));
    expect(pulseStyle.width).toBe(32);
    expect(pulseStyle.height).toBe(32);
    renderer.unmount();
  });

  it('centers the pulse and static rings on the center of a 24x24 child', async () => {
    const renderer = await renderRing('active', {}, { width: 24, height: 24 });

    const wrapper = renderer.root
      .findAllByProps({ testID: 'ring-under-test' })
      .find((node) => node.props.style !== undefined);
    const wrapperStyle = styleOf(wrapper);
    expect(wrapperStyle.alignItems).toBe('center');
    expect(wrapperStyle.justifyContent).toBe('center');

    const childCenter = wrapperStyle.width / 2;

    const pulseStyle = styleOf(renderer.root.findByProps({ testID: 'groups-intro.ring.pulse' }));
    expect(pulseStyle.left + pulseStyle.width / 2).toBe(childCenter);
    expect(pulseStyle.top + pulseStyle.height / 2).toBe(childCenter);
    expect(childCenter).toBe(16);

    finishLoop(fakeLoops[0]);

    const staticStyle = styleOf(renderer.root.findByProps({ testID: 'groups-intro.ring.static' }));
    expect(staticStyle.left + staticStyle.width / 2).toBeCloseTo(childCenter, 2);
    expect(staticStyle.top + staticStyle.height / 2).toBeCloseTo(childCenter, 2);
    renderer.unmount();
  });

  it('applies wrapperStyle to the animated wrapper without touching ring geometry', async () => {
    const renderer = await renderRing('active', { wrapperStyle: { marginRight: 20 } });

    const wrapper = renderer.root
      .findAllByProps({ testID: 'ring-under-test' })
      .find((node) => node.props.style !== undefined);
    const wrapperStyle = styleOf(wrapper);
    expect(wrapperStyle.marginRight).toBe(20);
    expect(wrapperStyle.width).toBe(32);
    expect(wrapperStyle.height).toBe(32);
    renderer.unmount();
  });

  it('keeps wrapperStyle on the static wrapper after the loop finishes', async () => {
    const renderer = await renderRing('settle', { wrapperStyle: { marginRight: 20 } });

    finishLoop(fakeLoops[0]);

    const wrapper = renderer.root
      .findAllByProps({ testID: 'ring-under-test' })
      .find((node) => node.props.style !== undefined);
    const wrapperStyle = styleOf(wrapper);
    expect(wrapperStyle.marginRight).toBe(20);
    expect(wrapperStyle.width).toBe(32);
    expect(wrapperStyle.height).toBe(32);
    renderer.unmount();
  });
});
