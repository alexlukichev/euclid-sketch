/**
 * Euclid Sketch — Intersections Kernel (Carrier Line Semantics)
 *
 * Copyright 2026 Alexander Lukichev
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
(function (Geo) {
  'use strict';

  var vec = Geo.kernel.vec;
  var prim = Geo.kernel.primitives;
  var EPS = Geo.EPS;

  var intersect = {
    // Intersection of two carrier lines
    lineLine: function (l1, l2) {
      if (!l1 || !l2) return null;
      var det = l1.n.x * l2.n.y - l1.n.y * l2.n.x;
      if (Math.abs(det) < EPS) return null; // Parallel or coincident

      var x = (l1.c * l2.n.y - l2.c * l1.n.y) / det;
      var y = (l1.n.x * l2.c - l2.n.x * l1.c) / det;
      return { x: x, y: y };
    },

    // Intersection of a carrier line and a circle (O, r)
    // Returns array of 0, 1, or 2 points, sorted along line.d
    lineCircle: function (line, circle) {
      if (!line || !circle || circle.r < EPS) return [];

      var foot = prim.projectPointToLine(circle.O, line);
      var d = vec.dist(circle.O, foot);
      var tol = 1e-7;

      if (d > circle.r + tol) return []; // Disjoint

      if (Math.abs(d - circle.r) <= tol) {
        // Tangent
        return [foot];
      }

      var hSq = circle.r * circle.r - d * d;
      if (hSq <= 1e-12) return [foot];

      var h = Math.sqrt(Math.max(0, hSq));
      if (h < 1e-6) return [foot];

      var p1 = vec.sub(foot, vec.scale(line.d, h));
      var p2 = vec.add(foot, vec.scale(line.d, h));

      if (vec.dist(p1, p2) < 1e-6) return [foot];

      // Branch 0 is foot - h*d, Branch 1 is foot + h*d
      return [p1, p2];
    },

    // Intersection of two circles (O1, r1) and (O2, r2)
    // Returns array of 0, 1, or 2 points
    circleCircle: function (c1, c2) {
      if (!c1 || !c2 || c1.r < EPS || c2.r < EPS) return [];

      var D = vec.dist(c1.O, c2.O);
      if (D < EPS) return []; // Concentric

      var tol = 1e-7;
      if (D > c1.r + c2.r + tol || D < Math.abs(c1.r - c2.r) - tol) {
        return []; // Separated or one inside another without touching
      }

      var a = (D * D + c1.r * c1.r - c2.r * c2.r) / (2 * D);
      var hSq = c1.r * c1.r - a * a;
      if (hSq < 0 && hSq > -tol) hSq = 0;
      if (hSq < 0) return [];

      var h = Math.sqrt(hSq);

      var dir = vec.sub(c2.O, c1.O);
      var u = vec.normalize(dir);
      if (!u) return [];
      var perp = vec.perp(u);

      var M = vec.add(c1.O, vec.scale(u, a));

      if (h < 1e-6 || Math.abs(D - (c1.r + c2.r)) <= tol || Math.abs(D - Math.abs(c1.r - c2.r)) <= tol) {
        // Tangent
        return [M];
      }

      var p1 = vec.add(M, vec.scale(perp, h)); // Branch 0: left
      var p2 = vec.sub(M, vec.scale(perp, h)); // Branch 1: right

      if (vec.dist(p1, p2) < 1e-6) return [M];

      return [p1, p2];
    }
  };

  Geo.kernel.intersect = intersect;
})(window.Geo);
