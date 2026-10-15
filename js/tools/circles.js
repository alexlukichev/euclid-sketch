/**
 * Euclid Sketch — Circle Tools (Circumcircle, Apollonius Tangent Circles, Center-based)
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

  var graph = Geo.model.graph;
  var objects = Geo.model.objects;
  var labels = Geo.model.labels;
  var prim = Geo.kernel.primitives;
  var circ = Geo.kernel.circles;

  // --- Smart Circle Tool (C) ---
  // Accepts 3 picks (points or linear objects) and determines whether
  // PPP (circumcircle), PPL, PLL, or LLL (Apollonius tangent circles).
  Geo.tools.register({
    id: 'circle',
    name: 'Circle',
    key: 'c',
    steps: [
      { accept: 'any', prompt: 'Select or place 1st element (point or line)' },
      { accept: 'any', prompt: 'Select or place 2nd element (point or line)' },
      { accept: 'any', prompt: 'Select or place 3rd element (point or line)' }
    ],

    solutions: function (picks) {
      if (picks.length < 3) return null;

      var pts = [];
      var lns = [];
      for (var i = 0; i < picks.length; i++) {
        if (picks[i].type === 'point') pts.push(picks[i]);
        else if (picks[i].type === 'line') lns.push(picks[i]);
      }

      if (pts.length === 3) {
        var cPPP = prim.circumcircle(pts[0]._geom, pts[1]._geom, pts[2]._geom);
        if (cPPP) {
          return [{ branch: 0, circle: cPPP }];
        }
        return [];
      } else if (pts.length === 2 && lns.length === 1) {
        return circ.tangent2Points1Line(pts[0]._geom, pts[1]._geom, lns[0]._geom);
      } else if (pts.length === 1 && lns.length === 2) {
        return circ.tangent1Point2Lines(pts[0]._geom, lns[0]._geom, lns[1]._geom);
      } else if (lns.length === 3) {
        return circ.tangent3Lines(lns[0]._geom, lns[1]._geom, lns[2]._geom);
      }

      return null;
    },

    commit: function (picks, chosenBranch) {
      if (picks.length < 3) return;

      var pts = [];
      var lns = [];
      for (var i = 0; i < picks.length; i++) {
        if (picks[i].type === 'point') pts.push(picks[i]);
        else if (picks[i].type === 'line') lns.push(picks[i]);
      }

      var label = labels.nextAvailableLabel('circle', graph.objects);
      var def = null;

      if (pts.length === 3) {
        def = { kind: 'threePoints', a: pts[0].id, b: pts[1].id, c: pts[2].id };
      } else if (pts.length === 2 && lns.length === 1) {
        def = { kind: 'tangent2P1L', p: pts[0].id, q: pts[1].id, line: lns[0].id, branch: chosenBranch || 0 };
      } else if (pts.length === 1 && lns.length === 2) {
        def = { kind: 'tangent1P2L', p: pts[0].id, l1: lns[0].id, l2: lns[1].id, branch: chosenBranch || 0 };
      } else if (lns.length === 3) {
        def = { kind: 'tangent3L', l1: lns[0].id, l2: lns[1].id, l3: lns[2].id, branch: chosenBranch || 0 };
      }

      if (def) {
        var circle = objects.createCircle(def, label);
        graph.add(circle);
      }
    }
  });

  // --- Center + Point Circle ---
  Geo.tools.register({
    id: 'circle_cp',
    name: 'Circle: Center & Point',
    steps: [
      { accept: 'point', prompt: 'Select center point' },
      { accept: 'point', prompt: 'Select point on circumference' }
    ],
    commit: function (picks) {
      if (picks.length < 2) return;
      var label = labels.nextAvailableLabel('circle', graph.objects);
      var circle = objects.createCircle({
        kind: 'centerPoint',
        center: picks[0].id,
        p: picks[1].id
      }, label);
      graph.add(circle);
    }
  });

  // --- Center + Tangent Line Circle ---
  Geo.tools.register({
    id: 'circle_ct',
    name: 'Circle: Center & Tangent',
    steps: [
      { accept: 'point', prompt: 'Select center point' },
      { accept: 'linear', prompt: 'Select tangent line, ray, or segment' }
    ],
    commit: function (picks) {
      if (picks.length < 2) return;
      var label = labels.nextAvailableLabel('circle', graph.objects);
      var circle = objects.createCircle({
        kind: 'centerTangent',
        center: picks[0].id,
        line: picks[1].id
      }, label);
      graph.add(circle);
    }
  });

  // --- Circle by 3 Tangent Lines (LLL) ---
  Geo.tools.register({
    id: 'circle_3l',
    name: 'Circle: 3 Tangent Lines',
    steps: [
      { accept: 'linear', prompt: 'Select 1st tangent line, ray, or segment' },
      { accept: 'linear', prompt: 'Select 2nd tangent line, ray, or segment' },
      { accept: 'linear', prompt: 'Select 3rd tangent line, ray, or segment' }
    ],
    solutions: function (picks) {
      if (picks.length < 3) return null;
      return circ.tangent3Lines(picks[0]._geom, picks[1]._geom, picks[2]._geom);
    },
    commit: function (picks, chosenBranch) {
      if (picks.length < 3) return;
      var label = labels.nextAvailableLabel('circle', graph.objects);
      var circle = objects.createCircle({
        kind: 'tangent3L',
        l1: picks[0].id,
        l2: picks[1].id,
        l3: picks[2].id,
        branch: chosenBranch || 0
      }, label);
      graph.add(circle);
    }
  });
})(window.Geo);
