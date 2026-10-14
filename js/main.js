/**
 * Euclid Sketch — Main Application Bootstrap & Event Loop
 */
(function (Geo) {
  'use strict';

  var graph = Geo.model.graph;
  var camera = Geo.view.camera;
  var controller = Geo.tools.controller;

  var canvas = null;
  var painter = null;
  var renderRequested = false;

  var isSpaceDown = false;
  var isPanning = false;
  var panStart = { x: 0, y: 0 };

  function requestRender() {
    if (!renderRequested) {
      renderRequested = true;
      requestAnimationFrame(function () {
        renderRequested = false;
        if (painter) {
          painter.renderScene(
            graph.objects,
            Geo.tools.selection ? Geo.tools.selection.selectedIds : {},
            controller.hoverObject,
            controller.picks.map(function (o) { return o.id; }),
            controller.previewGeom,
            controller.snapTarget
          );
        }
      });
    }
  }

  function initCanvas() {
    canvas = document.getElementById('geometry-canvas');
    if (!canvas) return;

    painter = new Geo.view.PainterCanvas(canvas);
    Geo.view.mainPainter = painter;

    var container = canvas.parentElement;
    var resizeObserver = new ResizeObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var rect = entries[i].contentRect;
        painter.resize(rect.width, rect.height);
        requestRender();
      }
    });
    resizeObserver.observe(container);

    // Initial size
    painter.resize(container.clientWidth || 800, container.clientHeight || 600);

    // Pointer events
    canvas.addEventListener('pointerdown', function (e) {
      canvas.setPointerCapture(e.pointerId);
      var rect = canvas.getBoundingClientRect();
      var screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      // Space + drag or middle mouse button -> pan
      if (isSpaceDown || e.button === 1) {
        isPanning = true;
        panStart = screenPt;
        canvas.style.cursor = 'grabbing';
        return;
      }

      controller.onPointerDown(screenPt, e);
      requestRender();
    });

    canvas.addEventListener('pointermove', function (e) {
      var rect = canvas.getBoundingClientRect();
      var screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      Geo.events.emit('cursor:move', screenPt);

      if (isPanning) {
        var dx = screenPt.x - panStart.x;
        var dy = screenPt.y - panStart.y;
        panStart = screenPt;
        camera.panByScreenDelta(dx, dy);
        requestRender();
        return;
      }

      controller.onPointerMove(screenPt, e);
      requestRender();
    });

    canvas.addEventListener('pointerup', function (e) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}

      if (isPanning) {
        isPanning = false;
        canvas.style.cursor = isSpaceDown ? 'grab' : ((controller.activeTool && controller.activeTool.cursor) || 'crosshair');
        return;
      }

      controller.onPointerUp(e);

      if (Geo.tools.selection && Geo.tools.selection.onPointerUp) {
        Geo.tools.selection.onPointerUp(e);
      }
      requestRender();
    });

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = canvas.getBoundingClientRect();
      var screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      var factor = e.deltaY < 0 ? 1.1 : 0.909;
      camera.zoomAtScreenPoint(factor, screenPt);
      requestRender();
    }, { passive: false });
  }

  function initKeyboard() {
    window.addEventListener('keydown', function (e) {
      // Don't intercept shortcut keys if typing inside input, dialog, or textarea
      var target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.code === 'Space' && !isSpaceDown) {
        isSpaceDown = true;
        if (canvas) canvas.style.cursor = 'grab';
        return;
      }

      // Check tool framework handler
      if (controller.onKeyDown(e)) {
        requestRender();
        return;
      }

      // Shortcut keys
      var key = e.key.toLowerCase();
      var isCmd = e.ctrlKey || e.metaKey;
      if (isCmd) {
        if (e.code === 'KeyZ' || key === 'z') {
          e.preventDefault();
          if (e.shiftKey) Geo.history.redo();
          else Geo.history.undo();
          return;
        }
        if (e.code === 'KeyY' || key === 'y') {
          e.preventDefault();
          Geo.history.redo();
          return;
        }
        if (e.code === 'KeyS' || key === 's') {
          e.preventDefault();
          Geo.io.saveToFile('euclid_diagram.json');
          return;
        }
        if (e.code === 'KeyO' || key === 'o') {
          e.preventDefault();
          var fileInp = document.getElementById('file-input-open');
          if (fileInp) fileInp.click();
          return;
        }
      }

      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        var tools = controller.getAll();
        for (var tId in tools) {
          if (tools[tId].key && tools[tId].key.toLowerCase() === key) {
            e.preventDefault();
            controller.activate(tId);
            return;
          }
        }
      }
    });

    window.addEventListener('keyup', function (e) {
      if (e.code === 'Space') {
        isSpaceDown = false;
        isPanning = false;
        if (canvas) canvas.style.cursor = 'crosshair';
      }
    });
  }

  function initApp() {
    initCanvas();
    initKeyboard();

    Geo.ui.toolbar.init();
    Geo.ui.infopanel.init();
    Geo.ui.statusbar.init();
    Geo.io.initAutosave();

    // Re-render listener
    Geo.events.on('canvas:requestRender', function () {
      requestRender();
    });

    Geo.events.on('camera:changed', function () {
      requestRender();
    });

    Geo.events.on('canvas:cursor', function (cur) {
      if (canvas && !isPanning && !isSpaceDown) {
        canvas.style.cursor = cur;
      }
    });

    Geo.events.on('tool:activated', function (data) {
      if (canvas && !isPanning && !isSpaceDown) {
        if (data.spec && data.spec.cursor) {
          canvas.style.cursor = data.spec.cursor;
        } else if (data.id === 'select') {
          canvas.style.cursor = 'default';
        } else {
          canvas.style.cursor = 'crosshair';
        }
      }
    });

    // Try restoring autosave or start with fresh diagram
    var restored = Geo.io.loadAutosave();
    if (!restored) {
      Geo.history.snapshot();
    }

    controller.activate('peek');
    requestRender();
  }

  window.addEventListener('DOMContentLoaded', initApp);
})(window.Geo);
