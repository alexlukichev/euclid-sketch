/**
 * Euclid Sketch — Geometric Primitives Kernel
 */
(function (Geo) {
  'use strict';

  var vec = Geo.kernel.vec;
  var EPS = Geo.EPS;

  var primitives = {
    // Line representation: { P: originPoint, d: unitDirection, n: unitNormal, c: offset }
    // Normal equation: n.x * X + n.y * Y = c
    createLineFromTwoPoints: function (p1, p2) {
      var d = vec.sub(p2, p1);
      var len = vec.len(d);
      if (len < EPS) return null;
      var u = { x: d.x / len, y: d.y / len };
      var n = vec.perp(u);
      var c = vec.dot(n, p1);
      return { P: { x: p1.x, y: p1.y }, d: u, n: n, c: c };
    },

    createLineFromPointAndDir: function (p, dir) {
      var u = vec.normalize(dir);
      if (!u) return null;
      var n = vec.perp(u);
      var c = vec.dot(n, p);
      return { P: { x: p.x, y: p.y }, d: u, n: n, c: c };
    },

    createLineFromPointAndNormal: function (p, normal) {
      var n = vec.normalize(normal);
      if (!n) return null;
      var u = { x: n.y, y: -n.x }; // perp of n in reverse
      var c = vec.dot(n, p);
      return { P: { x: p.x, y: p.y }, d: u, n: n, c: c };
    },

    signedDistPointToLine: function (p, line) {
      return vec.dot(line.n, p) - line.c;
    },

    distPointToLine: function (p, line) {
      return Math.abs(primitives.signedDistPointToLine(p, line));
    },

    projectPointToLine: function (p, line) {
      var sDist = primitives.signedDistPointToLine(p, line);
      return vec.sub(p, vec.scale(line.n, sDist));
    },

    // Parameter t such that Foot = P + t * d
    paramOnLine: function (p, line) {
      return vec.dot(vec.sub(p, line.P), line.d);
    },

    pointAtParamOnLine: function (line, t) {
      return vec.add(line.P, vec.scale(line.d, t));
    },

    // Parallel line through a given point
    parallelLineThroughPoint: function (line, point) {
      var c = vec.dot(line.n, point);
      return {
        P: { x: point.x, y: point.y },
        d: { x: line.d.x, y: line.d.y },
        n: { x: line.n.x, y: line.n.y },
        c: c
      };
    },

    // Perpendicular line through a given point
    perpendicularLineThroughPoint: function (line, point) {
      var n = { x: -line.d.x, y: -line.d.y };
      var u = { x: line.n.x, y: line.n.y };
      var c = vec.dot(n, point);
      return {
        P: { x: point.x, y: point.y },
        d: u,
        n: n,
        c: c
      };
    },

    // Perpendicular bisector between two points (p1, p2)
    perpendicularBisector: function (p1, p2) {
      var d = vec.sub(p2, p1);
      var len = vec.len(d);
      if (len < EPS) return null;
      var mid = vec.scale(vec.add(p1, p2), 0.5);
      var perpDir = vec.perp(d);
      return primitives.createLineFromPointAndDir(mid, perpDir);
    },

    // Circumcircle through 3 points (A, B, C)
    circumcircle: function (A, B, C) {
      var D = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
      if (Math.abs(D) < EPS) return null; // Collinear

      var aSq = A.x * A.x + A.y * A.y;
      var bSq = B.x * B.x + B.y * B.y;
      var cSq = C.x * C.x + C.y * C.y;

      var ox = (aSq * (B.y - C.y) + bSq * (C.y - A.y) + cSq * (A.y - B.y)) / D;
      var oy = (aSq * (C.x - B.x) + bSq * (A.x - C.x) + cSq * (B.x - A.x)) / D;
      var O = { x: ox, y: oy };
      var r = vec.dist(O, A);

      return { O: O, r: r };
    },

    // Circle from center and point on circle
    circleCenterPoint: function (center, p) {
      var r = vec.dist(center, p);
      if (r < EPS) return null;
      return { O: { x: center.x, y: center.y }, r: r };
    },

    // Circle from center and tangent line
    circleCenterTangent: function (center, line) {
      var r = primitives.distPointToLine(center, line);
      if (r < EPS) return null;
      return { O: { x: center.x, y: center.y }, r: r };
    },

    // Rectangle corner generation given carrier line, anchor point on line,
    // side lengths a, b (in world units), and quadrant sign factors su, sv (+1 or -1)
    rectangleCorners: function (line, p, a, b, su, sv) {
      var u = vec.scale(line.d, (su >= 0 ? 1 : -1));
      var v = vec.scale(line.n, (sv >= 0 ? 1 : -1));

      var p0 = { x: p.x, y: p.y };
      var p1 = vec.add(p0, vec.scale(u, a));
      var p2 = vec.add(p1, vec.scale(v, b));
      var p3 = vec.add(p0, vec.scale(v, b));

      return [p0, p1, p2, p3];
    }
  };

  Geo.kernel.primitives = primitives;
})(window.Geo);
