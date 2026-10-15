/**
 * Euclid Sketch — Pole and Polar Calculations
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
  var EPS = Geo.EPS;

  var polar = {
    // Polar line of point P with respect to circle (O, r)
    // Equation: (X - O) . (P - O) = r^2
    polarOfPoint: function (p, circle) {
      if (!p || !circle || circle.r < EPS) return null;
      var d = vec.sub(p, circle.O);
      var dist = vec.len(d);
      if (dist < EPS) return null; // Center has no polar (line at infinity)

      var n = { x: d.x / dist, y: d.y / dist };
      var u = vec.perp(n);
      var c = vec.dot(n, circle.O) + (circle.r * circle.r) / dist;

      // Anchor point on the polar line
      var P_anchor = vec.add(circle.O, vec.scale(n, (circle.r * circle.r) / dist));

      return {
        P: P_anchor,
        d: u,
        n: n,
        c: c
      };
    },

    // Pole point of carrier line (n, c) with respect to circle (O, r)
    // Formula: P = O + (r^2 / delta) * n, where delta = c - n . O
    poleOfLine: function (line, circle) {
      if (!line || !circle || circle.r < EPS) return null;
      var delta = line.c - vec.dot(line.n, circle.O);
      if (Math.abs(delta) < EPS) return null; // Line passes through circle center (pole at infinity)

      var offset = (circle.r * circle.r) / delta;
      return vec.add(circle.O, vec.scale(line.n, offset));
    }
  };

  Geo.kernel.polar = polar;
})(window.Geo);
