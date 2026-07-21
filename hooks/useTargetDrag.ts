import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder } from 'react-native';

import { buildSelectionFromPixels } from '../utils/targetLocation';

const TAP_THRESHOLD = 8;

type Point = { x: number; y: number };

type TargetStyle = {
  position: 'absolute';
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius?: number;
  alignItems?: 'center';
  justifyContent?: 'center';
};

export type UseTargetDragSelection = {
  location: { x: string; y: string };
  target: {
    targetSize: number;
    targetStyle: TargetStyle;
    dragSize?: number;
    dragStyle?: TargetStyle;
  } | null;
};

export type UseTargetDragArgs = {
  enabled: boolean;
  screenWidth: number;
  screenHeight: number;
  imageDimensionStyle: { width: number; height: number };
  initialSelection: UseTargetDragSelection | null;
  onInteract?: () => void;
  onTap?: () => void;
};

export type UseTargetDragResult = {
  touchLocation: { x: string; y: string } | null;
  target: UseTargetDragSelection['target'];
  panHandlers: unknown;
  setSelection: (selection: UseTargetDragSelection) => void;
};

type DragState = {
  target: UseTargetDragSelection['target'];
  screenWidth: number;
  screenHeight: number;
  imageDimensionStyle: { width: number; height: number };
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function useTargetDrag(args: UseTargetDragArgs): UseTargetDragResult {
  const {
    enabled,
    screenWidth,
    screenHeight,
    imageDimensionStyle,
    initialSelection,
    onInteract,
    onTap,
  } = args;

  const [touchLocation, setTouchLocation] = useState<{ x: string; y: string } | null>(
    initialSelection?.location ?? null,
  );
  const [target, setTarget] = useState<UseTargetDragSelection['target']>(
    initialSelection?.target ?? null,
  );

  const userInteractedRef = useRef(false);

  useEffect(() => {
    if (userInteractedRef.current) return;
    setTouchLocation(initialSelection?.location ?? null);
    setTarget(initialSelection?.target ?? null);
  }, [initialSelection]);

  const dragStartRef = useRef<Point>({ x: 0, y: 0 });

  const stateRef = useRef<DragState>({
    target,
    screenWidth,
    screenHeight,
    imageDimensionStyle,
  });
  stateRef.current = { target, screenWidth, screenHeight, imageDimensionStyle };

  const onInteractRef = useRef(onInteract);
  onInteractRef.current = onInteract;

  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  const setSelection = useCallback((selection: UseTargetDragSelection) => {
    setTouchLocation(selection.location);
    setTarget(selection.target);
  }, []);

  const panHandlers = useMemo(() => {
    if (!enabled) {
      return undefined;
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        onInteractRef.current?.();
        userInteractedRef.current = true;
        const { target: currentTarget } = stateRef.current;
        const half = (currentTarget?.targetSize ?? 0) / 2;
        dragStartRef.current = {
          x: (currentTarget?.targetStyle?.left ?? 0) + half,
          y: (currentTarget?.targetStyle?.top ?? 0) + half,
        };
      },
      onPanResponderMove: (_event, gestureState) => {
        const {
          screenWidth: sw,
          screenHeight: sh,
          imageDimensionStyle: dims,
        } = stateRef.current;
        const nextX = clamp(dragStartRef.current.x + gestureState.dx, 0, dims.width);
        const nextY = clamp(dragStartRef.current.y + gestureState.dy, 0, dims.height);
        const selection = buildSelectionFromPixels({
          locationX: nextX,
          locationY: nextY,
          screenWidth: sw,
          screenHeight: sh,
          imageDimensionStyle: dims,
        }) as UseTargetDragSelection;
        setTouchLocation(selection.location);
        setTarget(selection.target);
      },
      onPanResponderRelease: (_event, gestureState) => {
        const moved = Math.hypot(gestureState.dx, gestureState.dy);
        if (moved < TAP_THRESHOLD) {
          onTapRef.current?.();
        }
      },
      onPanResponderTerminationRequest: () => false,
    }).panHandlers;
  }, [enabled]);

  return { touchLocation, target, panHandlers, setSelection };
}
