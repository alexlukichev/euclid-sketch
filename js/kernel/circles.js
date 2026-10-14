/**
 * Euclid Sketch — Apollonius Tangent Circles Solvers
 */
(function (Geo) {
  'use strict';

  var vec = Geo.kernel.vec;
  var prim = Geo.kernel.primitives;
  var EPS = Geo.EPS;

  // 3x3 linear system solver using Cramer's rule: A * [x, y, z]^T = b
  function solve3x3(A, b) {
    function det3(m) {
      return (
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
        m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
        m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
      );
    }

    var D = det3(A);
    if (Math.abs(D) < 1e-11) return null;

    var Ax = [
      [b[0], A[0][1], A[0][2]],
      [b[1], A[1][1], A[1][2]],
      [b[2], A[2][1], A[2][2]]
    ];
    var Ay = [
      [A[0][0], b[0], A[0][2]],
      [A[1][0], b[1], A[1][2]],
      [A[2][0], b[2], A[2][2]]
    ];
    var Az = [
      [A[0][0], A[0][1], b[0]],
      [A[1][0], A[1][1], b[1]],
      [A[2][0], A[2][1], b[2]]
    ];

    return {
      x: det3(Ax) / D,
      y: det3(Ay) / D,
      z: det3(Az) / D
    };
  }

  // Solve real quadratic a*x^2 + b*x + c = 0
  function solveQuadratic(a, b, c) {
    if (Math.abs(a) < 1e-10) {
      if (Math.abs(b) < 1e-10) return [];
      return [-c / b];
    }
    var disc = b * b - 4 * a * c;
    if (disc < -1e-10) return [];
    if (disc < 0) disc = 0;
    var sqrtD = Math.sqrt(disc);
    if (sqrtD < 1e-11) {
      return [-b / (2 * a)];
    }
    var r1 = (-b - sqrtD) / (2 * a);
    var r2 = (-b + sqrtD) / (2 * a);
    return r1 < r2 ? [r1, r2] : [r2, r1];
  }

  var circles = {
    // Tangent to 3 carrier lines (LLL)
    // Up to 4 solutions: incircle and 3 excircles
    tangent3Lines: function (l1, l2, l3) {
      if (!l1 || !l2 || !l3) return [];
      var results = [];
      // 4 independent sign vectors fixing sigma1 = +1
      var signs = [
        [1, 1, 1],
        [1, 1, -1],
        [1, -1, 1],
        [1, -1, -1]
      ];

      for (var s = 0; s < signs.length; s++) {
        var sig = signs[s];
        // Equations: sig[i] * (n_i * C - c_i) = r
        // => sig[i]*n_i.x * Cx + sig[i]*n_i.y * Cy - r = sig[i]*c_i
        var A = [
          [sig[0] * l1.n.x, sig[0] * l1.n.y, -1],
          [sig[1] * l2.n.x, sig[1] * l2.n.y, -1],
          [sig[2] * l3.n.x, sig[2] * l3.n.y, -1]
        ];
        var b = [
          sig[0] * l1.c,
          sig[1] * l2.c,
          sig[2] * l3.c
        ];

        var sol = solve3x3(A, b);
        if (sol && Math.abs(sol.z) > EPS) {
          results.push({
            branch: s,
            circle: { O: { x: sol.x, y: sol.y }, r: Math.abs(sol.z) }
          });
        }
      }
      return results;
    },

    // Through 2 points (p, q) and tangent to carrier line L (PPL)
    // Up to 2 solutions
    tangent2Points1Line: function (p, q, line) {
      if (!p || !q || !line) return [];
      var d = vec.dist(p, q);
      if (d < EPS) return [];

      var M = vec.midpoint(p, q);
      var dirPQ = vec.sub(q, p);
      var uPQ = vec.normalize(dirPQ);
      var nBisect = vec.perp(uPQ); // Perpendicular bisector direction
      var h = d * 0.5;

      var g0 = vec.dot(line.n, M) - line.c;
      var g1 = vec.dot(line.n, nBisect);

      // (1 - g1^2) * s^2 - 2 * g0 * g1 * s + (h^2 - g0^2) = 0
      var a = 1 - g1 * g1;
      var b = -2 * g0 * g1;
      var c = h * h - g0 * g0;

      var roots = solveQuadratic(a, b, c);
      var results = [];

      for (var i = 0; i < roots.length; i++) {
        var s = roots[i];
        var C = vec.add(M, vec.scale(nBisect, s));
        var r = vec.dist(C, p);
        if (r > EPS) {
          results.push({
            branch: i,
            circle: { O: C, r: r }
          });
        }
      }
      return results;
    },

    // Through 1 point (p) and tangent to 2 lines L1, L2 (PLL)
    // Up to 4 solutions
    tangent1Point2Lines: function (p, l1, l2) {
      if (!p || !l1 || !l2) return [];
      var results = [];

      // Angle bisectors between L1 and L2:
      // (n1 +/- n2) * C - (c1 +/- c2) = 0
      var signs = [1, -1];
      var branchIdx = 0;

      for (var k = 0; k < signs.length; k++) {
        var s = signs[k];
        var nBisect = {
          x: l1.n.x + s * l2.n.x,
          y: l1.n.y + s * l2.n.y
        };
        var lenNB = vec.len(nBisect);
        if (lenNB < EPS) continue; // Parallel lines with opposite signs
        var nNorm = { x: nBisect.x / lenNB, y: nBisect.y / lenNB };
        var cNorm = (l1.c + s * l2.c) / lenNB;

        // Parametrize bisector: C(t) = B0 + t * w
        var w = vec.perp(nNorm);
        var B0 = vec.scale(nNorm, cNorm);

        var a0 = vec.dot(l1.n, B0) - l1.c;
        var a1 = vec.dot(l1.n, w);

        var delta = vec.sub(B0, p);
        var A = 1 - a1 * a1;
        var B = 2 * (vec.dot(w, delta) - a0 * a1);
        var C_val = vec.lenSq(delta) - a0 * a0;

        var roots = solveQuadratic(A, B, C_val);
        for (var rIdx = 0; rIdx < roots.length; rIdx++) {
          var t = roots[rIdx];
          var C = vec.add(B0, vec.scale(w, t));
          var r = Math.abs(vec.dot(l1.n, C) - l1.c);
          if (r > EPS) {
            results.push({
              branch: branchIdx++,
              circle: { O: C, r: r }
            });
          }
        }
      }
      return results;
    }
  };

  Geo.kernel.circles = circles;
})(window.Geo);
