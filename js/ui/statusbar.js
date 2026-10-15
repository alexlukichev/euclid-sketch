/**
 * Euclid Sketch — Status Bar Controller
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

  var camera = Geo.view.camera;
  var measure = Geo.model.measure;

  var statusbar = {
    hintEl: null,

    init: function () {
      this.hintEl = document.getElementById('status-hint');
      var coordsEl = document.getElementById('status-coords');
      var refEl = document.getElementById('status-ref');
      var zoomEl = document.getElementById('status-zoom');
      var self = this;

      if (refEl) {
        refEl.onclick = function () {
          Geo.tools.controller.activate('set_reference');
        };
      }

      function updateReference() {
        if (!refEl) return;
        if (measure.hasReference()) {
          refEl.textContent = 'Ref: ' + measure.reference.value + ' ' + (measure.reference.unit || '');
          refEl.classList.add('has-ref');
        } else {
          refEl.textContent = 'No reference';
          refEl.classList.remove('has-ref');
        }
      }

      function updateZoom() {
        if (!zoomEl) return;
        zoomEl.textContent = Math.round(camera.scale) + '%';
      }

      Geo.events.on('camera:changed', function () {
        updateZoom();
      });

      Geo.events.on('reference:changed', function () {
        updateReference();
      });

      Geo.events.on('cursor:move', function (screenPt) {
        if (!coordsEl) return;
        var worldPt = camera.screenToWorld(screenPt);
        var refX = measure.worldToRefUnits(worldPt.x, Geo.model.graph.objectsById);
        var refY = measure.worldToRefUnits(worldPt.y, Geo.model.graph.objectsById);

        if (refX !== null && refY !== null) {
          coordsEl.textContent = 'x ' + measure.formatDistance(refX) + '   y ' + measure.formatDistance(refY);
        } else {
          coordsEl.textContent = 'x ' + worldPt.x.toFixed(2) + '   y ' + worldPt.y.toFixed(2);
        }
      });

      Geo.events.on('tool:prompt', function (data) {
        self.setPrompt(data ? (data.prompt || data.toolName || '') : '');
      });

      updateReference();
      updateZoom();
    },

    setPrompt: function (text) {
      if (!this.hintEl) {
        this.hintEl = document.getElementById('status-hint');
      }
      if (this.hintEl) {
        this.hintEl.textContent = text || '';
      }
    }
  };

  Geo.ui.statusbar = statusbar;
})(window.Geo);
