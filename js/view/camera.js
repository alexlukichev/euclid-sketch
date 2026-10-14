/**
 * Euclid Sketch — Camera & Viewport Transformations
 */
(function (Geo) {
  'use strict';

  function Camera() {
    this.cx = 0;        // World x at canvas center
    this.cy = 0;        // World y at canvas center
    this.scale = 100;   // Pixels per world unit (100 px = 1 unit at 100% zoom)
    this.width = 800;   // CSS pixels
    this.height = 600;  // CSS pixels
    this.minScale = 5;  // 5% zoom
    this.maxScale = 5000; // 5000% zoom
  }

  Camera.prototype = {
    setSize: function (w, h) {
      this.width = w;
      this.height = h;
    },

    worldToScreen: function (p) {
      if (!p) return { x: 0, y: 0 };
      return {
        x: (p.x - this.cx) * this.scale + this.width * 0.5,
        y: (this.cy - p.y) * this.scale + this.height * 0.5
      };
    },

    screenToWorld: function (p) {
      if (!p) return { x: 0, y: 0 };
      return {
        x: this.cx + (p.x - this.width * 0.5) / this.scale,
        y: this.cy - (p.y - this.height * 0.5) / this.scale
      };
    },

    worldDistToScreen: function (d) {
      return d * this.scale;
    },

    screenDistToWorld: function (d) {
      return d / this.scale;
    },

    panByScreenDelta: function (dx, dy) {
      this.cx -= dx / this.scale;
      this.cy += dy / this.scale; // Inverted because y-axis is up in world
      Geo.events.emit('camera:changed');
    },

    zoomAtScreenPoint: function (factor, screenPt) {
      var pt = screenPt || { x: this.width * 0.5, y: this.height * 0.5 };
      var worldBefore = this.screenToWorld(pt);

      var newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
      if (Math.abs(newScale - this.scale) < 1e-5) return;

      this.scale = newScale;
      // Re-anchor so world point remains at screen point
      this.cx = worldBefore.x - (pt.x - this.width * 0.5) / this.scale;
      this.cy = worldBefore.y + (pt.y - this.height * 0.5) / this.scale;

      Geo.events.emit('camera:changed');
    },

    resetZoom: function () {
      this.scale = 100;
      Geo.events.emit('camera:changed');
    },

    zoomToFit: function (objects) {
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      var count = 0;

      function include(p) {
        if (!p) return;
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        count++;
      }

      for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];
        if (!obj._geom || !obj.visible) continue;
        if (obj.type === 'point') {
          include(obj._geom);
        } else if (obj.type === 'line' && obj.extent === 'segment') {
          include(obj._geom.P0);
          include(obj._geom.P1);
        } else if (obj.type === 'circle') {
          include({ x: obj._geom.O.x - obj._geom.r, y: obj._geom.O.y - obj._geom.r });
          include({ x: obj._geom.O.x + obj._geom.r, y: obj._geom.O.y + obj._geom.r });
        } else if (obj.type === 'polygon' && obj._geom.vertices) {
          for (var v = 0; v < obj._geom.vertices.length; v++) {
            include(obj._geom.vertices[v]);
          }
        }
      }

      if (count === 0) {
        this.cx = 0;
        this.cy = 0;
        this.scale = 100;
        Geo.events.emit('camera:changed');
        return;
      }

      var pad = 60; // Padding in screen pixels
      var spanX = Math.max(1, maxX - minX);
      var spanY = Math.max(1, maxY - minY);

      var scaleX = (this.width - pad * 2) / spanX;
      var scaleY = (this.height - pad * 2) / spanY;
      var fitScale = Math.min(scaleX, scaleY);

      this.scale = Math.max(this.minScale, Math.min(500, fitScale));
      this.cx = (minX + maxX) * 0.5;
      this.cy = (minY + maxY) * 0.5;

      Geo.events.emit('camera:changed');
    }
  };

  Geo.view.Camera = Camera;
  Geo.view.camera = new Camera();
})(window.Geo);
