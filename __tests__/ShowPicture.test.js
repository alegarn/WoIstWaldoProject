const mockEnigmaOverlay = jest.fn(() => null);
const mockIconButton = jest.fn(() => null);
const mockSpeedRing = jest.fn(() => null);
const mockCenteredModal = jest.fn(() => null);
const mockShapeCanvas = jest.fn(() => null);
const mockTraceCorridorEdges = jest.fn(() => null);

let mockCapturedPanRecords;
let mockCapturedPanRecord;
let mockCapturedPan;
let mockCapturedTapRecords;
let mockCapturedTapRecord;
let mockCapturedTap;

jest.mock('react-native', () => {
  const React = require('react');

  class MockAnimatedValue {
    constructor(value) {
      this._value = value;
    }
    setValue = (nextValue) => {
      this._value = nextValue;
    };
    __getValue = () => this._value;
  }

  function buildAnimation(value, config) {
    return {
      start: (callback) => {
        if (typeof config?.toValue !== 'undefined' && value?.setValue) {
          value.setValue(config.toValue);
        }
        callback?.();
      },
    };
  }

  return {
    Animated: {
      Value: MockAnimatedValue,
      timing: jest.fn((value, config) => buildAnimation(value, config)),
      loop: jest.fn((anim) => ({
        start: () => {},
        stop: () => {},
        reset: () => {},
      })),
      parallel: jest.fn((animations) => ({
        start: (cb) => {
          animations.forEach((a) => a?.start?.());
          cb?.();
        },
      })),
      sequence: jest.fn((animations) => ({
        start: (cb) => {
          animations.forEach((a) => a?.start?.());
          cb?.();
        },
      })),
      View: ({ children, ...props }) => React.createElement('AnimatedView', props, children),
    },
    Text: ({ children, ...props }) => React.createElement('Text', props, children),
    ImageBackground: ({ children, ...props }) =>
      React.createElement('ImageBackground', props, children),
    Pressable: ({ children, ...props }) => React.createElement('Pressable', props, children),
    StyleSheet: {
      absoluteFill: {},
      absoluteFillObject: {},
      create: (styles) => styles,
    },
    View: ({ children, ...props }) => React.createElement('View', props, children),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual('react');

  function makeChainable(type = 'pan') {
    const record = { __type: type, calls: [] };
    const handler = {
      get(_t, prop) {
        if (prop === '__type' || prop === 'calls') return record[prop];
        if (prop === 'then') return undefined;
        return (...args) => {
          record.calls.push({ method: prop, args });
          return proxy;
        };
      },
    };
    const proxy = new Proxy(record, handler);
    mockCapturedPanRecords.push(record);
    if (type === 'tap') {
      mockCapturedTapRecords.push(record);
      mockCapturedTapRecord = record;
      mockCapturedTap = proxy;
    } else {
      mockCapturedPanRecord = record;
      mockCapturedPan = proxy;
    }
    return proxy;
  }

  return {
    Gesture: {
      Pan: () => makeChainable('pan'),
      Tap: () => makeChainable('tap'),
      Race: (...gs) => ({ __type: 'race', gestures: gs }),
      Exclusive: (...gs) => ({ __type: 'exclusive', gestures: gs }),
      Simultaneous: (...gs) => ({ __type: 'sim', gestures: gs }),
    },
    GestureDetector: ({ children, ...props }) =>
      React.createElement('GestureDetector', props, children),
    GestureHandlerRootView: ({ children, ...props }) =>
      React.createElement('GestureHandlerRootView', props, children),
  };
});

jest.mock('../components/Picture/Descriptions/EnigmaOverlay', () => {
  return function MockEnigmaOverlay(props) {
    mockEnigmaOverlay(props);
    return null;
  };
});

jest.mock('../components/UI/IconButton', () => {
  return function MockIconButton(props) {
    mockIconButton(props);
    return null;
  };
});

jest.mock('../components/UI/CenteredModal', () => {
  const React = require('react');
  return function MockCenteredModal(props) {
    mockCenteredModal(props);
    return React.createElement('View', { testID: props.testIDPrefix });
  };
});

jest.mock('../components/Guess/SpeedRing', () => {
  return function MockSpeedRing(props) {
    mockSpeedRing(props);
    return null;
  };
});

jest.mock('../components/Picture/ShapeCanvas', () => {
  const React = require('react');
  return function MockShapeCanvas(props) {
    mockShapeCanvas(props);
    return React.createElement('ShapeCanvas', props);
  };
});

// Loupe mirror content boundary: capture the corridor edges props the host
// composes for the shape-mode glass while rendering the real component.
jest.mock('../components/Picture/TraceCorridorEdges', () => {
  const React = require('react');
  const Actual = jest.requireActual('../components/Picture/TraceCorridorEdges').default;
  return function MockTraceCorridorEdges(props) {
    mockTraceCorridorEdges(props);
    return React.createElement(Actual, props);
  };
});

// Shape matcher boundary: the new guess-branch case lets the real
// GuessShapeSurface run; its graded outcome is controlled here (pattern from
// GuessScreen.test.tsx) while the hide-branch cases never touch scoring.
jest.mock('../utils/shapeMatch', () => ({
  ...jest.requireActual('../utils/shapeMatch'),
  outlineMatchScore: jest.fn(),
  isWinningTrace: jest.fn(),
}));

import React from 'react';
import { act, create } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

import ShowPicture from '../components/Picture/ShowPicture';
import { outlineMatchScore, isWinningTrace } from '../utils/shapeMatch';
import {
  LOUPE_LONG_PRESS_MS,
  LOUPE_ZOOM,
  LOUPE_DIAMETER_PX,
  loupeContentTransform,
  loupeLayout,
} from '../utils/loupeGeometry';
import { SHAPE_TOLERANCE_RATIO, shapeTolerancePx } from '../utils/shapeMatch';
import {
  corridorBandWidthPx,
  offsetPolyline,
} from '../utils/shapeGeometry';
import { traceSegmentStyle } from '../components/Picture/TraceInk';
import { buildSelectionFromPixels } from '../utils/targetLocation';

function findByTestID(renderer, testID) {
  return renderer.root.findByProps({ testID });
}

// D4 persistent mount: a hidden loupe stays in the tree — hidden = the hook's
// frameStyle opacity 0, never an unmount.
function expectLoupeHidden(renderer) {
  const loupe = findByTestID(renderer, 'game.picture.loupe');
  expect(loupe.props.style[2].opacity).toBe(0);
}

function findAllByType(renderer, type) {
  return renderer.root.findAllByType(type);
}

// D8 layout harness: RN onLayout never fires under react-test-renderer, so the
// tests drive the two measured spaces manually — the ROOT container (screen
// dims) and the styles.pressable View (root-relative image origin; the
// ImageBackground's own onLayout would be parent-relative ≈(0,0) and unusable).
// The image-sized view is picked by its numeric width style entry so the
// full-screen shape double-tap wrapper (absoluteFill, no width) is skipped.
function fireLayouts(
  renderer,
  container = { width: 360, height: 800 },
  image = { x: 20, y: 280, width: 320, height: 240 }
) {
  const views = findAllByType(renderer, 'View').filter(
    (node) => typeof node.props.onLayout === 'function'
  );
  const root = views.find(
    (node) => !Array.isArray(node.props.style) && node.props.style?.flex === 1
  );
  const pressable = views.find(
    (node) =>
      Array.isArray(node.props.style) &&
      node.props.style.some((s) => s && typeof s.width === 'number')
  );
  expect(root).toBeTruthy();
  expect(pressable).toBeTruthy();
  act(() => {
    root.props.onLayout({ nativeEvent: { layout: container } });
    pressable.props.onLayout({ nativeEvent: { layout: image } });
  });
}

// The precision pan is identified BY its activateAfterLongPress call — the
// surface classifier never chains that method.
function precisionPanRecord() {
  return mockCapturedPanRecords.find((record) =>
    record.calls.some((c) => c.method === 'activateAfterLongPress')
  );
}

function surfacePanRecord() {
  return mockCapturedPanRecords.find(
    (record) => !record.calls.some((c) => c.method === 'activateAfterLongPress')
  );
}

function panCallback(record, method) {
  const call = record?.calls.find((c) => c.method === method);
  if (!call) {
    throw new Error(`pan never registered ${method}`);
  }
  return call.args[0];
}

describe('ShowPicture', () => {
  const baseProps = {
    uri: 'file:///pic.jpg',
    guess: true,
    description: 'Find it',
    touchLocation: { x: '0.5', y: '0.5' },
    handlePress: jest.fn(),
    handleLongPress: jest.fn(),
    target: {
      targetSize: 16,
      dragSize: 32,
      dragStyle: { position: 'absolute', left: 100, top: 50, width: 32, height: 32 },
    },
    handleIconPress: jest.fn(),
    showModal: false,
    handleConfirm: jest.fn(),
    onCancel: jest.fn(),
    imageDimensionStyle: { width: 200, height: 400 },
    targetGesture: { __id: 'target-pan-gesture' },
    defaultOpen: false,
    onDescriptionClosed: jest.fn(),
    onEdgeSwipe: jest.fn(),
  };

  function renderShowPicture(overrides = {}) {
    let renderer;
    act(() => {
      renderer = create(<ShowPicture {...baseProps} {...overrides} />);
    });
    return renderer;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturedPanRecords = [];
    mockCapturedPanRecord = undefined;
    mockCapturedPan = undefined;
    mockCapturedTapRecords = [];
    mockCapturedTapRecord = undefined;
    mockCapturedTap = undefined;
  });

  it('wraps the picture surface in a GestureDetector carrying a single Pan surface-swipe gesture', () => {
    const renderer = renderShowPicture();
    const detectors = findAllByType(renderer, 'GestureDetector');
    expect(detectors.length).toBeGreaterThanOrEqual(2);
    const surfaceDetector = detectors.find((d) => d.props.gesture === mockCapturedPan);
    expect(surfaceDetector).toBeTruthy();
    expect(mockCapturedPanRecord.__type).toBe('pan');
  });

  it('wraps the target circle in an INNER GestureDetector carrying the target drag gesture from props', () => {
    const renderer = renderShowPicture();
    const detectors = findAllByType(renderer, 'GestureDetector');
    const targetDetector = detectors.find((d) => d.props.gesture === baseProps.targetGesture);
    expect(targetDetector).toBeTruthy();
    expect(() => findByTestID(renderer, 'game.picture.guess-target-wrap')).not.toThrow();
  });

  it('preserves the e2e Pressable on the surface (onPress/onLongPress)', () => {
    const renderer = renderShowPicture();
    const surface = findByTestID(renderer, 'game.picture.guess-surface');
    expect(surface.props.onPress).toBe(baseProps.handlePress);
    expect(surface.props.onLongPress).toBe(baseProps.handleLongPress);
  });

  it('passes isOpen={enigmaOpen} and onClose to EnigmaOverlay (controlled) and starts closed by default', () => {
    const renderer = renderShowPicture();
    const calls = mockEnigmaOverlay.mock.calls;
    const last = calls[calls.length - 1][0];
    expect(last.isOpen).toBe(false);
    expect(last.description).toBe('Find it');
    expect(last.screenHeight).toBe(400);
    expect(typeof last.onClose).toBe('function');
  });

  it('initial enigmaOpen mirrors defaultOpen=true', () => {
    const renderer = renderShowPicture({ defaultOpen: true });
    const last = mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
    expect(last.isOpen).toBe(true);
  });

  it('flips enigmaOpen=true when defaultOpen flips from false to true (existing-instance sync)', () => {
    let renderer;
    act(() => {
      renderer = create(<ShowPicture {...baseProps} defaultOpen={false} />);
    });
    let last = mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
    expect(last.isOpen).toBe(false);

    act(() => {
      renderer.update(<ShowPicture {...baseProps} defaultOpen={true} />);
    });

    last = mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
    expect(last.isOpen).toBe(true);
  });

  it('EnigmaOverlay onClose calls onDescriptionClosed AND closes (isOpen flips false)', () => {
    const onDescriptionClosed = jest.fn();
    let renderer;
    act(() => {
      renderer = create(
        <ShowPicture {...baseProps} defaultOpen={true} onDescriptionClosed={onDescriptionClosed} />,
      );
    });
    let last = mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
    expect(last.isOpen).toBe(true);

    act(() => {
      last.onClose();
    });

    expect(onDescriptionClosed).toHaveBeenCalledTimes(1);
    last = mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
    expect(last.isOpen).toBe(false);
  });

  it('still renders the target wrap, modal, and image when guessing (testIDs preserved)', () => {
    const renderer = renderShowPicture({ showModal: true });
    expect(() => findByTestID(renderer, 'game.picture.guess-surface')).not.toThrow();
    expect(() => findByTestID(renderer, 'game.picture.guess-image')).not.toThrow();
    expect(() => findByTestID(renderer, 'game.picture.guess-target-wrap')).not.toThrow();
    expect(() => findByTestID(renderer, 'game.picture.guess-modal')).not.toThrow();
  });

  describe('surface swipe dispatch', () => {
    function getOnEnd() {
      return mockCapturedPanRecord.calls.find((c) => c.method === 'onEnd').args[0];
    }

    function latestEnigmaProps() {
      return mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
    }

    it('up-swipe opens the enigma and does NOT trigger onEdgeSwipe', () => {
      const onEdgeSwipe = jest.fn();
      renderShowPicture({ defaultOpen: false, onEdgeSwipe });

      const onEnd = getOnEnd();
      act(() => {
        onEnd({ translationX: 4, translationY: -60 }, true);
      });

      expect(latestEnigmaProps().isOpen).toBe(true);
      expect(onEdgeSwipe).not.toHaveBeenCalled();
    });

    it('right-swipe triggers onEdgeSwipe and keeps the enigma closed', () => {
      const onEdgeSwipe = jest.fn();
      renderShowPicture({ defaultOpen: false, onEdgeSwipe });

      const onEnd = getOnEnd();
      act(() => {
        onEnd({ translationX: 70, translationY: 2 }, true);
      });

      expect(onEdgeSwipe).toHaveBeenCalledTimes(1);
      expect(latestEnigmaProps().isOpen).toBe(false);
    });

    it('unsuccessful gesture is ignored', () => {
      const onEdgeSwipe = jest.fn();
      renderShowPicture({ defaultOpen: false, onEdgeSwipe });

      const onEnd = getOnEnd();
      act(() => {
        onEnd({ translationX: 70, translationY: -60 }, false);
      });

      expect(onEdgeSwipe).not.toHaveBeenCalled();
      expect(latestEnigmaProps().isOpen).toBe(false);
    });

    it('up takes priority on a diagonal up+right swipe (regression for the reported bug)', () => {
      const onEdgeSwipe = jest.fn();
      renderShowPicture({ defaultOpen: false, onEdgeSwipe });

      const onEnd = getOnEnd();
      act(() => {
        onEnd({ translationX: 80, translationY: -70 }, true);
      });

      expect(latestEnigmaProps().isOpen).toBe(true);
      expect(onEdgeSwipe).not.toHaveBeenCalled();
    });
  });

  describe('shape mode', () => {
    const shapeProps = {
      shapeMode: true,
      outline: [{ x: 0.1, y: 0.05 }],
      onOutlineChange: jest.fn(),
    };

    function findShapeCanvases(renderer) {
      return findAllByType(renderer, 'ShapeCanvas');
    }

    function hasSurfacePanDisabled() {
      return surfacePanRecord().calls.some(
        (c) => c.method === 'enabled' && c.args[0] === false
      );
    }

    function getOnEnd() {
      return surfacePanRecord().calls.find((c) => c.method === 'onEnd').args[0];
    }

    it('renders no ShapeCanvas when shapeMode is absent (point mode untouched)', () => {
      const renderer = renderShowPicture();

      expect(findShapeCanvases(renderer)).toHaveLength(0);
      expect(hasSurfacePanDisabled()).toBe(false);
    });

    it('mounts a bare ShapeCanvas with outline + onOutlineChange on the hide branch (guess: false)', () => {
      const onOutlineChange = jest.fn();
      const renderer = renderShowPicture({
        shapeMode: true,
        guess: false,
        outline: [{ x: 0.2, y: 0.3 }],
        onOutlineChange,
      });

      const shapeCanvases = findShapeCanvases(renderer);
      expect(shapeCanvases).toHaveLength(1);
      expect(shapeCanvases[0].props.imageDimensionStyle).toEqual({ width: 200, height: 400 });
      expect(shapeCanvases[0].props.outline).toEqual([{ x: 0.2, y: 0.3 }]);
      expect(shapeCanvases[0].props.onOutlineChange).toBe(onOutlineChange);
      expect(shapeCanvases[0].props.renderBand).toBeUndefined();
    });

    it('guess side mounts GuessShapeSurface with hiddenOutline + dims, not a bare ShapeCanvas', () => {
      outlineMatchScore.mockReturnValue(0.87);
      isWinningTrace.mockReturnValue(true);
      const onOutlineChange = jest.fn();
      const hiddenOutline = [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.1 },
        { x: 0.5, y: 0.9 },
        { x: 0.1, y: 0.1 },
      ];
      const renderer = renderShowPicture({
        shapeMode: true,
        outline: [{ x: 0.2, y: 0.3 }],
        onOutlineChange,
        hiddenOutline,
        imageWidth: 640,
        imageHeight: 480,
      });

      // The surface root replaces the bare branch.
      expect(() => findByTestID(renderer, 'game.picture.guess-shape-surface')).not.toThrow();

      // Single ShapeCanvas, mounted THROUGH the surface: band slot present,
      // dims and own-stroke outline forwarded untouched. (The corridor offset
      // pass-through is gone — tracing is finger-true since the offset
      // retirement.)
      const shapeCanvases = findShapeCanvases(renderer);
      expect(shapeCanvases).toHaveLength(1);
      expect(shapeCanvases[0].props.renderBand).toEqual(expect.any(Function));
      expect(shapeCanvases[0].props.imageDimensionStyle).toEqual({ width: 200, height: 400 });
      expect(shapeCanvases[0].props.outline).toEqual([{ x: 0.2, y: 0.3 }]);

      // hiddenOutline reached the surface: a lift reveals the graded overlay.
      const surfaceProps =
        mockShapeCanvas.mock.calls[mockShapeCanvas.mock.calls.length - 1][0];
      act(() => {
        surfaceProps.onOutlineChange(hiddenOutline);
      });
      expect(() => findByTestID(renderer, 'game.picture.trace-reveal')).not.toThrow();
    });

    it('suppresses the surface swipe classifier for the whole shape mode', () => {
      const onEdgeSwipe = jest.fn();
      renderShowPicture({ ...shapeProps, onEdgeSwipe, defaultOpen: false });

      expect(hasSurfacePanDisabled()).toBe(true);

      act(() => {
        getOnEnd()({ translationX: 70, translationY: 2 }, true);
      });
      act(() => {
        getOnEnd()({ translationX: 4, translationY: -60 }, true);
      });

      expect(onEdgeSwipe).not.toHaveBeenCalled();
      const last = mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
      expect(last.isOpen).toBe(false);
    });

    it('mirrors the controlled enigmaOpen prop into the overlay when it flips', () => {
      let renderer;
      act(() => {
        renderer = create(<ShowPicture {...baseProps} {...shapeProps} enigmaOpen={false} />);
      });
      let last = mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
      expect(last.isOpen).toBe(false);

      act(() => {
        renderer.update(<ShowPicture {...baseProps} {...shapeProps} enigmaOpen={true} />);
      });

      last = mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
      expect(last.isOpen).toBe(true);
    });

    it('shape modal confirm calls handleConfirm; redraw clears the outline and cancels', () => {
      const onOutlineChange = jest.fn();
      renderShowPicture({ ...shapeProps, onOutlineChange, showModal: true });

      const modalProps = mockCenteredModal.mock.calls[mockCenteredModal.mock.calls.length - 1][0];
      expect(modalProps.confirmLabel).toBe('Confirm outline');
      expect(modalProps.cancelLabel).toBe('Redraw outline');

      act(() => {
        modalProps.onPress();
      });
      expect(baseProps.handleConfirm).toHaveBeenCalledTimes(1);
      expect(onOutlineChange).not.toHaveBeenCalled();

      act(() => {
        modalProps.onCancel();
      });
      expect(onOutlineChange).toHaveBeenCalledWith(null);
      expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('point-mode modal keeps the default labels and onCancel untouched', () => {
      renderShowPicture({ showModal: true });

      const modalProps = mockCenteredModal.mock.calls[mockCenteredModal.mock.calls.length - 1][0];
      expect(modalProps.confirmLabel).toBeUndefined();
      expect(modalProps.cancelLabel).toBeUndefined();
      expect(modalProps.onCancel).toBe(baseProps.onCancel);
      expect(modalProps.onPress).toBe(baseProps.handleConfirm);
    });
  });

  describe('shape edge double-tap (guess side)', () => {
    // Shape guess fixture: image surface 320×240 centred at (20,280) inside a
    // 360×800 screen. The two-tap recognizer hosts on a FULL-SCREEN wrapper,
    // so the zones are SCREEN edges (image border or not): y >= 752
    // (800-48) → enigma, x <= 48 → exit menu, corner → enigma (bottom
    // classified first). Taps in the screen margins OUTSIDE the image must
    // fire exactly like in-image taps; the wrapper dims arrive via onLayout.
    const doubleTapProps = {
      shapeMode: true,
      guess: true,
      touchLocation: null,
      target: null,
      imageDimensionStyle: { width: 320, height: 240 },
      defaultOpen: false,
    };
    const SCREEN = { width: 360, height: 800 };

    function doubleTapRecord() {
      return mockCapturedTapRecords.find(
        (record) =>
          record.calls.some((c) => c.method === 'numberOfTaps' && c.args[0] === 2) &&
          record.calls.some((c) => c.method === 'onEnd')
      );
    }

    function doubleTapDetector(renderer) {
      const record = doubleTapRecord();
      if (!record) {
        throw new Error('no two-tap recognizer is attached');
      }
      const detector = findAllByType(renderer, 'GestureDetector').find(
        (d) => d.props.gesture === mockCapturedTap
      );
      return { record, detector };
    }

    function fireDoubleTap(event, success = true) {
      const record = doubleTapRecord();
      if (!record) {
        throw new Error('no two-tap recognizer is attached');
      }
      const onEnd = record.calls.find((c) => c.method === 'onEnd').args[0];
      act(() => {
        onEnd(event, success);
      });
    }

    function latestEnigmaProps() {
      return mockEnigmaOverlay.mock.calls[mockEnigmaOverlay.mock.calls.length - 1][0];
    }

    // RN onLayout never fires under react-test-renderer: drive the
    // full-screen detector host's layout manually (screen dims).
    function fireScreenHostLayout(renderer) {
      const host = findAllByType(renderer, 'View').find(
        (node) =>
          typeof node.props.onLayout === 'function' &&
          Array.isArray(node.props.style) &&
          node.props.style.includes(StyleSheet.absoluteFill)
      );
      expect(host).toBeTruthy();
      act(() => {
        host.props.onLayout({ nativeEvent: { layout: SCREEN } });
      });
    }

    function renderDoubleTap(overrides = {}) {
      const renderer = renderShowPicture({ ...doubleTapProps, ...overrides });
      fireScreenHostLayout(renderer);
      return renderer;
    }

    it('mounts the numberOfTaps(2) recognizer on a full-screen wrapper hosting the surface subtree', () => {
      const renderer = renderShowPicture({ ...doubleTapProps, onEdgeSwipe: jest.fn() });

      const { detector } = doubleTapDetector(renderer);
      expect(detector).toBeTruthy();

      // Full-screen host: absoluteFill wrapper, and the surface pan detector
      // subtree lives INSIDE it; loupe/modal stay later siblings.
      const wrapper = detector.children[0];
      expect(Array.isArray(wrapper.props.style)).toBe(true);
      expect(wrapper.props.style).toContain(StyleSheet.absoluteFill);
      expect(
        detector.findAll((node) => node.props.gesture === mockCapturedPan).length
      ).toBeGreaterThan(0);
    });

    it('double tap near the bottom screen border opens the enigma even outside the image', () => {
      const onEdgeSwipe = jest.fn();
      renderDoubleTap({ onEdgeSwipe });

      // (180,780): bottom strip (780 >= 800-48) but BELOW the image rect
      // (image bottom is 280+240=520) — the old image-space host missed it.
      fireDoubleTap({ x: 180, y: 780 });

      expect(latestEnigmaProps().isOpen).toBe(true);
      expect(onEdgeSwipe).not.toHaveBeenCalled();
    });

    it('double tap near the left screen border fires onEdgeSwipe even outside the image', () => {
      const onEdgeSwipe = jest.fn();
      renderDoubleTap({ onEdgeSwipe });

      // (10,400): left strip (10 <= 48) but LEFT of the image rect (image
      // left is 20) — the old image-space host classified this as enigma.
      fireDoubleTap({ x: 10, y: 400 });

      expect(onEdgeSwipe).toHaveBeenCalledTimes(1);
      expect(latestEnigmaProps().isOpen).toBe(false);
    });

    it('in-image left-strip double tap still fires onEdgeSwipe (existing zone intact)', () => {
      const onEdgeSwipe = jest.fn();
      renderDoubleTap({ onEdgeSwipe });

      // (30,400): inside the image rect (20..340 × 280..520) and in the
      // left strip — classification unchanged where the zones overlap.
      fireDoubleTap({ x: 30, y: 400 });

      expect(onEdgeSwipe).toHaveBeenCalledTimes(1);
      expect(latestEnigmaProps().isOpen).toBe(false);
    });

    it('corner double tap resolves to the enigma (bottom beats left, same priority as point mode)', () => {
      const onEdgeSwipe = jest.fn();
      renderDoubleTap({ onEdgeSwipe });

      fireDoubleTap({ x: 10, y: 790 });

      expect(latestEnigmaProps().isOpen).toBe(true);
      expect(onEdgeSwipe).not.toHaveBeenCalled();
    });

    it('double tap in the middle of the image does neither', () => {
      const onEdgeSwipe = jest.fn();
      renderDoubleTap({ onEdgeSwipe });

      fireDoubleTap({ x: 180, y: 400 });

      expect(latestEnigmaProps().isOpen).toBe(false);
      expect(onEdgeSwipe).not.toHaveBeenCalled();
    });

    it('double tap in the mid-screen margin below the image does nothing', () => {
      const onEdgeSwipe = jest.fn();
      renderDoubleTap({ onEdgeSwipe });

      // (180,600): outside the image (bottom 520) yet in NEITHER screen strip
      // — screen-space classification must not over-trigger in the margins.
      fireDoubleTap({ x: 180, y: 600 });

      expect(latestEnigmaProps().isOpen).toBe(false);
      expect(onEdgeSwipe).not.toHaveBeenCalled();
    });

    it('unsuccessful double tap does nothing', () => {
      const onEdgeSwipe = jest.fn();
      renderDoubleTap({ onEdgeSwipe });

      fireDoubleTap({ x: 180, y: 780 }, false);

      expect(latestEnigmaProps().isOpen).toBe(false);
      expect(onEdgeSwipe).not.toHaveBeenCalled();
    });

    it('double tap is inert while the confirm modal is shown', () => {
      const onEdgeSwipe = jest.fn();
      renderDoubleTap({ onEdgeSwipe, showModal: true });

      fireDoubleTap({ x: 180, y: 780 });

      expect(latestEnigmaProps().isOpen).toBe(false);
      expect(onEdgeSwipe).not.toHaveBeenCalled();
    });

    it('point mode never builds the double-tap recognizer', () => {
      renderShowPicture();

      expect(doubleTapRecord()).toBeUndefined();
    });
  });

  describe('point precision loupe (hide press-hold)', () => {
    const hidePointProps = {
      guess: false,
      touchLocation: null,
      target: null,
      imageDimensionStyle: { width: 320, height: 480 },
    };

    function renderHidePoint(overrides = {}) {
      return renderShowPicture({ ...hidePointProps, ...overrides });
    }

    // Fixture (D8): image 320×480 at root-relative origin (20,280) inside a
    // 360×800 container, so image-px (140,260) == container (160,540) — the
    // anchors stay in-bounds (height 480 > 260), no clamp interference.
    function fireHidePointLayouts(renderer) {
      fireLayouts(
        renderer,
        { width: 360, height: 800 },
        { x: 20, y: 280, width: 320, height: 480 }
      );
    }

    it('press-hold activates the loupe, follows the drag, and places the clamped point on release', () => {
      const onPointPlaced = jest.fn();
      const renderer = renderHidePoint({ onPointPlaced });
      fireHidePointLayouts(renderer);

      const record = precisionPanRecord();
      expect(record).toBeTruthy();
      expect(record.calls.find((c) => c.method === 'activateAfterLongPress').args[0]).toBe(
        LOUPE_LONG_PRESS_MS
      );

      act(() => {
        panCallback(record, 'onBegin')({ x: 100, y: 200 });
      });
      act(() => {
        panCallback(record, 'onStart')({ x: 100, y: 200 });
      });
      act(() => {
        panCallback(record, 'onUpdate')({ x: 140, y: 260 });
      });

      const loupe = findByTestID(renderer, 'game.picture.loupe');
      const frameStyle = loupe.props.style[2];
      const expectedFrame = loupeLayout({
        anchor: { x: 20 + 140, y: 280 + 260 },
        screen: { width: 360, height: 800 },
      });
      expect(frameStyle.transform[0].translateX.__getValue()).toBe(expectedFrame.left);
      expect(frameStyle.transform[1].translateY.__getValue()).toBe(expectedFrame.top);

      act(() => {
        panCallback(record, 'onEnd')({ x: 140, y: 260 }, true);
      });

      expect(onPointPlaced).toHaveBeenCalledTimes(1);
      expect(onPointPlaced).toHaveBeenCalledWith({ x: 140, y: 260 });
      expectLoupeHidden(renderer);

      // The placed marker persists: the parent applies the onPointPlaced
      // payload (selection px + target) and the target wrap keeps rendering.
      const selection = buildSelectionFromPixels({
        locationX: 140,
        locationY: 260,
        screenWidth: 320,
        screenHeight: 640,
        imageDimensionStyle: { width: 320, height: 480 },
      });
      act(() => {
        renderer.update(
          <ShowPicture
            {...baseProps}
            {...hidePointProps}
            onPointPlaced={onPointPlaced}
            touchLocation={selection.location}
            target={selection.target}
          />
        );
      });
      expect(() => findByTestID(renderer, 'game.picture.hide-target-wrap')).not.toThrow();
    });

    // Orientation-lock regression: the async orientation lock re-layouts the
    // tree AFTER the first measure, so the SECOND onLayout pair carries the
    // true dims/origin. The old write-once guards discarded it and an
    // in-flight loupe stayed mispositioned for the whole mount. The ref
    // writes must be unconditional and must self-heal the loupe without a
    // new pointer event.
    it('second onLayout wins and self-heals an in-flight loupe (no further gesture events)', () => {
      const renderer = renderHidePoint({});
      fireLayouts(
        renderer,
        { width: 360, height: 800 },
        { x: 20, y: 280, width: 320, height: 480 }
      );

      const record = precisionPanRecord();
      act(() => {
        panCallback(record, 'onBegin')({ x: 140, y: 260 });
      });
      act(() => {
        panCallback(record, 'onStart')({ x: 140, y: 260 });
      });
      act(() => {
        panCallback(record, 'onUpdate')({ x: 140, y: 260 });
      });

      const beforeFrame = loupeLayout({
        anchor: { x: 20 + 140, y: 280 + 260 },
        screen: { width: 360, height: 800 },
      });

      // Orientation swap: container 800×360, image origin (33,0). NO gesture
      // events after this — the layout pass alone must reposition the loupe.
      fireLayouts(
        renderer,
        { width: 800, height: 360 },
        { x: 33, y: 0, width: 320, height: 480 }
      );

      const afterFrame = loupeLayout({
        anchor: { x: 33 + 140, y: 0 + 260 },
        screen: { width: 800, height: 360 },
      });

      const loupe = findByTestID(renderer, 'game.picture.loupe');
      const frameStyle = loupe.props.style[2];
      expect(frameStyle.transform[0].translateX.__getValue()).toBe(afterFrame.left);
      expect(frameStyle.transform[1].translateY.__getValue()).toBe(afterFrame.top);
      // Bug pin: the old guard kept the stale pre-orientation position.
      expect(afterFrame.left).not.toBe(beforeFrame.left);
      expect(afterFrame.top).not.toBe(beforeFrame.top);
    });

    it('hold without move places at the touch-down point on release', () => {
      const onPointPlaced = jest.fn();
      const renderer = renderHidePoint({ onPointPlaced });
      fireHidePointLayouts(renderer);

      const record = precisionPanRecord();
      act(() => {
        panCallback(record, 'onBegin')({ x: 100, y: 200 });
      });
      act(() => {
        panCallback(record, 'onStart')({ x: 100, y: 200 });
      });
      expect(() => findByTestID(renderer, 'game.picture.loupe')).not.toThrow();

      act(() => {
        panCallback(record, 'onEnd')({ x: 100, y: 200 }, true);
      });

      expect(onPointPlaced).toHaveBeenCalledWith({ x: 100, y: 200 });
      expectLoupeHidden(renderer);
    });

    it('quick tap keeps placing through the Pressable and keeps the loupe hidden', () => {
      const onPointPlaced = jest.fn();
      const renderer = renderHidePoint({ onPointPlaced });
      fireHidePointLayouts(renderer);

      const surface = findByTestID(renderer, 'game.picture.hide-surface');
      expect(surface.props.onPress).toBe(baseProps.handlePress);

      act(() => {
        surface.props.onPress({ nativeEvent: { locationX: 100, locationY: 200 } });
      });

      expect(baseProps.handlePress).toHaveBeenCalledTimes(1);
      expect(onPointPlaced).not.toHaveBeenCalled();
      expectLoupeHidden(renderer);
    });

    it('fast swipe never activates the precision pan; the surface classifier still receives its gesture', () => {
      const onEdgeSwipe = jest.fn();
      const onPointPlaced = jest.fn();
      const renderer = renderHidePoint({ onEdgeSwipe, onPointPlaced });
      fireHidePointLayouts(renderer);

      const precision = precisionPanRecord();
      expect(precision).toBeTruthy();

      // RNGH semantics: finger movement beyond touch slop (~10dp) during the
      // 200ms long-press delay CANCELS the long-press, so the recognizer never
      // ACTIVATES. The mock mirrors that by firing ONLY onUpdate — onStart and
      // onEnd are never fired (registration entries in `calls` are the builder
      // chain, not fired gestures).
      act(() => {
        panCallback(precision, 'onUpdate')({ x: 160, y: 110, translationX: 60, translationY: 10 });
      });

      expect(onPointPlaced).not.toHaveBeenCalled();
      expectLoupeHidden(renderer);

      act(() => {
        panCallback(surfacePanRecord(), 'onEnd')({ translationX: 70, translationY: 2 }, true);
      });
      expect(onEdgeSwipe).toHaveBeenCalledTimes(1);
    });

    it('slow-start race is benign: the classifier owns the gesture and the precision pan never activates', () => {
      // RNGH caveat (pinned): a hold of ~150ms followed by a fast ≥40px drag
      // cancels long-press activation (movement beyond touch slop during the
      // delay) — a jittery hold degrades to plain tap/press behaviour, never a
      // broken mid-flight state. The surface classifier has no long-press
      // gate, so its existing path owns the outcome (right-swipe → exit menu
      // here; up-swipe → enigma on the guess side, same classifier).
      const onEdgeSwipe = jest.fn();
      const renderer = renderHidePoint({ onEdgeSwipe });
      fireHidePointLayouts(renderer);

      act(() => {
        panCallback(surfacePanRecord(), 'onEnd')({ translationX: 60, translationY: 4 }, true);
      });

      expect(onEdgeSwipe).toHaveBeenCalledTimes(1);

      const precision = precisionPanRecord();
      expect(precision).toBeTruthy();
      expectLoupeHidden(renderer);
    });

    it('point loupe content mirrors nothing: zoomed image + built-in cursor only', () => {
      const renderer = renderHidePoint({});
      fireHidePointLayouts(renderer);

      const record = precisionPanRecord();
      act(() => {
        panCallback(record, 'onStart')({ x: 100, y: 200 });
      });

      expect(findByTestID(renderer, 'game.picture.loupe-image')).toBeTruthy();
      expect(findByTestID(renderer, 'game.picture.loupe-cursor')).toBeTruthy();

      const loupe = findByTestID(renderer, 'game.picture.loupe');
      const mirrored = loupe.findAll((node) => {
        const id = node.props.testID;
        return typeof id === 'string' && /trace|band|outline/.test(id);
      });
      expect(mirrored).toHaveLength(0);

      // Point modes pass NO children — the children wrapper stays empty.
      const wrapper = loupe.find(
        (node) =>
          Array.isArray(node.props.style) &&
          node.props.style.some((s) => s && s.transformOrigin === 'top left')
      );
      expect(wrapper.props.children ?? null).toBeNull();
    });
  });

  describe('guess drag loupe', () => {
    it('shows the loupe at the dragged target centre and hides it when the position clears', () => {
      const props = {
        ...baseProps,
        imageDimensionStyle: { width: 320, height: 480 },
        onTargetDragPosition: null,
      };
      let renderer;
      act(() => {
        renderer = create(<ShowPicture {...props} />);
      });
      fireLayouts(
        renderer,
        { width: 360, height: 800 },
        { x: 20, y: 280, width: 320, height: 480 }
      );

      expectLoupeHidden(renderer);

      act(() => {
        renderer.update(<ShowPicture {...props} onTargetDragPosition={{ x: 210, y: 310 }} />);
      });

      const loupe = findByTestID(renderer, 'game.picture.loupe');
      const frameStyle = loupe.props.style[2];
      const expectedFrame = loupeLayout({
        anchor: { x: 20 + 210, y: 280 + 310 },
        screen: { width: 360, height: 800 },
      });
      expect(frameStyle.transform[0].translateX.__getValue()).toBe(expectedFrame.left);
      expect(frameStyle.transform[1].translateY.__getValue()).toBe(expectedFrame.top);

      const contentNode = loupe
        .findAll((node) => node.type === 'AnimatedView')
        .find(
          (node) =>
            node.props.testID === undefined &&
            Array.isArray(node.props.style) &&
            node.props.style.some((s) => s && Array.isArray(s.transform))
        );
      const contentStyle = contentNode.props.style[2];
      const expectedContent = loupeContentTransform({ anchor: { x: 210, y: 310 } });
      expect(contentStyle.transform[0].translateX.__getValue()).toBe(expectedContent.translateX);
      expect(contentStyle.transform[1].translateY.__getValue()).toBe(expectedContent.translateY);

      act(() => {
        renderer.update(<ShowPicture {...props} onTargetDragPosition={null} />);
      });
      expectLoupeHidden(renderer);
    });
  });

  describe('shape loupe (trace mirror)', () => {
    // Fixture (D8, non-zero origin): image 320×480 at root-relative origin
    // (20,280) inside a 360×800 container; stroke reported in IMAGE-px.
    const shapeLayout = [
      { width: 360, height: 800 },
      { x: 20, y: 280, width: 320, height: 480 },
    ];
    const shapeDims = { width: 320, height: 480 };
    // Horizontal stroke so the corridor offsets are exact: ±tolerance on y.
    const stroke = [
      { x: 100, y: 200 },
      { x: 140, y: 200 },
    ];
    const strokeUpdate = { anchor: stroke[1], renderPoints: stroke };

    const guessShapeProps = {
      shapeMode: true,
      guess: true,
      touchLocation: null,
      target: null,
      imageDimensionStyle: shapeDims,
      outline: [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.5, y: 0.8 },
        { x: 0.2, y: 0.2 },
      ],
      onOutlineChange: jest.fn(),
      hiddenOutline: [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.1 },
        { x: 0.5, y: 0.9 },
        { x: 0.1, y: 0.1 },
      ],
      imageWidth: 1000,
      imageHeight: 1000,
    };

    function renderShape(overrides = {}) {
      const renderer = renderShowPicture({ ...guessShapeProps, ...overrides });
      fireLayouts(renderer, ...shapeLayout);
      return renderer;
    }

    function shapeCanvasProps(renderer) {
      const nodes = findAllByType(renderer, 'ShapeCanvas');
      expect(nodes.length).toBe(1);
      return nodes[nodes.length - 1].props;
    }

    function loupeNodesByTestID(loupe, testID) {
      return loupe.findAll((node) => node.props.testID === testID);
    }

    // react-test-renderer 19 findAll can return alternate-fiber ghosts for
    // the same logical node — presence/count-by-geometry stays safe, but
    // expectOne `find` calls must go through these dedupe helpers.
    function firstLoupeNode(loupe, predicate) {
      const all = loupe.findAll(predicate);
      expect(all.length).toBeGreaterThan(0);
      return all[0];
    }

    function dedupeStyles(styles) {
      const seen = new Set();
      return styles.filter((style) => {
        const key = JSON.stringify(style);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }

    function contentStyleOf(loupe) {
      const contentNode = loupe
        .findAll((node) => node.type === 'AnimatedView')
        .find(
          (node) =>
            node.props.testID === undefined &&
            Array.isArray(node.props.style) &&
            node.props.style.some((s) => s && Array.isArray(s.transform))
        );
      expect(contentNode).toBeTruthy();
      return contentNode.props.style[2];
    }

    function mirrorBarStyles(loupe, testID) {
      const root = firstLoupeNode(loupe, (node) => node.props.testID === testID);
      return dedupeStyles(
        root
          .findAll(
            (node) =>
              !Array.isArray(node.props.style) &&
              node.props.style &&
              Array.isArray(node.props.style.transform)
          )
          .map((node) => node.props.style)
      );
    }

    it('keeps the canvas onStrokeUpdate prop identity stable across host re-renders (banked e250d6e useCallback pin)', () => {
      const renderer = renderShape();
      const handlerAtMount = shapeCanvasProps(renderer).onStrokeUpdate;

      act(() => {
        renderer.update(<ShowPicture {...guessShapeProps} />);
      });

      expect(shapeCanvasProps(renderer).onStrokeUpdate).toBe(handlerAtMount);
    });

    it('guess stroke mirrors live ink + corridor edge lines into the loupe (no fat band)', () => {
      const renderer = renderShape();
      expectLoupeHidden(renderer);

      act(() => {
        shapeCanvasProps(renderer).onStrokeUpdate(strokeUpdate);
      });

      const loupe = findByTestID(renderer, 'game.picture.loupe');
      expect(loupeNodesByTestID(loupe, 'game.picture.trace-ink').length).toBeGreaterThan(0);
      expect(loupeNodesByTestID(loupe, 'game.picture.trace-corridor-edge-left').length).toBeGreaterThan(0);
      expect(loupeNodesByTestID(loupe, 'game.picture.trace-corridor-edge-right').length).toBeGreaterThan(0);
      expect(loupeNodesByTestID(loupe, 'game.picture.trace-band')).toHaveLength(0);
    });

    it('bounds the mirrored ink to the trailing window: bars render for FEWER segments than the full stroke', () => {
      const renderer = renderShape();

      // 240px-spread polyline (25 points): far more than the 160px glass window.
      const longStroke = [];
      for (let x = 10; x <= 250; x += 10) {
        longStroke.push({ x, y: 200 });
      }
      expect(longStroke.length).toBe(25);

      act(() => {
        shapeCanvasProps(renderer).onStrokeUpdate({
          anchor: longStroke[longStroke.length - 1],
          renderPoints: longStroke,
        });
      });

      const loupe = findByTestID(renderer, 'game.picture.loupe');
      const fullSegments = longStroke.length - 1;
      expect(mirrorBarStyles(loupe, 'game.picture.trace-ink').length).toBeLessThan(fullSegments);
    });

    it('anchors the glass: frame = loupeLayout(origin + rawPoint), content = loupeContentTransform(rawPoint)', () => {
      const renderer = renderShape();

      act(() => {
        shapeCanvasProps(renderer).onStrokeUpdate(strokeUpdate);
      });

      const loupe = findByTestID(renderer, 'game.picture.loupe');
      const frameStyle = loupe.props.style[2];
      const expectedFrame = loupeLayout({
        anchor: { x: 20 + stroke[1].x, y: 280 + stroke[1].y },
        screen: { width: 360, height: 800 },
      });
      expect(frameStyle.transform[0].translateX.__getValue()).toBe(expectedFrame.left);
      expect(frameStyle.transform[1].translateY.__getValue()).toBe(expectedFrame.top);

      const contentStyle = contentStyleOf(loupe);
      const expectedContent = loupeContentTransform({ anchor: stroke[1] });
      expect(contentStyle.transform[0].translateX.__getValue()).toBe(expectedContent.translateX);
      expect(contentStyle.transform[1].translateY.__getValue()).toBe(expectedContent.translateY);
    });

    it('aligns the mirrored ink at zoom: wrapper scale + latest-point bar land at the glass centre (LSP pin)', () => {
      const renderer = renderShape();

      act(() => {
        shapeCanvasProps(renderer).onStrokeUpdate(strokeUpdate);
      });

      const loupe = findByTestID(renderer, 'game.picture.loupe');
      const wrapper = firstLoupeNode(
        loupe,
        (node) =>
          Array.isArray(node.props.style) &&
          node.props.style.some((s) => s && s.transformOrigin === 'top left')
      );
      const wrapperStyle = wrapper.props.style.find((s) => s && s.transformOrigin === 'top left');
      expect(wrapperStyle.transform).toEqual([{ scale: LOUPE_ZOOM }]);
      expect(wrapperStyle.width).toBe(shapeDims.width);
      expect(wrapperStyle.height).toBe(shapeDims.height);

      // The mirrored ink's LAST bar spans stroke[0]→stroke[1]; its far
      // endpoint IS the stroke's latest image-px point. Under the D9
      // arithmetic (wrapper 'top left' scale) it must land at the glass
      // centre: point × zoom + content translate == diameter / 2.
      const bars = mirrorBarStyles(loupe, 'game.picture.trace-ink');
      expect(bars.length).toBeGreaterThan(0);
      const bar = bars[bars.length - 1];
      const dx = stroke[1].x - stroke[0].x;
      const dy = stroke[1].y - stroke[0].y;
      const length = Math.hypot(dx, dy);
      const centerX = bar.left + bar.width / 2;
      const centerY = bar.top + bar.height / 2;
      const endX = centerX + (dx / length) * (bar.width / 2);
      const endY = centerY + (dy / length) * (bar.width / 2);
      const contentStyle = contentStyleOf(loupe);
      const translateX = contentStyle.transform[0].translateX.__getValue();
      const translateY = contentStyle.transform[1].translateY.__getValue();
      expect(endX * LOUPE_ZOOM + translateX).toBeCloseTo(LOUPE_DIAMETER_PX / 2);
      expect(endY * LOUPE_ZOOM + translateY).toBeCloseTo(LOUPE_DIAMETER_PX / 2);
    });

    it('loupe corridor edges use the IMAGE-space tolerance distance, not the screen band width (units pin)', () => {
      const renderer = renderShape();

      act(() => {
        shapeCanvasProps(renderer).onStrokeUpdate(strokeUpdate);
      });

      const distance = shapeTolerancePx(
        guessShapeProps.imageWidth,
        guessShapeProps.imageHeight
      );
      expect(distance).toBe(50);
      const { left, right } = offsetPolyline(stroke, distance);
      const loupe = findByTestID(renderer, 'game.picture.loupe');

      const leftBars = mirrorBarStyles(loupe, 'game.picture.trace-corridor-edge-left');
      expect(leftBars).toContainEqual(traceSegmentStyle(left[0], left[1], 1));
      const rightBars = mirrorBarStyles(loupe, 'game.picture.trace-corridor-edge-right');
      expect(rightBars).toContainEqual(traceSegmentStyle(right[0], right[1], 1));

      // The screen-px band width (corridorBandWidthPx at style 320) belongs to
      // the full-size band ONLY — the loupe edges are thin 1px lines offset by
      // the image-space tolerance, not bars of the band width.
      const screenBandWidth = corridorBandWidthPx(
        { imageWidth: guessShapeProps.imageWidth, imageHeight: guessShapeProps.imageHeight },
        shapeDims.width,
        shapeDims.height,
        SHAPE_TOLERANCE_RATIO
      );
      expect(screenBandWidth).not.toBe(distance);
      expect(leftBars.every((style) => style.height !== screenBandWidth)).toBe(true);
      expect(rightBars.every((style) => style.height !== screenBandWidth)).toBe(true);
    });

    it('lift hides the loupe and the graded reveal still appears (existing behavior intact)', () => {
      outlineMatchScore.mockReturnValue(0.87);
      isWinningTrace.mockReturnValue(true);
      const renderer = renderShape();

      act(() => {
        shapeCanvasProps(renderer).onStrokeUpdate(strokeUpdate);
      });
      expect(() => findByTestID(renderer, 'game.picture.loupe')).not.toThrow();

      act(() => {
        shapeCanvasProps(renderer).onStrokeUpdate(null);
      });
      expectLoupeHidden(renderer);

      act(() => {
        shapeCanvasProps(renderer).onOutlineChange([
          { x: 0.2, y: 0.2 },
          { x: 0.8, y: 0.2 },
          { x: 0.5, y: 0.8 },
          { x: 0.2, y: 0.2 },
        ]);
      });
      expect(() => findByTestID(renderer, 'game.picture.trace-reveal')).not.toThrow();
    });

    it('commits the mirror coarse-gated (≤9 commits over a 96px stroke) while reports arrive at the ~4px cadence', () => {
      const renderer = renderShape();
      const props = shapeCanvasProps(renderer);

      // 96px stroke reported at the ≥4px decimation cadence: 25 anchors
      // (stroke start + 24 decimated commits).
      const points = [];
      for (let x = 100; x <= 196; x += 4) {
        points.push({ x, y: 200 });
      }
      expect(points.length).toBe(25);

      // One act per report: on-device each report is its own event tick, so
      // each commit re-renders the mirror separately (batching would collapse
      // the renders and hide the cadence).
      mockTraceCorridorEdges.mockClear();
      points.forEach((point, index) => {
        act(() => {
          props.onStrokeUpdate({
            anchor: point,
            renderPoints: points.slice(0, index + 1),
          });
        });
      });

      let commits = 0;
      let previousLength = 0;
      for (const call of mockTraceCorridorEdges.mock.calls) {
        const length = (call[0].trace ?? []).length;
        if (length > previousLength) {
          commits++;
        }
        previousLength = length;
      }
      expect(commits).toBeGreaterThan(1);
      expect(commits).toBeLessThanOrEqual(96 / 12 + 1);
    });

    it('hide shape stroke mirrors ink only into the loupe (no band, no edges)', () => {
      const renderer = renderShape({
        guess: false,
        outline: null,
        hiddenOutline: undefined,
        imageWidth: undefined,
        imageHeight: undefined,
      });

      act(() => {
        shapeCanvasProps(renderer).onStrokeUpdate(strokeUpdate);
      });

      const loupe = findByTestID(renderer, 'game.picture.loupe');
      expect(loupeNodesByTestID(loupe, 'game.picture.trace-ink').length).toBeGreaterThan(0);
      expect(loupeNodesByTestID(loupe, 'game.picture.trace-band')).toHaveLength(0);
      expect(
        loupe.findAll(
          (node) =>
            typeof node.props.testID === 'string' &&
            node.props.testID.startsWith('game.picture.trace-corridor-edge')
        )
      ).toHaveLength(0);
    });

    it('never mirrors the hidden outline into the loupe during a guess stroke (leak guard)', () => {
      const renderer = renderShape();

      act(() => {
        shapeCanvasProps(renderer).onStrokeUpdate(strokeUpdate);
      });

      const loupe = findByTestID(renderer, 'game.picture.loupe');
      const leaked = loupe.findAll(
        (node) => typeof node.props.testID === 'string' && /outline/.test(node.props.testID)
      );
      expect(leaked).toHaveLength(0);
    });
  });
});
