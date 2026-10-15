/**
 * Euclid Sketch — Peek / Inspect Object Properties Tool
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
  var hittest = Geo.view.hittest;
  var measure = Geo.model.measure;
  var vec = Geo.kernel.vec;

  function summarizeObject(obj) {
    if (!obj || !obj._geom) return '';
    var labelStr = (obj.label && obj.label.text) ? obj.label.text + ': ' : '';
    if (obj.type === 'point') {
      var ptKind = (obj.def && obj.def.kind === 'free') ? ' [Free]' :
        (obj.def && (obj.def.kind === 'onObject' || obj.def.kind === 'onLine')) ? ' [Semi-constrained]' : ' [Fully-constrained]';
      return labelStr + 'Point (' + obj._geom.x.toFixed(2) + ', ' + obj._geom.y.toFixed(2) + ')' + ptKind;
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
    defaultPrompt: 'Click or hover over an object to inspect. Drag any label to move it.',
    draggingLabelObj: null,
    hoveredLabelObj: null,

    onActivate: function () {
      this.draggingLabelObj = null;
      this.hoveredLabelObj = null;
      Geo.events.emit('canvas:cursor', 'help');
    },

    onDeactivate: function () {
      this.draggingLabelObj = null;
      this.hoveredLabelObj = null;
    },

    onPointerMove: function (screenPt, snapTarget, evt) {
      if (this.draggingLabelObj) {
        var dxDelta = screenPt.x - this._startScreenPt.x;
        var dyDelta = screenPt.y - this._startScreenPt.y;
        this.draggingLabelObj.label.dx = Math.round(this._startDx + dxDelta);
        this.draggingLabelObj.label.dy = Math.round(this._startDy + dyDelta);
        this.draggingLabelObj.label.manual = true;
        Geo.events.emit('canvas:cursor', 'grabbing');
        if (Geo.ui && Geo.ui.statusbar) {
          Geo.ui.statusbar.setPrompt('Moving label "' + (this.draggingLabelObj.label.text || '') + '" (dx: ' + this.draggingLabelObj.label.dx + ', dy: ' + this.draggingLabelObj.label.dy + ')');
        }
        Geo.events.emit('canvas:requestRender');
        return;
      }

      var hitLabel = (hittest.hitTestLabel) ? hittest.hitTestLabel(screenPt, graph.objects, 5) : null;
      if (hitLabel) {
        if (this.hoveredLabelObj !== hitLabel.object) {
          this.hoveredLabelObj = hitLabel.object;
          Geo.events.emit('canvas:requestRender');
        }
        Geo.events.emit('canvas:cursor', 'grab');
        if (Geo.ui && Geo.ui.statusbar) {
          Geo.ui.statusbar.setPrompt('Label "' + (hitLabel.object.label.text || '') + '" — Click & drag to move label');
        }
        return;
      }
      if (this.hoveredLabelObj) {
        this.hoveredLabelObj = null;
        Geo.events.emit('canvas:requestRender');
      }

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
      var hitLabel = (hittest.hitTestLabel) ? hittest.hitTestLabel(screenPt, graph.objects, 5) : null;
      if (hitLabel) {
        this.draggingLabelObj = hitLabel.object;
        this.hoveredLabelObj = null;
        this._startScreenPt = { x: screenPt.x, y: screenPt.y };
        this._startDx = (hitLabel.object.label.dx !== undefined) ? hitLabel.object.label.dx : 8;
        this._startDy = (hitLabel.object.label.dy !== undefined) ? hitLabel.object.label.dy : -10;
        hitLabel.object.label.manual = true;

        Geo.tools.selection.selectOnly(hitLabel.object);
        if (Geo.ui && Geo.ui.infopanel) {
          Geo.ui.infopanel.switchTab('properties');
          Geo.ui.infopanel.update([hitLabel.object]);
        }
        Geo.events.emit('canvas:cursor', 'grabbing');
        if (Geo.ui && Geo.ui.statusbar) {
          Geo.ui.statusbar.setPrompt('Moving label "' + (hitLabel.object.label.text || '') + '" (Release to set)');
        }
        Geo.events.emit('canvas:requestRender');
        return true;
      }

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

    onPointerUp: function (evt) {
      if (this.draggingLabelObj) {
        this.draggingLabelObj = null;
        Geo.events.emit('history:snapshot');
        Geo.events.emit('canvas:requestRender');
        Geo.events.emit('canvas:cursor', 'help');
        return true;
      }
      return false;
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
