/**
 * Euclid Sketch — Geometric Primitives Tools (Point, Line, Ray, Segment, Angle)
 */
(function (Geo) {
  'use strict';

  var graph = Geo.model.graph;
  var objects = Geo.model.objects;
  var labels = Geo.model.labels;

  // --- Point Tool ---
  Geo.tools.register({
    id: 'point',
    name: 'Point',
    key: 'p',
    steps: [
      { accept: 'point', prompt: 'Click to place or snap a point' }
    ],
    commit: function (picks) {
      // Handled by tool framework
    }
  });

  // --- Line Tool (Infinite) ---
  Geo.tools.register({
    id: 'line',
    name: 'Line',
    key: 'l',
    steps: [
      { accept: 'point', prompt: 'Select or place first point on line' },
      { accept: 'point', prompt: 'Select or place second point on line' }
    ],
    preview: function (picks, snapTarget) {
      if (picks.length === 1 && snapTarget) {
        return {
          type: 'line',
          extent: 'line',
          p0: picks[0]._geom,
          p1: snapTarget.point
        };
      }
      return null;
    },
    commit: function (picks) {
      if (picks.length < 2) return;
      var line = objects.createLine({
        kind: 'twoPoints',
        p: picks[0].id,
        q: picks[1].id
      }, 'line', '');
      graph.add(line);
    }
  });

  // --- Ray Tool ---
  Geo.tools.register({
    id: 'ray',
    name: 'Ray',
    key: 'r',
    steps: [
      { accept: 'point', prompt: 'Select or place origin of ray' },
      { accept: 'point', prompt: 'Select or place point along ray' }
    ],
    preview: function (picks, snapTarget) {
      if (picks.length === 1 && snapTarget) {
        return {
          type: 'line',
          extent: 'ray',
          p0: picks[0]._geom,
          p1: snapTarget.point
        };
      }
      return null;
    },
    commit: function (picks) {
      if (picks.length < 2) return;
      var ray = objects.createLine({
        kind: 'twoPoints',
        p: picks[0].id,
        q: picks[1].id
      }, 'ray', '');
      graph.add(ray);
    }
  });

  // --- Segment Tool ---
  Geo.tools.register({
    id: 'segment',
    name: 'Segment',
    key: 's',
    steps: [
      { accept: 'point', prompt: 'Select or place first endpoint of segment' },
      { accept: 'point', prompt: 'Select or place second endpoint of segment' }
    ],
    preview: function (picks, snapTarget) {
      if (picks.length === 1 && snapTarget) {
        return {
          type: 'line',
          extent: 'segment',
          p0: picks[0]._geom,
          p1: snapTarget.point
        };
      }
      return null;
    },
    commit: function (picks) {
      if (picks.length < 2) return;
      // Segments have no label by default unless assigned
      var seg = objects.createLine({
        kind: 'twoPoints',
        p: picks[0].id,
        q: picks[1].id
      }, 'segment', '');
      graph.add(seg);
    }
  });

  // --- Angle Tool ---
  Geo.tools.register({
    id: 'angle',
    name: 'Angle',
    key: 'a',
    steps: [
      { accept: 'point', prompt: 'Select first point on first arm' },
      { accept: 'point', prompt: 'Select vertex of angle' },
      { accept: 'point', prompt: 'Select point on second arm' }
    ],
    preview: function (picks, snapTarget) {
      if (picks.length === 1 && snapTarget && snapTarget.point && picks[0]._geom) {
        return {
          type: 'line',
          extent: 'segment',
          p0: picks[0]._geom,
          p1: snapTarget.point
        };
      }
      if (picks.length === 2 && snapTarget && snapTarget.point && picks[0]._geom && picks[1]._geom) {
        return {
          type: 'angle',
          a: picks[0]._geom,
          v: picks[1]._geom,
          b: snapTarget.point
        };
      }
      return null;
    },
    commit: function (picks) {
      if (picks.length < 3) return;
      var label = labels.nextAvailableLabel('angle', graph.objects);
      var ang = objects.createAngle({
        kind: 'threePoints',
        a: picks[0].id,
        vertex: picks[1].id,
        b: picks[2].id
      }, label);
      graph.add(ang);
    }
  });
})(window.Geo);
