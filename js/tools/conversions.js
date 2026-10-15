/**
 * Euclid Sketch — Primitive Conversion Tools (Line <-> Segment, Line <-> Ray)
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

  // --- Line <-> Segment Conversion (2) ---
  Geo.tools.register({
    id: 'convert_segment',
    name: 'Line ↔ Segment',
    steps: [
      { accept: 'linear', prompt: 'Select a line or segment to toggle extent' }
    ],
    commit: function (picks) {
      if (picks.length < 1) return;
      var obj = picks[0];
      if (obj.type !== 'line') return;

      if (obj.extent === 'segment') {
        obj.extent = 'line';
      } else {
        obj.extent = 'segment';
      }
      graph.recomputeAll();
      Geo.events.emit('history:snapshot');
    }
  });

  // --- Line <-> Ray Conversion (3) ---
  Geo.tools.register({
    id: 'convert_ray',
    name: 'Line ↔ Ray',
    steps: [
      { accept: 'linear', prompt: 'Select a line or ray to toggle extent' }
    ],
    commit: function (picks) {
      if (picks.length < 1) return;
      var obj = picks[0];
      if (obj.type !== 'line') return;

      if (obj.extent === 'ray') {
        obj.extent = 'line';
      } else {
        obj.extent = 'ray';
      }
      graph.recomputeAll();
      Geo.events.emit('history:snapshot');
    }
  });
})(window.Geo);
