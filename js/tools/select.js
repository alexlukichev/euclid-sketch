/**
 * Euclid Sketch — Select & Move Tool
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
  var camera = Geo.view.camera;
  var vec = Geo.kernel.vec;
  var prim = Geo.kernel.primitives;

  var selection = {
    selectedIds: {},
    grabbedPoint: null,
    originalDef: null,

    clear: function () {
      this.selectedIds = {};
      Geo.events.emit('selection:changed', this.getSelectedObjects());
    },

    selectOnly: function (obj) {
      this.selectedIds = {};
      if (obj) this.selectedIds[obj.id] = true;
      Geo.events.emit('selection:changed', this.getSelectedObjects());
    },

    toggle: function (obj) {
      if (!obj) return;
      if (this.selectedIds[obj.id]) {
        delete this.selectedIds[obj.id];
      } else {
        this.selectedIds[obj.id] = true;
      }
      Geo.events.emit('selection:changed', this.getSelectedObjects());
    },

    getSelectedObjects: function () {
      var list = [];
      for (var id in this.selectedIds) {
        if (this.selectedIds[id]) {
          var o = graph.get(id);
          if (o) list.push(o);
        }
      }
      return list;
    }
  };

  Geo.tools.selection = selection;

  Geo.events.on('graph:loaded', function () {
    selection.grabbedPoint = null;
    selection.originalDef = null;
    selection.clear();
  });

  Geo.tools.register({
    id: 'select',
    name: 'Move points',
    key: 'v',
    defaultPrompt: 'Click a point to grab & move (2nd click releases). Click to select points.',

    onActivate: function () {
      selection.grabbedPoint = null;
      selection.originalDef = null;
      // Keep only point objects selected when entering Move points tool
      var changed = false;
      for (var id in selection.selectedIds) {
        if (selection.selectedIds[id]) {
          var o = graph.get(id);
          if (!o || o.type !== 'point') {
            delete selection.selectedIds[id];
            changed = true;
          }
        }
      }
      if (changed) {
        Geo.events.emit('selection:changed', selection.getSelectedObjects());
      }
    },

    onDeactivate: function () {
      if (selection.grabbedPoint) {
        selection.grabbedPoint = null;
        selection.originalDef = null;
        Geo.events.emit('history:snapshot');
      }
    },

    onPointerDown: function (screenPt, snapTarget, evt) {
      // If a point is currently grabbed, this 2nd click releases it!
      if (selection.grabbedPoint) {
        selection.grabbedPoint = null;
        selection.originalDef = null;
        Geo.events.emit('history:snapshot');
        Geo.events.emit('canvas:cursor', 'default');
        Geo.events.emit('tool:prompt', {
          toolName: this.name,
          step: 1,
          totalSteps: 0,
          prompt: this.defaultPrompt
        });
        return true;
      }

      var hits = hittest.hitTest(screenPt, graph.objects, 8);
      var hitObj = null;
      for (var i = 0; i < hits.length; i++) {
        if (hits[i].object && hits[i].object.type === 'point') {
          hitObj = hits[i].object;
          break;
        }
      }

      if (hitObj) {
        if (evt && evt.shiftKey) {
          selection.toggle(hitObj);
        } else {
          if (!selection.selectedIds[hitObj.id]) {
            selection.selectOnly(hitObj);
          }
        }

        // Click-to-grab: first click grabs draggable point
        if (hitObj.type === 'point' && hitObj.def) {
          if (hitObj.def.kind === 'free' || hitObj.def.kind === 'onObject' || hitObj.def.kind === 'onLine') {
            selection.grabbedPoint = hitObj;
            selection.originalDef = Object.assign({}, hitObj.def);
            var name = (hitObj.label && hitObj.label.text) ? hitObj.label.text : 'point';
            Geo.events.emit('tool:prompt', {
              toolName: this.name,
              step: 1,
              totalSteps: 0,
              prompt: 'Point ' + name + ' grabbed. Click anywhere to release/place (Esc to cancel).'
            });
            Geo.events.emit('canvas:cursor', 'grabbing');
          }
        }
      } else {
        if (!evt || !evt.shiftKey) {
          selection.clear();
        }
      }
      return true;
    },

    onPointerMove: function (screenPt, snapTarget, evt) {
      if (selection.grabbedPoint) {
        var ptObj = selection.grabbedPoint;
        var worldPt = (snapTarget && snapTarget.point && ptObj.def.kind === 'free') ?
          snapTarget.point : camera.screenToWorld(screenPt);

        if (ptObj.def.kind === 'free') {
          ptObj.def.x = worldPt.x;
          ptObj.def.y = worldPt.y;
        } else if (ptObj.def.kind === 'onLine') {
          var lObj = graph.get(ptObj.def.line);
          if (lObj && lObj._geom) {
            var proj = prim.projectPointToLine(worldPt, lObj._geom);
            ptObj.def.t = prim.paramOnLine(proj, lObj._geom);
          }
        } else if (ptObj.def.kind === 'onObject') {
          var targetObj = graph.get(ptObj.def.obj);
          if (targetObj && targetObj._geom) {
            if (targetObj.type === 'line') {
              var projL = prim.projectPointToLine(worldPt, targetObj._geom);
              ptObj.def.t = prim.paramOnLine(projL, targetObj._geom);
            } else if (targetObj.type === 'circle') {
              var dir = vec.sub(worldPt, targetObj._geom.O);
              ptObj.def.t = Math.atan2(dir.y, dir.x);
            }
          }
        }

        graph.recomputeAll();
        Geo.events.emit('canvas:cursor', 'grabbing');
        Geo.events.emit('canvas:requestRender');
        return;
      }

      // Hover feedback when not grabbed (points only)
      var hits = hittest.hitTest(screenPt, graph.objects, 8);
      var hitPoint = null;
      for (var i = 0; i < hits.length; i++) {
        if (hits[i].object && hits[i].object.type === 'point') {
          hitPoint = hits[i].object;
          break;
        }
      }
      if (hitPoint && hitPoint.def &&
          (hitPoint.def.kind === 'free' || hitPoint.def.kind === 'onObject' || hitPoint.def.kind === 'onLine')) {
        Geo.events.emit('canvas:cursor', 'grab');
      } else {
        Geo.events.emit('canvas:cursor', 'default');
      }
    },

    onKeyDown: function (evt) {
      if (evt.key === 'Escape' && selection.grabbedPoint) {
        // Restore original position
        if (selection.originalDef) {
          selection.grabbedPoint.def = selection.originalDef;
          graph.recomputeAll();
          Geo.events.emit('canvas:requestRender');
        }
        selection.grabbedPoint = null;
        selection.originalDef = null;
        Geo.events.emit('canvas:cursor', 'default');
        Geo.events.emit('tool:prompt', {
          toolName: this.name,
          step: 1,
          totalSteps: 0,
          prompt: this.defaultPrompt
        });
        return true;
      }

      if (evt.key === 'Delete' || evt.key === 'Backspace') {
        var selected = selection.getSelectedObjects();
        if (selected.length > 0) {
          for (var i = 0; i < selected.length; i++) {
            graph.remove(selected[i].id);
          }
          selection.clear();
          Geo.events.emit('history:snapshot');
          Geo.events.emit('canvas:requestRender');
          return true;
        }
      }
      return false;
    }
  });

  // --- Pan Canvas Tool (H) ---
  var panState = {
    dragging: false,
    lastPt: null
  };

  Geo.tools.register({
    id: 'pan',
    name: 'Pan Canvas',
    key: 'h',
    cursor: 'grab',
    defaultPrompt: 'Click and drag to pan the canvas around. Scroll wheel to zoom.',

    onActivate: function () {
      panState.dragging = false;
      panState.lastPt = null;
      Geo.events.emit('canvas:cursor', 'grab');
    },

    onDeactivate: function () {
      panState.dragging = false;
      panState.lastPt = null;
    },

    onPointerDown: function (screenPt, snapTarget, evt) {
      panState.dragging = true;
      panState.lastPt = { x: screenPt.x, y: screenPt.y };
      Geo.events.emit('canvas:cursor', 'grabbing');
      return true;
    },

    onPointerMove: function (screenPt, snapTarget, evt) {
      if (panState.dragging && panState.lastPt) {
        var dx = screenPt.x - panState.lastPt.x;
        var dy = screenPt.y - panState.lastPt.y;
        panState.lastPt = { x: screenPt.x, y: screenPt.y };
        camera.panByScreenDelta(dx, dy);
        Geo.events.emit('canvas:cursor', 'grabbing');
      } else {
        Geo.events.emit('canvas:cursor', 'grab');
      }
    },

    onPointerUp: function (evt) {
      panState.dragging = false;
      panState.lastPt = null;
      Geo.events.emit('canvas:cursor', 'grab');
    }
  });
})(window.Geo);
