import { strict as assert } from 'assert';
import * as fc from 'fast-check';

import {
  mapGraphToMinimap,
  mapMinimapToGraph,
  computeViewportIndicator,
  clampDragPosition,
  GraphBounds,
  MinimapBounds,
} from '../../services/minimapMath';

/**
 * Property-based tests for minimapMath coordinate mapping functions.
 *
 * **Validates: Requirements 9.2**
 */
describe('minimapMath — property-based tests', function () {
  const minimapBounds: MinimapBounds = { width: 150, height: 100 };

  // Arbitrary for valid graph bounds (non-degenerate: maxX > minX, maxY > minY)
  const graphBoundsArb = fc.record({
    minX: fc.double({ min: -1000, max: 0, noNaN: true, noDefaultInfinity: true }),
    maxX: fc.double({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true }),
    minY: fc.double({ min: -1000, max: 0, noNaN: true, noDefaultInfinity: true }),
    maxY: fc.double({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true }),
  }) as fc.Arbitrary<GraphBounds>;

  /**
   * Property 7.2: mapGraphToMinimap always produces coordinates in [0, width] × [0, height]
   *
   * **Validates: Requirements 9.2**
   */
  it('mapGraphToMinimap always produces coordinates within minimap bounds', function () {
    fc.assert(
      fc.property(
        graphBoundsArb,
        fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
        (graphBounds, graphX, graphY) => {
          // Clamp graphX/graphY to be within graphBounds for meaningful mapping
          const clampedX = Math.max(graphBounds.minX, Math.min(graphX, graphBounds.maxX));
          const clampedY = Math.max(graphBounds.minY, Math.min(graphY, graphBounds.maxY));

          const result = mapGraphToMinimap(clampedX, clampedY, graphBounds, minimapBounds);

          assert.ok(result.x >= 0, `x=${result.x} should be >= 0`);
          assert.ok(result.x <= minimapBounds.width, `x=${result.x} should be <= ${minimapBounds.width}`);
          assert.ok(result.y >= 0, `y=${result.y} should be >= 0`);
          assert.ok(result.y <= minimapBounds.height, `y=${result.y} should be <= ${minimapBounds.height}`);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Property 7.3: viewport indicator width and height always > 0 and <= minimap dimensions
   *
   * **Validates: Requirements 9.2**
   */
  it('computeViewportIndicator always has width > 0 and height > 0 and <= minimap size', function () {
    fc.assert(
      fc.property(
        graphBoundsArb,
        fc.double({ min: 100, max: 2000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 100, max: 2000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.3, max: 4, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true }),
        (graphBounds, canvasW, canvasH, zoom, panX, panY) => {
          const rect = computeViewportIndicator(canvasW, canvasH, zoom, panX, panY, graphBounds, minimapBounds);

          assert.ok(rect.width > 0, `width=${rect.width} should be > 0`);
          assert.ok(rect.height > 0, `height=${rect.height} should be > 0`);
          assert.ok(rect.width <= minimapBounds.width, `width=${rect.width} should be <= ${minimapBounds.width}`);
          assert.ok(rect.height <= minimapBounds.height, `height=${rect.height} should be <= ${minimapBounds.height}`);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Property 7.4: round-trip mapGraphToMinimap → mapMinimapToGraph ≈ original
   *
   * **Validates: Requirements 9.2**
   */
  it('round-trip mapGraph→mapMinimap→mapGraph approximates original (floating point tolerance)', function () {
    fc.assert(
      fc.property(
        graphBoundsArb,
        fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }),
        (graphBounds, graphX, graphY) => {
          // Clamp to graph bounds for meaningful round-trip
          const clampedX = Math.max(graphBounds.minX, Math.min(graphX, graphBounds.maxX));
          const clampedY = Math.max(graphBounds.minY, Math.min(graphY, graphBounds.maxY));

          const minimap = mapGraphToMinimap(clampedX, clampedY, graphBounds, minimapBounds);
          const roundTrip = mapMinimapToGraph(minimap.x, minimap.y, graphBounds, minimapBounds);

          const tolerance = 0.001;
          assert.ok(
            Math.abs(roundTrip.x - clampedX) < tolerance,
            `x round-trip: ${roundTrip.x} vs ${clampedX}`,
          );
          assert.ok(
            Math.abs(roundTrip.y - clampedY) < tolerance,
            `y round-trip: ${roundTrip.y} vs ${clampedY}`,
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Property 7.5: clampDragPosition always returns coordinates within bounds
   *
   * **Validates: Requirements 9.2**
   */
  it('clampDragPosition always returns coordinates within minimap bounds', function () {
    fc.assert(
      fc.property(
        fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true }),
        (x, y) => {
          const result = clampDragPosition(x, y, minimapBounds);

          assert.ok(result.x >= 0, `x=${result.x} should be >= 0`);
          assert.ok(result.x <= minimapBounds.width, `x=${result.x} should be <= ${minimapBounds.width}`);
          assert.ok(result.y >= 0, `y=${result.y} should be >= 0`);
          assert.ok(result.y <= minimapBounds.height, `y=${result.y} should be <= ${minimapBounds.height}`);
        },
      ),
      { numRuns: 200 },
    );
  });
});
