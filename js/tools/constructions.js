/**
 * Euclid Sketch — Geometric Construction Tools (Altitude, Parallel, Midpoint, Polar, Pole, etc.)
 */
(function (Geo) {
  'use strict';

  var graph = Geo.model.graph;
  var objects = Geo.model.objects;
  var labels = Geo.model.labels;
  var vec = Geo.kernel.vec;
  var prim = Geo.kernel.primitives;

  // --- Altitude Tool (1) ---
  Geo.tools.register({
    id: 'altitude',
    name: 'Altitude',
    key: 't',
    steps: [
      { accept: 'point', prompt: 'Select vertex point for altitude' },
      { accept: 'linear', prompt: 'Select line, ray, or segment' }
    ],
    commit: function (picks) {
      if (picks.length < 2) return;
      var pt = picks[0];
      var ln = picks[1];

      // Create foot point
      var footLabel = labels.nextAvailableLabel('point', graph.objects, 'H');
      var footPt = objects.createPoint({
        kind: 'foot',
        point: pt.id,
        line: ln.id
      }, footLabel);
      graph.add(footPt);

      // Create altitude segment
      var altSeg = objects.createLine({
        kind: 'twoPoints',
        p: pt.id,
        q: footPt.id
      }, 'segment', '');
      graph.add(altSeg);
    }
  });

  // --- Parallel Line Tool (8) ---
  Geo.tools.register({
    id: 'parallel',
    name: 'Parallel Line',
    steps: [
      { accept: 'linear', prompt: 'Select reference line, ray, or segment' },
      { accept: 'point', prompt: 'Select point through which parallel passes' }
    ],
    commit: function (picks) {
      if (picks.length < 2) return;
      var parLine = objects.createLine({
        kind: 'parallel',
        line: picks[0].id,
        point: picks[1].id
      }, 'line', '');
      graph.add(parLine);
    }
  });

  // --- Midpoint Tool (7) ---
  Geo.tools.register({
    id: 'midpoint',
    name: 'Midpoint',
    key: 'm',
    steps: [
      { accept: 'any', prompt: 'Select a segment or first point' },
      { accept: 'any', prompt: 'Select second point (if first was a point)' }
    ],
    onPointerDown: function (screenPt, snapTarget, evt) {
      // Allow 1-click on segment
      var hitList = Geo.view.hittest.hitTest(screenPt, graph.objects, 8);
      if (hitList.length > 0 && hitList[0].object.type === 'line' && hitList[0].object.extent === 'segment') {
        var seg = hitList[0].object;
        var mLabel = labels.nextAvailableLabel('point', graph.objects, 'M');
        var midPt = objects.createPoint({
          kind: 'midpoint',
          seg: seg.id
        }, mLabel);
        graph.add(midPt);
        Geo.events.emit('history:snapshot');
        return true;
      }
      return false;
    },
    commit: function (picks) {
      if (picks.length === 1 && picks[0].type === 'line' && picks[0].extent === 'segment') {
        var mLabel1 = labels.nextAvailableLabel('point', graph.objects, 'M');
        var mid1 = objects.createPoint({ kind: 'midpoint', seg: picks[0].id }, mLabel1);
        graph.add(mid1);
      } else if (picks.length === 2 && picks[0].type === 'point' && picks[1].type === 'point') {
        var mLabel2 = labels.nextAvailableLabel('point', graph.objects, 'M');
        var mid2 = objects.createPoint({ kind: 'midpoint', p: picks[0].id, q: picks[1].id }, mLabel2);
        graph.add(mid2);
      }
    }
  });

  // --- Circle Center Tool (13) ---
  Geo.tools.register({
    id: 'circle_center',
    name: 'Circle Center',
    key: 'o',
    steps: [
      { accept: 'circle', prompt: 'Select circle to construct center' }
    ],
    commit: function (picks) {
      if (picks.length < 1) return;
      var cLabel = labels.nextAvailableLabel('point', graph.objects, 'O');
      var cenPt = objects.createPoint({
        kind: 'center',
        circle: picks[0].id
      }, cLabel);
      graph.add(cenPt);
    }
  });

  // --- Polar of Point Tool (11) ---
  Geo.tools.register({
    id: 'polar',
    name: 'Polar of Point',
    steps: [
      { accept: 'circle', prompt: 'Select circle' },
      { accept: 'point', prompt: 'Select point' }
    ],
    commit: function (picks) {
      if (picks.length < 2) return;
      var polarLine = objects.createLine({
        kind: 'polar',
        circle: picks[0].id,
        point: picks[1].id
      }, 'line', '');
      graph.add(polarLine);
    }
  });

  // --- Pole of Line Tool (12) ---
  Geo.tools.register({
    id: 'pole',
    name: 'Pole of Line',
    steps: [
      { accept: 'circle', prompt: 'Select circle' },
      { accept: 'linear', prompt: 'Select line, ray, or segment' }
    ],
    commit: function (picks) {
      if (picks.length < 2) return;
      var pLabel = labels.nextAvailableLabel('point', graph.objects, 'P');
      var polePt = objects.createPoint({
        kind: 'pole',
        circle: picks[0].id,
        line: picks[1].id
      }, pLabel);
      graph.add(polePt);
    }
  });

  // --- Point on Line Tool (9) ---
  Geo.tools.register({
    id: 'point_on_line',
    name: 'Point on Line',
    steps: [
      { accept: 'linear', prompt: 'Click along a line, ray, or segment to place constrained point' }
    ],
    onPointerDown: function (screenPt, snapTarget, evt) {
      if (snapTarget && snapTarget.kind === 'onObject' && snapTarget.targetObj && snapTarget.targetObj.type === 'line') {
        var pLabel = labels.nextAvailableLabel('point', graph.objects);
        var pt = objects.createPoint({
          kind: 'onLine',
          line: snapTarget.targetObj.id,
          t: snapTarget.t
        }, pLabel);
        graph.add(pt);
        Geo.events.emit('history:snapshot');
        return true;
      }
      return false;
    }
  });

  // --- Point on Primitive Tool (14) ---
  Geo.tools.register({
    id: 'point_on_primitive',
    name: 'Point on Primitive',
    steps: [
      { accept: 'curve', prompt: 'Click along any curve or circle to place sliding point' }
    ],
    onPointerDown: function (screenPt, snapTarget, evt) {
      if (snapTarget && snapTarget.kind === 'onObject' && snapTarget.targetObj) {
        var pLabel = labels.nextAvailableLabel('point', graph.objects);
        var pt = objects.createPoint({
          kind: 'onObject',
          obj: snapTarget.targetObj.id,
          t: snapTarget.t
        }, pLabel);
        graph.add(pt);
        Geo.events.emit('history:snapshot');
        return true;
      }
      return false;
    }
  });

  // --- Intersection Tool (10) ---
  Geo.tools.register({
    id: 'intersection',
    name: 'Intersection',
    key: 'i',
    steps: [
      { accept: 'curve', prompt: 'Select first curve (or click intersection crossing)' },
      { accept: 'curve', prompt: 'Select second curve' }
    ],
    onPointerDown: function (screenPt, snapTarget, evt) {
      // 1-click on crossing
      if (snapTarget && snapTarget.kind === 'intersection') {
        var existing = graph.findExistingPoint(snapTarget.point);
        if (!existing) {
          var pLabel = labels.nextAvailableLabel('point', graph.objects);
          var pt = objects.createPoint({
            kind: 'intersection',
            a: snapTarget.parentA.id,
            b: snapTarget.parentB.id,
            branch: snapTarget.branch
          }, pLabel);
          graph.add(pt);
          Geo.events.emit('history:snapshot');
        }
        return true;
      }
      return false;
    },
    commit: function (picks) {
      if (picks.length < 2) return;
      var a = picks[0];
      var b = picks[1];
      if (!a || !b || !a._geom || !b._geom) return;

      var inter = Geo.kernel.intersect;
      var vec = Geo.kernel.vec;
      var interPts = [];

      if (a.type === 'line' && b.type === 'line') {
        var pLL = inter.lineLine(a._geom, b._geom);
        if (pLL) interPts.push(pLL);
      } else if (a.type === 'line' && b.type === 'circle') {
        interPts = inter.lineCircle(a._geom, b._geom);
      } else if (a.type === 'circle' && b.type === 'line') {
        interPts = inter.lineCircle(b._geom, a._geom);
      } else if (a.type === 'circle' && b.type === 'circle') {
        interPts = inter.circleCircle(a._geom, b._geom);
      }

      if (interPts.length === 0) {
        if (Geo.ui && Geo.ui.statusbar) {
          Geo.ui.statusbar.setPrompt('Selected objects do not intersect.');
        }
        return;
      }

      // If two points are essentially coincident (tangent case), keep only one
      if (interPts.length === 2 && vec.dist(interPts[0], interPts[1]) < 1e-5) {
        interPts = [interPts[0]];
      }

      var addedAny = false;
      for (var i = 0; i < interPts.length; i++) {
        var existing = graph.findExistingPoint(interPts[i], 1e-5);
        if (!existing) {
          var pLabel = labels.nextAvailableLabel('point', graph.objects);
          var pt = objects.createPoint({
            kind: 'intersection',
            a: a.id,
            b: b.id,
            branch: i
          }, pLabel);
          graph.add(pt);
          addedAny = true;
        }
      }

      if (!addedAny && Geo.ui && Geo.ui.statusbar) {
        Geo.ui.statusbar.setPrompt('Intersection point(s) already exist.');
      }
    }
  });

  // --- Delete Tool (X) ---
  Geo.tools.register({
    id: 'delete',
    name: 'Delete Object',
    key: 'x',
    defaultPrompt: 'Click any object to delete it.',
    steps: [
      { accept: 'any', prompt: 'Click any object to delete it' }
    ],
    onPointerDown: function (screenPt, snapTarget, evt) {
      var hits = Geo.view.hittest.hitTest(screenPt, graph.objects, 8);
      if (hits.length > 0) {
        var obj = hits[0].object;
        var labelStr = (obj.label && obj.label.text) ? ' (' + obj.label.text + ')' : '';
        graph.remove(obj.id);
        Geo.events.emit('history:snapshot');
        Geo.events.emit('canvas:requestRender');
        if (Geo.ui && Geo.ui.statusbar) {
          Geo.ui.statusbar.setPrompt('Deleted ' + obj.type + labelStr + '. Click another object to delete.');
        }
        return true;
      }
      return true;
    }
  });

  // --- Angle Bisector Tool (B) ---
  Geo.tools.register({
    id: 'angle_bisector',
    name: 'Angle Bisector',
    key: 'b',
    steps: [
      { accept: 'point', prompt: 'Select point on first arm' },
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
    solutions: function (picks) {
      if (picks.length !== 3) return null;
      var pA = picks[0]._geom;
      var pV = picks[1]._geom;
      var pB = picks[2]._geom;
      if (!pA || !pV || !pB) return null;
      var vec = Geo.kernel.vec;
      var EPS = Geo.EPS;
      var u1 = vec.normalize(vec.sub(pA, pV));
      var u2 = vec.normalize(vec.sub(pB, pV));
      if (!u1 || !u2) return null;
      var w = vec.add(u1, u2);
      var bDir = (vec.len(w) < EPS) ? vec.perp(u1) : vec.normalize(w);
      if (!bDir) return null;

      return [
        {
          branch: 0,
          type: 'ray',
          name: 'Interior Bisector',
          origin: pV,
          dir: bDir
        },
        {
          branch: 1,
          type: 'ray',
          name: 'Opposite Bisector',
          origin: pV,
          dir: vec.scale(bDir, -1)
        }
      ];
    },
    commit: function (picks, branch) {
      if (picks.length < 3) return;
      var pA = picks[0];
      var pV = picks[1];
      var pB = picks[2];
      var bisRay = objects.createLine({
        kind: 'bisector',
        a: pA.id,
        vertex: pV.id,
        b: pB.id,
        direction: (branch === 1) ? 1 : 0
      }, 'ray', '');
      graph.add(bisRay);
    }
  });

  // --- Perpendicular Bisector Tool (E) ---
  var perpBisectorTool = {
    id: 'perp_bisector',
    name: 'Perpendicular Bisector',
    key: 'e',
    steps: [
      { accept: 'point', prompt: 'Select or place first point' },
      { accept: 'point', prompt: 'Select or place second point' }
    ],
    preview: function (picks, snapTarget) {
      if (picks.length === 1 && snapTarget && snapTarget.point && picks[0]._geom) {
        var p1 = picks[0]._geom;
        var p2 = snapTarget.point;
        var l = prim.perpendicularBisector(p1, p2);
        if (!l) return null;
        return {
          type: 'line',
          extent: 'line',
          p0: l.P,
          p1: vec.add(l.P, l.d)
        };
      }
      return null;
    },
    commit: function (picks) {
      if (picks.length < 2) return;
      var pbLine = objects.createLine({
        kind: 'perpendicularBisector',
        p: picks[0].id,
        q: picks[1].id
      }, 'line', '');
      graph.add(pbLine);
    }
  };

  Geo.tools.register(perpBisectorTool);

  // Register alias under 'perpendicular_bisector' for programmatic access
  var perpBisectorAlias = {};
  for (var k in perpBisectorTool) {
    if (perpBisectorTool.hasOwnProperty(k)) perpBisectorAlias[k] = perpBisectorTool[k];
  }
  perpBisectorAlias.id = 'perpendicular_bisector';
  perpBisectorAlias.key = null;
  Geo.tools.register(perpBisectorAlias);
})(window.Geo);
