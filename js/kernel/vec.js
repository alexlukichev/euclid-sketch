/**
 * Euclid Sketch — 2D Vector Operations
 */
(function (Geo) {
  'use strict';

  var EPS = Geo.EPS;

  var vec = {
    create: function (x, y) {
      return { x: x || 0, y: y || 0 };
    },

    clone: function (v) {
      return { x: v.x, y: v.y };
    },

    add: function (a, b) {
      return { x: a.x + b.x, y: a.y + b.y };
    },

    sub: function (a, b) {
      return { x: a.x - b.x, y: a.y - b.y };
    },

    scale: function (v, s) {
      return { x: v.x * s, y: v.y * s };
    },

    dot: function (a, b) {
      return a.x * b.x + a.y * b.y;
    },

    cross: function (a, b) {
      return a.x * b.y - a.y * b.x;
    },

    lenSq: function (v) {
      return v.x * v.x + v.y * v.y;
    },

    len: function (v) {
      return Math.sqrt(v.x * v.x + v.y * v.y);
    },

    distSq: function (a, b) {
      var dx = a.x - b.x;
      var dy = a.y - b.y;
      return dx * dx + dy * dy;
    },

    dist: function (a, b) {
      return Math.sqrt(vec.distSq(a, b));
    },

    normalize: function (v) {
      var l = vec.len(v);
      if (l < EPS) return null;
      return { x: v.x / l, y: v.y / l };
    },

    perp: function (v) {
      // 90 deg counter-clockwise rotation (-y, x)
      return { x: -v.y, y: v.x };
    },

    rot: function (v, rad) {
      var cos = Math.cos(rad);
      var sin = Math.sin(rad);
      return {
        x: v.x * cos - v.y * sin,
        y: v.x * sin + v.y * cos
      };
    },

    lerp: function (a, b, t) {
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
      };
    },

    midpoint: function (a, b) {
      return {
        x: (a.x + b.x) * 0.5,
        y: (a.y + b.y) * 0.5
      };
    },

    equals: function (a, b, tol) {
      var t = tol || EPS;
      return Math.abs(a.x - b.x) <= t && Math.abs(a.y - b.y) <= t;
    },

    angle: function (v) {
      return Math.atan2(v.y, v.x);
    },

    angleBetween: function (u, v) {
      // Returns counter-clockwise angle from u to v in [0, 2pi)
      var a = Math.atan2(v.y, v.x) - Math.atan2(u.y, u.x);
      while (a < 0) a += 2 * Math.PI;
      while (a >= 2 * Math.PI) a -= 2 * Math.PI;
      return a;
    }
  };

  Geo.kernel.vec = vec;
})(window.Geo);
