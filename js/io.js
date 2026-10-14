/**
 * Euclid Sketch — Import, Export & Persistence Manager
 */
(function (Geo) {
  'use strict';

  var graph = Geo.model.graph;
  var camera = Geo.view.camera;
  var painterSvg = Geo.view.painterSvg;

  var autosaveTimer = null;
  var STORAGE_KEY = 'euclid-sketch:autosave';

  var io = {
    initAutosave: function () {
      Geo.events.on('io:autosave', function () {
        if (autosaveTimer) clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(function () {
          try {
            var docStr = JSON.stringify(graph.toJSON());
            localStorage.setItem(STORAGE_KEY, docStr);
          } catch (e) {
            // localStorage might be unavailable or full
          }
        }, 800);
      });
    },

    loadAutosave: function () {
      try {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          var parsed = JSON.parse(saved);
          if (parsed && parsed.format === 'euclid-sketch') {
            graph.fromJSON(parsed);
            Geo.history.undoStack = [saved];
            return true;
          }
        }
      } catch (e) {
        console.warn('Could not restore autosave', e);
      }
      return false;
    },

    saveToFile: function (filename) {
      var name = filename || 'diagram.euclid.json';
      var doc = graph.toJSON();
      var jsonStr = JSON.stringify(doc, null, 2);
      var blob = new Blob([jsonStr], { type: 'application/json' });
      var url = URL.createObjectURL(blob);

      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    openFromFile: function (file, callback) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (evt) {
        try {
          var doc = JSON.parse(evt.target.result);
          graph.fromJSON(doc);
          Geo.history.undoStack = [JSON.stringify(doc)];
          Geo.history.redoStack = [];
          if (callback) callback(null);
        } catch (err) {
          console.error('Failed to parse file', err);
          if (callback) callback(err);
        }
      };
      reader.readAsText(file);
    },

    exportPNG: function (scaleFactor, filename) {
      var factor = scaleFactor || 2;
      var name = filename || 'diagram.png';
      var offCanvas = document.createElement('canvas');
      offCanvas.width = Math.round(camera.width * factor);
      offCanvas.height = Math.round(camera.height * factor);

      var painter = new Geo.view.PainterCanvas(offCanvas);
      painter.dpr = factor;
      painter.renderScene(graph.objects, {}, null, null, null, null);

      offCanvas.toBlob(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    },

    exportSVG: function (filename) {
      var name = filename || 'diagram.svg';
      var svgStr = painterSvg.exportToSvgString(graph.objects, camera.width, camera.height);
      var blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);

      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  Geo.io = io;
})(window.Geo);
