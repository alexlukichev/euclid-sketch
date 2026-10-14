/**
 * Euclid Sketch — Peek / Inspect Object Properties Tool
 */
(function (Geo) {
  'use strict';

  var graph = Geo.model.graph;
  var hittest = Geo.view.hittest;
  var measure = Geo.model.measure;
  var vec = Geo.kernel.vec;

  function summarizeObject(obj) {
    if (!obj || !obj._geom) return '';
    var labelStr = (obj.label && obj.label.text) ? obj.label.text + ': ' : '';
    if (obj.type === 'point') {
      return labelStr + 'Point (' + obj._geom.x.toFixed(2) + ', ' + obj._geom.y.toFixed(2) + ')' +
        (obj.def && obj.def.kind === 'free' ? ' [Free]' : ' [Constrained]');
    } else if (obj.type === 'line') {
      if (obj.extent === 'segment') {
        var wLen = (obj._geom.P0 && obj._geom.P1) ? vec.dist(obj._geom.P0, obj._geom.P1) : 0;
        var rLen = measure.worldToRefUnits(wLen, graph.objectsById);
        return labelStr + 'Segment (Length: ' + measure.formatDistance(rLen) + ')';
      } else if (obj.extent === 'ray') {
        return labelStr + 'Ray (Origin: ' + obj._geom.P0.x.toFixed(1) + ', ' + obj._geom.P0.y.toFixed(1) + ')';
      } else {
        return labelStr + 'Line (' + (obj._geom.n ? obj._geom.n.x.toFixed(2) + 'x + ' + obj._geom.n.y.toFixed(2) + 'y = ' + obj._geom.c.toFixed(2) : '') + ')';
      }
    } else if (obj.type === 'circle') {
      var rRef = measure.worldToRefUnits(obj._geom.r, graph.objectsById);
      return labelStr + 'Circle (Radius: ' + measure.formatDistance(rRef) + ')';
    } else if (obj.type === 'angle') {
      var deg = (obj._geom.sweep * 180) / Math.PI;
      return labelStr + 'Angle (' + deg.toFixed(1) + '°)';
    } else if (obj.type === 'polygon') {
      return labelStr + 'Polygon (Perimeter: ' + measure.formatDistance(obj._geom.perimeter) + ', Area: ' + measure.formatArea(obj._geom.area) + ')';
    }
    return labelStr + obj.type;
  }

  Geo.tools.register({
    id: 'peek',
    name: 'Peek Properties',
    key: 'q',
    cursor: 'help',
    defaultPrompt: 'Click or hover over an object to peek its properties in the Info Panel.',

    onActivate: function () {
      Geo.events.emit('canvas:cursor', 'help');
    },

    onPointerMove: function (screenPt, snapTarget, evt) {
      var hitObj = (snapTarget && snapTarget.object) || (snapTarget && snapTarget.id ? snapTarget : null);
      if (!hitObj) {
        var hits = hittest.hitTest(screenPt, graph.objects, 8);
        if (hits.length > 0) hitObj = hits[0].object;
      }
      if (hitObj) {
        Geo.events.emit('canvas:cursor', 'pointer');
        var summary = summarizeObject(hitObj);
        if (Geo.ui && Geo.ui.statusbar) {
          Geo.ui.statusbar.setPrompt('Peeking ' + summary);
        }
      } else {
        Geo.events.emit('canvas:cursor', 'help');
        if (Geo.ui && Geo.ui.statusbar) {
          Geo.ui.statusbar.setPrompt(this.defaultPrompt);
        }
      }
    },

    onPointerDown: function (screenPt, snapTarget, evt) {
      var hitObj = (snapTarget && snapTarget.object) || (snapTarget && snapTarget.id ? snapTarget : null);
      if (!hitObj) {
        var hits = hittest.hitTest(screenPt, graph.objects, 8);
        if (hits.length > 0) hitObj = hits[0].object;
      }
      if (hitObj) {
        Geo.tools.selection.selectOnly(hitObj);
        if (Geo.ui && Geo.ui.infopanel) {
          Geo.ui.infopanel.switchTab('properties');
          Geo.ui.infopanel.update([hitObj]);
        }
        var summary = summarizeObject(hitObj);
        if (Geo.ui && Geo.ui.statusbar) {
          Geo.ui.statusbar.setPrompt('Inspecting ' + summary);
        }
        return true;
      } else {
        Geo.tools.selection.clear();
        if (Geo.ui && Geo.ui.infopanel) {
          Geo.ui.infopanel.update([]);
        }
      }
      return true;
    },

    onKeyDown: function (evt) {
      if (evt.key === 'Delete' || evt.key === 'Backspace') {
        var selected = Geo.tools.selection.getSelectedObjects();
        if (selected.length > 0) {
          for (var i = 0; i < selected.length; i++) {
            graph.remove(selected[i].id);
          }
          Geo.tools.selection.clear();
          Geo.events.emit('history:snapshot');
          Geo.events.emit('canvas:requestRender');
          return true;
        }
      }
      return false;
    }
  });
})(window.Geo);
