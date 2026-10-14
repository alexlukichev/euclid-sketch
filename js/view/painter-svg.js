/**
 * Euclid Sketch — SVG Vector Exporter
 */
(function (Geo) {
  'use strict';

  var vec = Geo.kernel.vec;
  var camera = Geo.view.camera;
  var labels = Geo.model.labels;

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

  var painterSvg = {
    exportToSvgString: function (objects, width, height) {
      var w = width || camera.width;
      var h = height || camera.height;

      var svg = [];
      svg.push('<?xml version="1.0" encoding="UTF-8"?>');
      svg.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">');
      svg.push('  <style>');
      svg.push('    text { font-family: "STIX Two Text", "STIX Two Math", Cambria, "Times New Roman", serif; }');
      svg.push('  </style>');
      svg.push('  <rect width="100%" height="100%" fill="#ffffff"/>');

      for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];
        if (!obj._geom || !obj.visible) continue;

        var color = PALETTE[obj.style.color] || PALETTE.ink;
        var strokeWidth = obj.style.width || 2;
        var dash = obj.style.dash === 'dashed' ? ' stroke-dasharray="6,4"' : (obj.style.dash === 'dotted' ? ' stroke-dasharray="2,3"' : '');

        if (obj.type === 'polygon' && obj._geom.vertices) {
          var pts = [];
          for (var v = 0; v < obj._geom.vertices.length; v++) {
            var sv = camera.worldToScreen(obj._geom.vertices[v]);
            pts.push(sv.x.toFixed(1) + ',' + sv.y.toFixed(1));
          }
          var fillStr = (obj.style.fillEnabled !== false) ? (obj.style.fill || 'rgba(47,111,235,0.12)') : 'none';
          svg.push('  <polygon points="' + pts.join(' ') + '" fill="' + fillStr + '" stroke="' + color + '" stroke-width="' + strokeWidth + '"' + dash + '/>');
        } else if (obj.type === 'circle') {
          var sO = camera.worldToScreen(obj._geom.O);
          var sR = camera.worldDistToScreen(obj._geom.r);
          svg.push('  <circle cx="' + sO.x.toFixed(1) + '" cy="' + sO.y.toFixed(1) + '" r="' + sR.toFixed(1) + '" fill="none" stroke="' + color + '" stroke-width="' + strokeWidth + '"' + dash + '/>');
        } else if (obj.type === 'line') {
          var sP0 = camera.worldToScreen(obj._geom.P0);
          var sP1 = camera.worldToScreen(obj._geom.P1);
          if (obj.extent === 'segment') {
            svg.push('  <line x1="' + sP0.x.toFixed(1) + '" y1="' + sP0.y.toFixed(1) + '" x2="' + sP1.x.toFixed(1) + '" y2="' + sP1.y.toFixed(1) + '" stroke="' + color + '" stroke-width="' + strokeWidth + '"' + dash + ' stroke-linecap="round"/>');
          } else {
            // Extended line
            var dir = vec.normalize(vec.sub(sP1, sP0));
            if (dir) {
              var pA = (obj.extent === 'ray') ? sP0 : vec.sub(sP0, vec.scale(dir, 2000));
              var pB = vec.add(sP0, vec.scale(dir, 2000));
              svg.push('  <line x1="' + pA.x.toFixed(1) + '" y1="' + pA.y.toFixed(1) + '" x2="' + pB.x.toFixed(1) + '" y2="' + pB.y.toFixed(1) + '" stroke="' + color + '" stroke-width="' + strokeWidth + '"' + dash + '/>');
            }
          }
        } else if (obj.type === 'point') {
          var sP = camera.worldToScreen(obj._geom);
          var ptR = obj.style.size || 4.5;
          var ptFill = (obj.def && obj.def.kind === 'free') ? '#2F6FEB' : color;
          svg.push('  <circle cx="' + sP.x.toFixed(1) + '" cy="' + sP.y.toFixed(1) + '" r="' + ptR + '" fill="' + ptFill + '" stroke="#ffffff" stroke-width="1.5"/>');
        } else if (obj.type === 'angle' && obj._geom && obj._geom.V && obj._geom.u1 && obj._geom.u2) {
          var sV = camera.worldToScreen(obj._geom.V);
          var rArc = 26;
          var ang1 = Math.atan2(-obj._geom.u1.y, obj._geom.u1.x);
          var ang2 = Math.atan2(-obj._geom.u2.y, obj._geom.u2.x);
          var p1 = { x: sV.x + rArc * Math.cos(ang1), y: sV.y + rArc * Math.sin(ang1) };
          var p2 = { x: sV.x + rArc * Math.cos(ang2), y: sV.y + rArc * Math.sin(ang2) };
          var sweepD = obj._geom.sweep || 0;
          var largeArc = sweepD > Math.PI ? 1 : 0;
          svg.push('  <path d="M ' + p1.x.toFixed(1) + ' ' + p1.y.toFixed(1) + ' A ' + rArc + ' ' + rArc + ' 0 ' + largeArc + ' 0 ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1) + '" fill="none" stroke="' + color + '" stroke-width="' + strokeWidth + '"/>');
        }

        // Labels in SVG
        if (obj.label && obj.label.visible && obj.label.text) {
          var parts = labels.parseLabelParts(obj.label.text);
          var sAnchor = camera.worldToScreen(obj._geom.O || obj._geom.P0 || obj._geom.V || obj._geom);
          if (sAnchor) {
            var lx = sAnchor.x + (obj.label.dx || 8);
            var ly = sAnchor.y + (obj.label.dy || -10);
            var tContent = parts.base + parts.primes;
            if (parts.sub) {
              tContent += '<tspan baseline-shift="sub" font-size="70%">' + parts.sub + '</tspan>';
            }
            svg.push('  <text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" font-style="italic" font-size="16" fill="' + color + '">' + tContent + '</text>');
          }
        }
      }

      svg.push('</svg>');
      return svg.join('\n');
    }
  };

  Geo.view.painterSvg = painterSvg;
})(window.Geo);
