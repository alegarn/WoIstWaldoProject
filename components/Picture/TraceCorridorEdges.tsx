import { memo, useMemo } from 'react';
import type { FC } from 'react';

import { offsetPolyline, type Point } from '../../utils/shapeGeometry';
import TraceInk from './TraceInk';

type TraceCorridorEdgesProps = {
  trace: Point[];
  distance: number;
  strokeWidth?: number;
};

const DEFAULT_EDGE_STROKE_WIDTH = 1;

// The loupe's corridor limit lines (plan D6/Q3): TWO thin polylines at
// ±distance around the live trace — never the fat translucent band. Pure
// presentational; the offset math lives in utils/shapeGeometry.
const TraceCorridorEdges: FC<TraceCorridorEdgesProps> = ({
  trace,
  distance,
  strokeWidth = DEFAULT_EDGE_STROKE_WIDTH,
}) => {
  const { left, right } = useMemo(
    () => offsetPolyline(trace, distance),
    [trace, distance]
  );

  return (
    <>
      <TraceInk
        points={left}
        strokeWidth={strokeWidth}
        testID="game.picture.trace-corridor-edge-left"
      />
      <TraceInk
        points={right}
        strokeWidth={strokeWidth}
        testID="game.picture.trace-corridor-edge-right"
      />
    </>
  );
};

export default memo(TraceCorridorEdges);
