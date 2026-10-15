/**
 * Euclid Sketch — Toolbar & Tool Rail Controller
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

  var controller = Geo.tools.controller;
  var camera = Geo.view.camera;
  var graph = Geo.model.graph;
  var io = Geo.io;

  var toolbar = {
    init: function () {
      this.bindToolRail();
      this.bindTopBar();
      this.bindPromptChip();

      Geo.events.on('tool:activated', function (data) {
        toolbar.updateActiveToolButton(data.id);
      });
    },

    bindToolRail: function () {
      var buttons = document.querySelectorAll('.tool-btn');
      buttons.forEach(function (btn) {
        var toolId = btn.getAttribute('data-tool');
        btn.onclick = function () {
          if (toolId) {
            controller.activate(toolId);
          }
        };
      });
    },

    updateActiveToolButton: function (activeToolId) {
      var buttons = document.querySelectorAll('.tool-btn');
      buttons.forEach(function (btn) {
        if (btn.getAttribute('data-tool') === activeToolId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    },

    bindTopBar: function () {
      // Undo / Redo
      var btnUndo = document.getElementById('btn-undo');
      var btnRedo = document.getElementById('btn-redo');
      if (btnUndo) btnUndo.onclick = function () { Geo.history.undo(); };
      if (btnRedo) btnRedo.onclick = function () { Geo.history.redo(); };

      // Snap toggle
      var btnSnap = document.getElementById('btn-snap-toggle');
      if (btnSnap) {
        btnSnap.onclick = function () {
          var next = !controller.snappingEnabled;
          controller.setSnappingEnabled(next);
          if (next) btnSnap.classList.add('active');
          else btnSnap.classList.remove('active');
        };
      }

      // Grid toggle
      var btnGrid = document.getElementById('btn-grid-toggle');
      if (btnGrid) {
        btnGrid.onclick = function () {
          Geo.view.mainPainter.showGrid = !Geo.view.mainPainter.showGrid;
          if (Geo.view.mainPainter.showGrid) btnGrid.classList.add('active');
          else btnGrid.classList.remove('active');
          Geo.events.emit('canvas:requestRender');
        };
      }

      // Zoom controls
      var btnZoomIn = document.getElementById('btn-zoom-in');
      var btnZoomOut = document.getElementById('btn-zoom-out');
      var btnZoomReset = document.getElementById('btn-zoom-reset');
      var btnZoomFit = document.getElementById('btn-zoom-fit');

      if (btnZoomIn) btnZoomIn.onclick = function () { camera.zoomAtScreenPoint(1.2); };
      if (btnZoomOut) btnZoomOut.onclick = function () { camera.zoomAtScreenPoint(0.8333); };
      if (btnZoomReset) btnZoomReset.onclick = function () { camera.resetZoom(); };
      if (btnZoomFit) btnZoomFit.onclick = function () { camera.zoomToFit(graph.objects); };

      // Theme toggle
      var btnTheme = document.getElementById('btn-theme-toggle');
      if (btnTheme) {
        btnTheme.onclick = function () {
          var cur = document.documentElement.getAttribute('data-theme') || 'light';
          var next = cur === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', next);
          Geo.events.emit('canvas:requestRender');
        };
      }

      // Help shortcuts
      var btnHelp = document.getElementById('btn-help');
      if (btnHelp) {
        btnHelp.onclick = function () {
          Geo.ui.dialogs.showShortcuts();
        };
      }

      // File operations
      var btnSave = document.getElementById('btn-file-save');
      var btnOpen = document.getElementById('btn-file-open');
      var btnClear = document.getElementById('btn-clear');
      var fileInput = document.getElementById('file-input-open');
      var btnExportPng = document.getElementById('btn-export-png');
      var btnExportSvg = document.getElementById('btn-export-svg');

      if (btnSave) btnSave.onclick = function () { io.saveToFile('euclid_diagram.json'); };
      if (btnOpen && fileInput) {
        btnOpen.onclick = function () { fileInput.click(); };
        fileInput.onchange = function (e) {
          if (e.target.files && e.target.files[0]) {
            io.openFromFile(e.target.files[0], function () {
              Geo.events.emit('canvas:requestRender');
            });
          }
        };
      }
      if (btnClear) {
        btnClear.onclick = function () {
          toolbar.clearCanvas();
        };
      }
      if (btnExportPng) btnExportPng.onclick = function () { io.exportPNG(2, 'diagram.png'); };
      if (btnExportSvg) btnExportSvg.onclick = function () { io.exportSVG('diagram.svg'); };
    },

    clearCanvas: function () {
      if (Geo.tools.selection) {
        Geo.tools.selection.clear();
      }
      if (controller.activeTool && typeof controller.activeTool.reset === 'function') {
        controller.activeTool.reset();
      }
      graph.clear();
      Geo.history.snapshot();
      Geo.events.emit('canvas:requestRender');
    },

    bindPromptChip: function () {
      var chip = document.getElementById('prompt-chip');
      var nameEl = chip ? chip.querySelector('.chip-tool-name') : null;
      var promptEl = chip ? chip.querySelector('.chip-prompt-text') : null;
      var btnCancel = chip ? chip.querySelector('.chip-cancel') : null;

      if (btnCancel) {
        btnCancel.onclick = function () {
          controller.stepBack();
        };
      }

      Geo.events.on('tool:prompt', function (data) {
        if (!chip) return;
        if (!data.prompt) {
          chip.style.display = 'none';
        } else {
          chip.style.display = 'flex';
          if (nameEl) nameEl.textContent = data.toolName + (data.totalSteps > 1 ? ' (' + data.step + '/' + data.totalSteps + ')' : '');
          if (promptEl) promptEl.textContent = data.prompt;
        }
      });
    }
  };

  Geo.ui.toolbar = toolbar;
})(window.Geo);
