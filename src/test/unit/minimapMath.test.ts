import { strict as assert } from 'assert';

import {
  computeGraphBounds,
  mapGraphToMinimap,
  mapMinimapToGraph,
  computeViewportIndicator,
  shouldShowMinimap,
  clampDragPosition,
} from '../../services/minimapMath';

describe('minimapMath', function () {
  const minimapBounds = { width: 150, height: 100 };

  describe('computeGraphBounds', function () {
    it('should return correct bounds for nodes in varied positions', function () {
      const nodes = [
        { x: -50, y: -30 },
        { x: 100, y: 80 },
        { x: 25, y: 10 },
      ];
      const bounds = computeGraphBounds(nodes);
      assert.equal(bounds.minX, -50);
      assert.equal(bounds.maxX, 100);
      assert.equal(bounds.minY, -30);
      assert.equal(bounds.maxY, 80);
    });

    it('should return zero bounds for empty array', function () {
      const bounds = computeGraphBounds([]);
      assert.equal(bounds.minX, 0);
      assert.equal(bounds.maxX, 0);
      assert.equal(bounds.minY, 0);
      assert.equal(bounds.maxY, 0);
    });

    it('should handle all nodes at the same position', function () {
      const nodes = [
        { x: 5, y: 5 },
        { x: 5, y: 5 },
        { x: 5, y: 5 },
      ];
      const bounds = computeGraphBounds(nodes);
      // Should expand to avoid zero-width/height
      assert.ok(bounds.maxX - bounds.minX > 0);
      assert.ok(bounds.maxY - bounds.minY > 0);
      assert.equal(bounds.minX, 4);
      assert.equal(bounds.maxX, 6);
      assert.equal(bounds.minY, 4);
      assert.equal(bounds.maxY, 6);
    });
  });

  describe('mapGraphToMinimap', function () {
    it('should produce coordinates within minimap bounds', function () {
      const graphBounds = { minX: -100, maxX: 100, minY: -50, maxY: 50 };
      const result = mapGraphToMinimap(0, 0, graphBounds, minimapBounds);
      assert.ok(result.x >= 0 && result.x <= minimapBounds.width);
      assert.ok(result.y >= 0 && result.y <= minimapBounds.height);
    });

    it('should map graph corners to within minimap bounds', function () {
      const graphBounds = { minX: 0, maxX: 200, minY: 0, maxY: 100 };
      const topLeft = mapGraphToMinimap(0, 0, graphBounds, minimapBounds);
      const bottomRight = mapGraphToMinimap(200, 100, graphBounds, minimapBounds);
      assert.ok(topLeft.x >= 0);
      assert.ok(topLeft.y >= 0);
      assert.ok(bottomRight.x <= minimapBounds.width);
      assert.ok(bottomRight.y <= minimapBounds.height);
    });
  });

  describe('mapMinimapToGraph (round-trip)', function () {
    it('should be inverse of mapGraphToMinimap', function () {
      const graphBounds = { minX: -100, maxX: 100, minY: -50, maxY: 50 };
      const originalX = 30;
      const originalY = -20;

      const minimap = mapGraphToMinimap(originalX, originalY, graphBounds, minimapBounds);
      const roundTrip = mapMinimapToGraph(minimap.x, minimap.y, graphBounds, minimapBounds);

      assert.ok(Math.abs(roundTrip.x - originalX) < 0.001);
      assert.ok(Math.abs(roundTrip.y - originalY) < 0.001);
    });
  });

  describe('computeViewportIndicator', function () {
    it('should produce rect with width > 0 and height > 0', function () {
      const graphBounds = { minX: -200, maxX: 200, minY: -150, maxY: 150 };
      const rect = computeViewportIndicator(800, 600, 1.5, 0, 0, graphBounds, minimapBounds);
      assert.ok(rect.width > 0);
      assert.ok(rect.height > 0);
    });

    it('should produce rect with dimensions <= minimap size', function () {
      const graphBounds = { minX: -200, maxX: 200, minY: -150, maxY: 150 };
      const rect = computeViewportIndicator(800, 600, 0.5, 0, 0, graphBounds, minimapBounds);
      assert.ok(rect.width <= minimapBounds.width);
      assert.ok(rect.height <= minimapBounds.height);
    });
  });

  describe('shouldShowMinimap', function () {
    it('should return true when >= 15 nodes and enabled', function () {
      assert.equal(shouldShowMinimap(15, true), true);
      assert.equal(shouldShowMinimap(30, true), true);
    });

    it('should return false when < 15 nodes', function () {
      assert.equal(shouldShowMinimap(14, true), false);
      assert.equal(shouldShowMinimap(0, true), false);
    });

    it('should always return false when setting disabled', function () {
      assert.equal(shouldShowMinimap(15, false), false);
      assert.equal(shouldShowMinimap(100, false), false);
      assert.equal(shouldShowMinimap(0, false), false);
    });
  });

  describe('clampDragPosition', function () {
    it('should clamp coordinates to within bounds', function () {
      const result = clampDragPosition(-10, 200, minimapBounds);
      assert.equal(result.x, 0);
      assert.equal(result.y, 100);
    });

    it('should not modify coordinates already within bounds', function () {
      const result = clampDragPosition(75, 50, minimapBounds);
      assert.equal(result.x, 75);
      assert.equal(result.y, 50);
    });
  });
});
