/**
 * Euclid Sketch — Canvas2D Renderer
 */
(function (Geo) {
  'use strict';

  var vec = Geo.kernel.vec;
  var camera = Geo.view.camera;
  var labels = Geo.model.labels;
  var measure = Geo.model.measure;

  var PALETTE = {
    ink: '#1C2230',
    blue: '#2F6FEB',
    red: '#D3352B',
    green: '#1E8E3E',
    orange: '#E8710A',
    purple: '#8E44AD',
    teal: '#00897B',
    gray: '#7A8494'
  };

  // Liang-Barsky 2D line clipping to rectangle [0, 0, W, H]
  // extent: 'line' (both directions), 'ray' (starts at P0, extends towards P1), 'segment' (P0 to P1)
  function clipGeometry(x0, y0, x1, y1, w, h, extent) {
    var dx = x1 - x0;
    var dy = y1 - y0;
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;

    var p = [-dx, dx, -dy, dy];
    var q = [x0, w - x0, y0, h - y0];
    var u1 = (extent === 'line') ? -1e6 : 0;
    var u2 = (extent === 'segment') ? 1 : 1e6;

    for (var i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-9) {
        if (q[i] < 0) return null;
      } else {
        var t = q[i] / p[i];
        if (p[i] < 0) {
          if (t > u1) u1 = t;
        } else {
          if (t < u2) u2 = t;
        }
      }
    }

    if (u1 > u2) return null;

    return {
      x0: x0 + u1 * dx,
      y0: y0 + u1 * dy,
      x1: x0 + u2 * dx,
      y1: y0 + u2 * dy
    };
  }

  function PainterCanvas(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.theme = 'light';
    this.showGrid = false;
  }

  PainterCanvas.prototype = {
    resize: function (w, h) {
      this.dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      camera.setSize(w, h);
    },

    getColor: function (key) {
      return PALETTE[key] || PALETTE.ink;
    },

    clear: function () {
      var ctx = this.ctx;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      ctx.fillStyle = isDark ? '#111418' : '#FFFFFF';
      ctx.fillRect(0, 0, camera.width, camera.height);

      if (this.showGrid) {
        this.drawGrid(isDark);
      }
      ctx.restore();
    },

    drawGrid: function (isDark) {
      var ctx = this.ctx;
      var dotColor = isDark ? '#262C35' : '#DADEE4';
      ctx.fillStyle = dotColor;

      var step = 1; // 1 world unit
      var screenStep = camera.scale * step;
      while (screenStep < 24) screenStep *= 2;
      while (screenStep > 96) screenStep /= 2;

      var startWorld = camera.screenToWorld({ x: 0, y: camera.height });
      var endWorld = camera.screenToWorld({ x: camera.width, y: 0 });

      var minX = Math.floor(startWorld.x);
      var maxX = Math.ceil(endWorld.x);
      var minY = Math.floor(startWorld.y);
      var maxY = Math.ceil(endWorld.y);

      for (var x = minX; x <= maxX; x++) {
        for (var y = minY; y <= maxY; y++) {
          var sp = camera.worldToScreen({ x: x, y: y });
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 1.25, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },

    // Render entire scene
    renderScene: function (objects, selectionMap, hoverObj, pickedList, previewGeom, snapTarget) {
      this.clear();
      var ctx = this.ctx;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      var haloSelect = isDark ? 'rgba(91,141,239,0.35)' : 'rgba(47,111,235,0.28)';
      var haloHover = isDark ? 'rgba(91,141,239,0.18)' : 'rgba(47,111,235,0.14)';
      var haloPick = isDark ? 'rgba(245,146,60,0.40)' : 'rgba(232,113,10,0.35)';

      // 1. Draw Halos for selection, hover, picked
      for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];
        if (!obj._geom || !obj.visible) continue;
        var isSel = selectionMap && selectionMap[obj.id];
        var isHov = hoverObj && hoverObj.id === obj.id;
        var isPik = pickedList && pickedList.indexOf(obj.id) !== -1;

        if (isPik) {
          this.drawObjectHalo(obj, haloPick, 8);
        } else if (isSel) {
          this.drawObjectHalo(obj, haloSelect, 8);
        } else if (isHov) {
          this.drawObjectHalo(obj, haloHover, 6);
        }
      }

      // 2. Polygon fills
      for (var p = 0; p < objects.length; p++) {
        if (objects[p].type === 'polygon' && objects[p].visible && objects[p]._geom) {
          this.drawPolygonFill(objects[p]);
        }
      }

      // 3. Angle sectors
      for (var a = 0; a < objects.length; a++) {
        if (objects[a].type === 'angle' && objects[a].visible && objects[a]._geom) {
          this.drawAngle(objects[a]);
        }
      }

      // 4. Circles
      for (var c = 0; c < objects.length; c++) {
        if (objects[c].type === 'circle' && objects[c].visible && objects[c]._geom) {
          this.drawCircle(objects[c]);
        }
      }

      // 5. Lines, Rays, Segments
      for (var l = 0; l < objects.length; l++) {
        if (objects[l].type === 'line' && objects[l].visible && objects[l]._geom) {
          this.drawLine(objects[l]);
        }
      }

      // 6. Polygon boundary strokes
      for (var pb = 0; pb < objects.length; pb++) {
        if (objects[pb].type === 'polygon' && objects[pb].visible && objects[pb]._geom) {
          this.drawPolygonBoundary(objects[pb]);
        }
      }

      // 7. Points
      for (var pt = 0; pt < objects.length; pt++) {
        if (objects[pt].type === 'point' && objects[pt].visible && objects[pt]._geom) {
          this.drawPoint(objects[pt]);
        }
      }

      // 8. Labels
      for (var lb = 0; lb < objects.length; lb++) {
        var lObj = objects[lb];
        if (lObj.visible && lObj._geom && lObj.label && lObj.label.visible && lObj.label.text) {
          this.drawLabel(lObj, isDark);
        }
      }

      // 9. Preview geometry
      if (previewGeom) {
        this.drawPreview(previewGeom);
      }

      // 10. Snap indicator
      if (snapTarget && snapTarget.screenPt) {
        this.drawSnapIndicator(snapTarget);
      }

      ctx.restore();
    },

    drawPoint: function (obj) {
      var ctx = this.ctx;
      var sP = camera.worldToScreen(obj._geom);
      var r = obj.style.size || 4.5;
      var color = this.getColor(obj.style.color);

      var isFree = obj.def && obj.def.kind === 'free';
      var isOnObj = obj.def && (obj.def.kind === 'onObject' || obj.def.kind === 'onLine');

      ctx.beginPath();
      ctx.arc(sP.x, sP.y, r, 0, Math.PI * 2);

      if (isFree) {
        ctx.fillStyle = '#2F6FEB'; // Accent for free points
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (isOnObj) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#2F6FEB';
        ctx.lineWidth = 2.0;
        ctx.stroke();
      } else {
        // Dependent point
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    },

    drawLine: function (obj) {
      var ctx = this.ctx;
      var geom = obj._geom;
      var color = this.getColor(obj.style.color);
      var width = obj.style.width || 2;
      var isRef = measure.reference && measure.reference.segId === obj.id;

      if (isRef) {
        color = '#C98A0B'; // Ref color gold/amber
        width = Math.max(width, 3);
      }

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (obj.style.dash === 'dashed') ctx.setLineDash([6, 4]);
      else if (obj.style.dash === 'dotted') ctx.setLineDash([2, 3]);
      else ctx.setLineDash([]);

      var sP0 = camera.worldToScreen(geom.P0);
      var sP1 = camera.worldToScreen(geom.P1);

      if (obj.extent === 'segment') {
        ctx.beginPath();
        ctx.moveTo(sP0.x, sP0.y);
        ctx.lineTo(sP1.x, sP1.y);
        ctx.stroke();

        // Draw tick marks if any
        if (obj.style.marks && obj.style.marks > 0) {
          this.drawSegmentTicks(sP0, sP1, obj.style.marks, color);
        }

        // Draw reference badge if this is reference segment
        if (isRef) {
          this.drawReferenceBadge(sP0, sP1);
        }
      } else {
        // Ray (starts at sP0, extends along sP0->sP1) or infinite Line
        var clipped = clipGeometry(sP0.x, sP0.y, sP1.x, sP1.y, camera.width, camera.height, obj.extent || 'line');
        if (clipped) {
          ctx.beginPath();
          ctx.moveTo(clipped.x0, clipped.y0);
          ctx.lineTo(clipped.x1, clipped.y1);
          ctx.stroke();
        }
      }

      ctx.restore();
    },

    drawSegmentTicks: function (p0, p1, numTicks, color) {
      var ctx = this.ctx;
      var mid = vec.midpoint(p0, p1);
      var dir = vec.normalize(vec.sub(p1, p0));
      if (!dir) return;
      var perp = vec.perp(dir);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      var tickLen = 8;
      var spacing = 3;
      var startOffset = -((numTicks - 1) * spacing) * 0.5;

      for (var i = 0; i < numTicks; i++) {
        var offset = startOffset + i * spacing;
        var center = vec.add(mid, vec.scale(dir, offset));
        var a = vec.add(center, vec.scale(perp, tickLen * 0.5));
        var b = vec.sub(center, vec.scale(perp, tickLen * 0.5));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    },

    drawReferenceBadge: function (p0, p1) {
      var ctx = this.ctx;
      var mid = vec.midpoint(p0, p1);
      var dir = vec.normalize(vec.sub(p1, p0));
      if (!dir) return;
      var perp = vec.perp(dir);
      var badgePos = vec.add(mid, vec.scale(perp, 16));

      var text = 'ref ' + measure.reference.value + (measure.reference.unit ? ' ' + measure.reference.unit : '');
      ctx.save();
      ctx.font = '600 11px system-ui, sans-serif';
      var w = ctx.measureText(text).width + 12;
      var h = 18;

      ctx.fillStyle = 'rgba(201, 138, 11, 0.15)';
      ctx.strokeStyle = '#C98A0B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgePos.x - w * 0.5, badgePos.y - h * 0.5, w, h, 9);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#C98A0B';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, badgePos.x, badgePos.y);
      ctx.restore();
    },

    drawCircle: function (obj) {
      var ctx = this.ctx;
      var geom = obj._geom;
      var sO = camera.worldToScreen(geom.O);
      var sR = camera.worldDistToScreen(geom.r);
      var color = this.getColor(obj.style.color);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = obj.style.width || 1.75;
      if (obj.style.dash === 'dashed') ctx.setLineDash([6, 4]);
      else if (obj.style.dash === 'dotted') ctx.setLineDash([2, 3]);
      else ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(sO.x, sO.y, sR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },

    drawPolygonFill: function (obj) {
      var ctx = this.ctx;
      var geom = obj._geom;
      if (!geom.vertices || geom.vertices.length < 3) return;

      var fill = obj.style.fill || 'rgba(47,111,235,0.12)';
      if (obj.style.fillEnabled === false) return;

      ctx.save();
      ctx.fillStyle = fill;
      ctx.beginPath();
      var first = camera.worldToScreen(geom.vertices[0]);
      ctx.moveTo(first.x, first.y);
      for (var i = 1; i < geom.vertices.length; i++) {
        var sp = camera.worldToScreen(geom.vertices[i]);
        ctx.lineTo(sp.x, sp.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },

    drawPolygonBoundary: function (obj) {
      var ctx = this.ctx;
      var geom = obj._geom;
      if (!geom.vertices || geom.vertices.length < 3) return;

      ctx.save();
      ctx.strokeStyle = this.getColor(obj.style.color);
      ctx.lineWidth = obj.style.width || 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      var first = camera.worldToScreen(geom.vertices[0]);
      ctx.moveTo(first.x, first.y);
      for (var i = 1; i < geom.vertices.length; i++) {
        var sp = camera.worldToScreen(geom.vertices[i]);
        ctx.lineTo(sp.x, sp.y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    },

    drawAngle: function (obj) {
      var ctx = this.ctx;
      var geom = obj._geom;
      var sV = camera.worldToScreen(geom.V);
      var color = this.getColor(obj.style.color);
      var r = 26; // Arc radius in screen pixels

      // Convert world direction angles to screen angles (screen y inverted)
      var ang1 = Math.atan2(-geom.u1.y, geom.u1.x);
      var ang2 = Math.atan2(-geom.u2.y, geom.u2.x);

      ctx.save();
      // Sector fill
      ctx.fillStyle = color.replace(')', ', 0.10)').replace('rgb', 'rgba');
      if (color.charAt(0) === '#') {
        ctx.fillStyle = 'rgba(47, 111, 235, 0.10)';
      }
      ctx.beginPath();
      ctx.moveTo(sV.x, sV.y);
      ctx.arc(sV.x, sV.y, r, ang1, ang2, false);
      ctx.closePath();
      ctx.fill();

      // Right angle marker
      var isRight = Math.abs(geom.sweep - Math.PI * 0.5) < 1e-4;
      if (isRight && obj.style.marks !== 'none') {
        var sqSize = 12;
        var u1S = { x: Math.cos(ang1), y: Math.sin(ang1) };
        var u2S = { x: Math.cos(ang2), y: Math.sin(ang2) };
        var c1 = vec.add(sV, vec.scale(u1S, sqSize));
        var c2 = vec.add(c1, vec.scale(u2S, sqSize));
        var c3 = vec.add(sV, vec.scale(u2S, sqSize));

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(c1.x, c1.y);
        ctx.lineTo(c2.x, c2.y);
        ctx.lineTo(c3.x, c3.y);
        ctx.stroke();
      } else {
        // Arc line
        ctx.strokeStyle = color;
        ctx.lineWidth = obj.style.width || 1.5;
        ctx.beginPath();
        ctx.arc(sV.x, sV.y, r, ang1, ang2, false);
        ctx.stroke();
      }
      ctx.restore();
    },

    drawLabel: function (obj, isDark) {
      var ctx = this.ctx;
      var geom = obj._geom;
      var anchorScreen = this.getLabelAnchorScreen(obj);
      if (!anchorScreen) return;

      var dx = (obj.label.dx !== undefined) ? obj.label.dx : 8;
      var dy = (obj.label.dy !== undefined) ? obj.label.dy : -10;
      var pos = { x: anchorScreen.x + dx, y: anchorScreen.y + dy };

      var parts = labels.parseLabelParts(obj.label.text);
      if (!parts) return;

      ctx.save();
      var baseFont = 'italic 16px "STIX Two Text", "STIX Two Math", Cambria, "Times New Roman", serif';
      var subFont = '11px "STIX Two Text", "STIX Two Math", Cambria, "Times New Roman", serif';
      var haloColor = isDark ? '#111418' : '#FFFFFF';
      var textColor = isDark ? '#E7EAF0' : '#1C2230';

      ctx.font = baseFont;
      var baseWidth = ctx.measureText(parts.base + parts.primes).width;

      // Halo stroke for base
      ctx.strokeStyle = haloColor;
      ctx.lineWidth = 3.5;
      ctx.strokeText(parts.base + parts.primes, pos.x, pos.y);

      // Fill base text
      ctx.fillStyle = textColor;
      ctx.fillText(parts.base + parts.primes, pos.x, pos.y);

      // Subscript if present
      if (parts.sub) {
        var subX = pos.x + baseWidth;
        var subY = pos.y + 4;
        ctx.font = subFont;
        ctx.strokeStyle = haloColor;
        ctx.lineWidth = 3;
        ctx.strokeText(parts.sub, subX, subY);
        ctx.fillStyle = textColor;
        ctx.fillText(parts.sub, subX, subY);
      }

      ctx.restore();
    },

    getLabelAnchorScreen: function (obj) {
      var geom = obj._geom;
      if (!geom) return null;

      if (obj.type === 'point') {
        return camera.worldToScreen(geom);
      }
      if (obj.type === 'line') {
        if (obj.extent === 'segment') {
          return camera.worldToScreen(vec.midpoint(geom.P0, geom.P1));
        }
        return camera.worldToScreen(geom.P0);
      }
      if (obj.type === 'circle') {
        // 45 degrees on circumference
        var p45 = {
          x: geom.O.x + geom.r * Math.cos(Math.PI * 0.25),
          y: geom.O.y + geom.r * Math.sin(Math.PI * 0.25)
        };
        return camera.worldToScreen(p45);
      }
      if (obj.type === 'angle') {
        return camera.worldToScreen(geom.V);
      }
      if (obj.type === 'polygon' && geom.vertices) {
        return camera.worldToScreen(geom.vertices[0]);
      }
      return null;
    },

    drawObjectHalo: function (obj, haloColor, pad) {
      var ctx = this.ctx;
      var geom = obj._geom;
      if (!geom) return;

      ctx.save();
      ctx.strokeStyle = haloColor;
      ctx.lineWidth = (obj.style.width || 2) + pad;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (obj.type === 'point') {
        var sP = camera.worldToScreen(geom);
        ctx.beginPath();
        ctx.arc(sP.x, sP.y, (obj.style.size || 4.5) + pad * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = haloColor;
        ctx.fill();
      } else if (obj.type === 'line') {
        var sP0 = camera.worldToScreen(geom.P0);
        var sP1 = camera.worldToScreen(geom.P1);
        if (obj.extent === 'segment') {
          ctx.beginPath();
          ctx.moveTo(sP0.x, sP0.y);
          ctx.lineTo(sP1.x, sP1.y);
          ctx.stroke();
        } else {
          var clipped = clipGeometry(sP0.x, sP0.y, sP1.x, sP1.y, camera.width, camera.height, obj.extent || 'line');
          if (clipped) {
            ctx.beginPath();
            ctx.moveTo(clipped.x0, clipped.y0);
            ctx.lineTo(clipped.x1, clipped.y1);
            ctx.stroke();
          }
        }
      } else if (obj.type === 'circle') {
        var sO = camera.worldToScreen(geom.O);
        var sR = camera.worldDistToScreen(geom.r);
        ctx.beginPath();
        ctx.arc(sO.x, sO.y, sR, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },

    drawPreview: function (preview) {
      var ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = '#2F6FEB';
      ctx.lineWidth = 1.75;
      ctx.setLineDash([6, 4]);

      if (preview.type === 'point' && preview.pt) {
        var sP = camera.worldToScreen(preview.pt);
        ctx.beginPath();
        ctx.arc(sP.x, sP.y, 4.5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (preview.type === 'line' && preview.p0 && preview.p1) {
        var s0 = camera.worldToScreen(preview.p0);
        var s1 = camera.worldToScreen(preview.p1);
        if (preview.extent === 'segment') {
          ctx.beginPath();
          ctx.moveTo(s0.x, s0.y);
          ctx.lineTo(s1.x, s1.y);
          ctx.stroke();
        } else {
          var cl = clipGeometry(s0.x, s0.y, s1.x, s1.y, camera.width, camera.height, preview.extent || 'line');
          if (cl) {
            ctx.beginPath();
            ctx.moveTo(cl.x0, cl.y0);
            ctx.lineTo(cl.x1, cl.y1);
            ctx.stroke();
          }
        }
      } else if (preview.type === 'circle' && preview.O && preview.r) {
        var sO = camera.worldToScreen(preview.O);
        var sR = camera.worldDistToScreen(preview.r);
        ctx.beginPath();
        ctx.arc(sO.x, sO.y, sR, 0, Math.PI * 2);
        ctx.stroke();
      } else if (preview.type === 'multi_circle' && preview.candidates) {
        for (var i = 0; i < preview.candidates.length; i++) {
          var cand = preview.candidates[i];
          var sOc = camera.worldToScreen(cand.circle.O);
          var sRc = camera.worldDistToScreen(cand.circle.r);
          var isHigh = preview.selectedBranch === cand.branch;

          // Highlight selected circle area
          if (isHigh) {
            ctx.save();
            ctx.fillStyle = 'rgba(47, 111, 235, 0.14)';
            ctx.beginPath();
            ctx.arc(sOc.x, sOc.y, sRc, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // Circumference stroke
          ctx.lineWidth = isHigh ? 2.5 : 1.25;
          ctx.strokeStyle = isHigh ? '#2F6FEB' : 'rgba(47, 111, 235, 0.35)';
          ctx.setLineDash(isHigh ? [6, 3] : [4, 4]);
          ctx.beginPath();
          ctx.arc(sOc.x, sOc.y, sRc, 0, Math.PI * 2);
          ctx.stroke();

          // Solution number badge at center
          ctx.save();
          ctx.setLineDash([]);
          ctx.fillStyle = isHigh ? '#2F6FEB' : 'rgba(47, 111, 235, 0.6)';
          ctx.beginPath();
          ctx.arc(sOc.x, sOc.y, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(i + 1), sOc.x, sOc.y);
          ctx.restore();
        }
      } else if (preview.type === 'polygon' && preview.vertices) {
        ctx.beginPath();
        var fv = camera.worldToScreen(preview.vertices[0]);
        ctx.moveTo(fv.x, fv.y);
        for (var v = 1; v < preview.vertices.length; v++) {
          var sv = camera.worldToScreen(preview.vertices[v]);
          ctx.lineTo(sv.x, sv.y);
        }
        ctx.closePath();
        ctx.stroke();
      } else if (preview.type === 'angle' && preview.a && preview.v && preview.b) {
        var sV = camera.worldToScreen(preview.v);
        var sA = camera.worldToScreen(preview.a);
        var sB = camera.worldToScreen(preview.b);

        // Draw preview lines from vertex to both arms
        ctx.beginPath();
        ctx.moveTo(sA.x, sA.y);
        ctx.lineTo(sV.x, sV.y);
        ctx.lineTo(sB.x, sB.y);
        ctx.stroke();

        // Draw preview arc
        var u1 = vec.normalize(vec.sub(preview.a, preview.v));
        var u2 = vec.normalize(vec.sub(preview.b, preview.v));
        if (u1 && u2) {
          var ang1 = Math.atan2(-u1.y, u1.x);
          var ang2 = Math.atan2(-u2.y, u2.x);
          ctx.beginPath();
          ctx.arc(sV.x, sV.y, 26, ang1, ang2, false);
          ctx.stroke();
        }
      } else if (preview.type === 'multi_ray' && preview.candidates) {
        for (var r = 0; r < preview.candidates.length; r++) {
          var candR = preview.candidates[r];
          var isHighR = preview.selectedBranch === candR.branch;
          var sOrigin = camera.worldToScreen(candR.origin);
          var sFar = camera.worldToScreen(vec.add(candR.origin, vec.scale(candR.dir, 100)));
          var clipped = clipGeometry(sOrigin.x, sOrigin.y, sFar.x, sFar.y, camera.width, camera.height, 'ray');

          ctx.save();
          ctx.lineWidth = isHighR ? 2.5 : 1.25;
          ctx.strokeStyle = isHighR ? '#2F6FEB' : 'rgba(47, 111, 235, 0.4)';
          ctx.setLineDash(isHighR ? [] : [6, 4]);

          if (clipped) {
            ctx.beginPath();
            ctx.moveTo(clipped.x0, clipped.y0);
            ctx.lineTo(clipped.x1, clipped.y1);
            ctx.stroke();
          }

          // Direction arrow and badge along the ray
          var uScreen = vec.normalize({ x: candR.dir.x, y: -candR.dir.y });
          if (uScreen) {
            var badgeDist = 80;
            var sBadge = vec.add(sOrigin, vec.scale(uScreen, badgeDist));
            var perpS = { x: -uScreen.y, y: uScreen.x };

            // Arrowhead
            ctx.fillStyle = isHighR ? '#2F6FEB' : 'rgba(47, 111, 235, 0.6)';
            ctx.setLineDash([]);
            var tip = vec.add(sBadge, vec.scale(uScreen, 8));
            var left = vec.add(sBadge, vec.scale(perpS, 5));
            var right = vec.sub(sBadge, vec.scale(perpS, 5));
            ctx.beginPath();
            ctx.moveTo(tip.x, tip.y);
            ctx.lineTo(left.x, left.y);
            ctx.lineTo(right.x, right.y);
            ctx.closePath();
            ctx.fill();

            // Solution badge 1 / 2
            var sNum = vec.add(sBadge, vec.scale(perpS, 14));
            ctx.beginPath();
            ctx.arc(sNum.x, sNum.y, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(r + 1), sNum.x, sNum.y);
          }
          ctx.restore();
        }
      }
      ctx.restore();
    },

    drawSnapIndicator: function (snapTarget) {
      var ctx = this.ctx;
      var sP = snapTarget.screenPt;
      ctx.save();

      // Outer snap ring
      ctx.strokeStyle = '#2F6FEB';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sP.x, sP.y, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Inner dot or cross
      if (snapTarget.kind === 'intersection') {
        var sz = 4;
        ctx.beginPath();
        ctx.moveTo(sP.x - sz, sP.y - sz);
        ctx.lineTo(sP.x + sz, sP.y + sz);
        ctx.moveTo(sP.x + sz, sP.y - sz);
        ctx.lineTo(sP.x - sz, sP.y + sz);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#2F6FEB';
        ctx.beginPath();
        ctx.arc(sP.x, sP.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tooltip chip under cursor
      if (snapTarget.tooltip) {
        var text = snapTarget.tooltip;
        ctx.font = '500 11px system-ui, sans-serif';
        var tw = ctx.measureText(text).width;
        var px = sP.x + 12;
        var py = sP.y + 14;

        ctx.fillStyle = 'rgba(28, 34, 48, 0.88)';
        ctx.beginPath();
        ctx.roundRect(px, py, tw + 10, 18, 4);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, px + 5, py + 9);
      }

      ctx.restore();
    }
  };

  Geo.view.PainterCanvas = PainterCanvas;
})(window.Geo);
