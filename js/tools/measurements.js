/**
 * Euclid Sketch — Measurement Tools (Set Reference, Distance, Angle, Circle Measure)
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
  var measure = Geo.model.measure;

  // --- Set Reference Segment Tool (M0) ---
  Geo.tools.register({
    id: 'set_reference',
    name: 'Set Reference Segment',
    steps: [
      { accept: 'segment', prompt: 'Select a segment to establish as the unit reference' }
    ],
    commit: function (picks) {
      if (picks.length < 1) return;
      var seg = picks[0];

      Geo.events.emit('dialog:reference', {
        title: 'Set Reference Segment',
        currentSeg: seg,
        onConfirm: function (val, unit) {
          var num = parseFloat(val);
          if (isNaN(num) || num <= 0) return;
          measure.setReference(seg.id, num, unit);
          graph.recomputeAll();
          Geo.events.emit('canvas:requestRender');
        }
      });
    }
  });

  // --- Distance / Length Measure Tool (M1) ---
  Geo.tools.register({
    id: 'measure_dist',
    name: 'Distance / Length',
    key: 'd',
    steps: [
      { accept: 'any', prompt: 'Select segment, point, or line' },
      { accept: 'any', prompt: 'Select second element (if first was a point)' }
    ],
    onPointerDown: function (screenPt, snapTarget, evt) {
      // 1-click on segment
      var hitList = Geo.view.hittest.hitTest(screenPt, graph.objects, 8);
      if (hitList.length > 0 && hitList[0].object.type === 'line' && hitList[0].object.extent === 'segment') {
        var seg = hitList[0].object;
        if (!measure.hasReference()) {
          Geo.events.emit('reference:required', { action: 'Distance measurement' });
          return true;
        }
        var mObj = objects.createMeasure({ kind: 'length', seg: seg.id });
        graph.add(mObj);
        Geo.events.emit('history:snapshot');
        return true;
      }
      return false;
    },
    commit: function (picks) {
      if (!measure.hasReference()) {
        Geo.events.emit('reference:required', { action: 'Distance measurement' });
        return;
      }

      if (picks.length === 1 && picks[0].type === 'line' && picks[0].extent === 'segment') {
        var mSeg = objects.createMeasure({ kind: 'length', seg: picks[0].id });
        graph.add(mSeg);
      } else if (picks.length === 2) {
        if (picks[0].type === 'point' && picks[1].type === 'point') {
          var mPP = objects.createMeasure({ kind: 'distPP', p: picks[0].id, q: picks[1].id });
          graph.add(mPP);
        } else if (picks[0].type === 'point' && picks[1].type === 'line') {
          var mPL = objects.createMeasure({ kind: 'distPL', p: picks[0].id, line: picks[1].id });
          graph.add(mPL);
        } else if (picks[0].type === 'line' && picks[1].type === 'point') {
          var mLP = objects.createMeasure({ kind: 'distPL', p: picks[1].id, line: picks[0].id });
          graph.add(mLP);
        }
      }
    }
  });

  // --- Angle Measure Tool (M2) ---
  Geo.tools.register({
    id: 'measure_angle',
    name: 'Measure Angle',
    steps: [
      { accept: 'any', prompt: 'Select an existing angle, or 1st point' },
      { accept: 'point', prompt: 'Select vertex' },
      { accept: 'point', prompt: 'Select 2nd arm point' }
    ],
    onPointerDown: function (screenPt, snapTarget, evt) {
      var hitList = Geo.view.hittest.hitTest(screenPt, graph.objects, 8);
      if (hitList.length > 0 && hitList[0].object.type === 'angle') {
        var ang = hitList[0].object;
        ang.style.showMeasure = true;
        graph.recomputeAll();
        Geo.events.emit('canvas:requestRender');
        return true;
      }
      return false;
    },
    commit: function (picks) {
      if (picks.length === 1 && picks[0].type === 'angle') {
        picks[0].style.showMeasure = true;
        graph.recomputeAll();
      } else if (picks.length === 3 && picks[0].type === 'point' && picks[1].type === 'point' && picks[2].type === 'point') {
        var angLabel = Geo.model.labels.nextAvailableLabel('angle', graph.objects);
        var newAng = objects.createAngle({
          kind: 'threePoints',
          a: picks[0].id,
          vertex: picks[1].id,
          b: picks[2].id
        }, angLabel, { showMeasure: true });
        graph.add(newAng);
      }
    }
  });

  // --- Circle Measure Tool (M3) ---
  Geo.tools.register({
    id: 'measure_circle',
    name: 'Measure Circle',
    steps: [
      { accept: 'circle', prompt: 'Select circle to display radius, diameter, or area' }
    ],
    commit: function (picks) {
      if (picks.length < 1) return;
      if (!measure.hasReference()) {
        Geo.events.emit('reference:required', { action: 'Circle metric measurement' });
        return;
      }
      var cObj = picks[0];
      var mCirc = objects.createMeasure({ kind: 'circle', circle: cObj.id, what: 'r' });
      graph.add(mCirc);
    }
  });
})(window.Geo);
