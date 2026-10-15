/**
 * Euclid Sketch — History (Undo / Redo) Manager
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
  var MAX_STACK = 200;

  function History() {
    this.undoStack = [];
    this.redoStack = [];
    this._locked = false;
  }

  History.prototype = {
    snapshot: function () {
      if (this._locked) return;
      var state = JSON.stringify(graph.toJSON());
      this.undoStack.push(state);
      if (this.undoStack.length > MAX_STACK) {
        this.undoStack.shift();
      }
      this.redoStack = [];
      Geo.events.emit('history:changed', { canUndo: this.canUndo(), canRedo: this.canRedo() });
      Geo.events.emit('io:autosave');
    },

    canUndo: function () {
      return this.undoStack.length > 1;
    },

    canRedo: function () {
      return this.redoStack.length > 0;
    },

    undo: function () {
      if (!this.canUndo()) return;
      this._locked = true;
      var current = this.undoStack.pop();
      this.redoStack.push(current);
      var prev = this.undoStack[this.undoStack.length - 1];
      try {
        graph.fromJSON(JSON.parse(prev));
      } catch (e) {
        console.error('Failed to restore undo state', e);
      }
      this._locked = false;
      Geo.events.emit('history:changed', { canUndo: this.canUndo(), canRedo: this.canRedo() });
      Geo.events.emit('canvas:requestRender');
    },

    redo: function () {
      if (!this.canRedo()) return;
      this._locked = true;
      var next = this.redoStack.pop();
      this.undoStack.push(next);
      try {
        graph.fromJSON(JSON.parse(next));
      } catch (e) {
        console.error('Failed to restore redo state', e);
      }
      this._locked = false;
      Geo.events.emit('history:changed', { canUndo: this.canUndo(), canRedo: this.canRedo() });
      Geo.events.emit('canvas:requestRender');
    }
  };

  Geo.history = new History();
  Geo.events.on('history:snapshot', function () {
    Geo.history.snapshot();
  });
})(window.Geo);
