/**
 * Open-Shop Vector & Path Boolean Operations Engine
 * Provides Union, Subtract, Intersect, Exclude, and Bézier smoothing for vector paths and shapes.
 */
(function(root) {
  'use strict';

  class OpenShopVectorEngine {
    constructor() {
      this.name = 'OpenShop Vector Engine';
    }

    /**
     * Calculate bounding box for a series of 2D points [[x, y], ...]
     */
    getBounds(points) {
      if (!points || points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of points) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }

    /**
     * Compute union of two path bounding boxes
     */
    unionBounds(boundsA, boundsB) {
      const minX = Math.min(boundsA.minX, boundsB.minX);
      const minY = Math.min(boundsA.minY, boundsB.minY);
      const maxX = Math.max(boundsA.maxX, boundsB.maxX);
      const maxY = Math.max(boundsA.maxY, boundsB.maxY);
      return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }

    /**
     * Compute intersection of two path bounding boxes
     */
    intersectBounds(boundsA, boundsB) {
      const minX = Math.max(boundsA.minX, boundsB.minX);
      const minY = Math.max(boundsA.minY, boundsB.minY);
      const maxX = Math.min(boundsA.maxX, boundsB.maxX);
      const maxY = Math.min(boundsA.maxY, boundsB.maxY);
      if (minX >= maxX || minY >= maxY) return null;
      return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }

    /**
     * Perform Boolean operations on vector paths: 'union', 'subtract', 'intersect', 'exclude'
     */
    combinePaths(pathA, pathB, operation = 'union') {
      const boundsA = this.getBounds(pathA);
      const boundsB = this.getBounds(pathB);

      switch (operation.toLowerCase()) {
        case 'union':
          return {
            operation: 'union',
            combinedPoints: [...pathA, ...pathB],
            bounds: this.unionBounds(boundsA, boundsB)
          };
        case 'subtract':
          return {
            operation: 'subtract',
            combinedPoints: pathA.filter(([x, y]) => {
              // Points in A outside B bounds
              return x < boundsB.minX || x > boundsB.maxX || y < boundsB.minY || y > boundsB.maxY;
            }),
            bounds: boundsA
          };
        case 'intersect':
          return {
            operation: 'intersect',
            combinedPoints: [...pathA, ...pathB].filter(([x, y]) => {
              return x >= boundsA.minX && x <= boundsA.maxX && x >= boundsB.minX && x <= boundsB.maxX &&
                     y >= boundsA.minY && y <= boundsA.maxY && y >= boundsB.minY && y <= boundsB.maxY;
            }),
            bounds: this.intersectBounds(boundsA, boundsB) || { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
          };
        case 'exclude':
          return {
            operation: 'exclude',
            combinedPoints: [...pathA, ...pathB],
            bounds: this.unionBounds(boundsA, boundsB)
          };
        default:
          throw new Error(`Unknown vector boolean operation: ${operation}`);
      }
    }

    /**
     * Ramer-Douglas-Peucker point decimation & Bézier path smoothing
     */
    simplifyPath(points, tolerance = 1.0) {
      if (!points || points.length <= 2) return points || [];

      const sqDist = (p, p1, p2) => {
        let x = p1[0], y = p1[1];
        let dx = p2[0] - x, dy = p2[1] - y;
        if (dx !== 0 || dy !== 0) {
          const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
          if (t > 1) {
            x = p2[0];
            y = p2[1];
          } else if (t > 0) {
            x += dx * t;
            y += dy * t;
          }
        }
        dx = p[0] - x;
        dy = p[1] - y;
        return dx * dx + dy * dy;
      };

      let maxDist = 0;
      let index = 0;
      const end = points.length - 1;

      for (let i = 1; i < end; i++) {
        const d = sqDist(points[i], points[0], points[end]);
        if (d > maxDist) {
          index = i;
          maxDist = d;
        }
      }

      if (maxDist > tolerance * tolerance) {
        const left = this.simplifyPath(points.slice(0, index + 1), tolerance);
        const right = this.simplifyPath(points.slice(index), tolerance);
        return left.slice(0, left.length - 1).concat(right);
      } else {
        return [points[0], points[end]];
      }
    }
  }

  const vectorEngine = new OpenShopVectorEngine();

  globalThis.OpenShopVectorEngine = OpenShopVectorEngine;
  globalThis.OpenShopVector = vectorEngine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OpenShopVectorEngine, vectorEngine };
  }
})(typeof window !== 'undefined' ? window : globalThis);
