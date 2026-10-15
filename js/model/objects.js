/**
 * Euclid Sketch — Data Model & Object Factory
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

  var idCounter = 1;

  var objects = {
    nextId: function () {
      return 'o' + (idCounter++);
    },

    resetIdCounter: function (val) {
      idCounter = val || 1;
    },

    createPoint: function (def, labelText, options) {
      options = options || {};
      return {
        id: options.id || objects.nextId(),
        type: 'point',
        def: def, // e.g. { kind: 'free', x: 0, y: 0 }
        label: {
          text: labelText || '',
          visible: options.showLabel !== undefined ? options.showLabel : true,
          dx: 8,
          dy: -10
        },
        style: {
          color: options.color || 'ink',
          size: options.size || 4.5
        },
        visible: options.visible !== undefined ? options.visible : true,
        aux: !!options.aux,
        group: options.group || null,
        _geom: null
      };
    },

    createLine: function (def, extent, labelText, options) {
      options = options || {};
      return {
        id: options.id || objects.nextId(),
        type: 'line',
        extent: extent || 'line', // 'line' | 'ray' | 'segment'
        def: def, // e.g. { kind: 'twoPoints', p: 'o1', q: 'o2' }
        label: {
          text: labelText || '',
          visible: options.showLabel !== undefined ? options.showLabel : (labelText ? true : false),
          dx: 10,
          dy: -10
        },
        style: {
          color: options.color || 'ink',
          width: options.width || 2,
          dash: options.dash || 'solid', // 'solid' | 'dashed' | 'dotted'
          marks: options.marks || 0 // tick marks for segments
        },
        visible: options.visible !== undefined ? options.visible : true,
        aux: !!options.aux,
        group: options.group || null,
        _geom: null
      };
    },

    createCircle: function (def, labelText, options) {
      options = options || {};
      return {
        id: options.id || objects.nextId(),
        type: 'circle',
        def: def, // e.g. { kind: 'threePoints', a: 'o1', b: 'o2', c: 'o3' }
        label: {
          text: labelText || '',
          visible: options.showLabel !== undefined ? options.showLabel : true,
          dx: 12,
          dy: -12
        },
        style: {
          color: options.color || 'ink',
          width: options.width || 1.75,
          dash: options.dash || 'solid'
        },
        visible: options.visible !== undefined ? options.visible : true,
        aux: !!options.aux,
        group: options.group || null,
        _geom: null
      };
    },

    createAngle: function (def, labelText, options) {
      options = options || {};
      return {
        id: options.id || objects.nextId(),
        type: 'angle',
        def: def, // e.g. { kind: 'threePoints', a: 'o1', vertex: 'o2', b: 'o3' }
        label: {
          text: labelText || '',
          visible: options.showLabel !== undefined ? options.showLabel : true,
          dx: 14,
          dy: 0
        },
        style: {
          color: options.color || 'ink',
          width: options.width || 1.5,
          reflex: !!options.reflex,
          marks: options.marks || 'auto', // 'none' | '1' | '2' | '3' | 'right' | 'auto'
          showMeasure: !!options.showMeasure
        },
        visible: options.visible !== undefined ? options.visible : true,
        aux: !!options.aux,
        group: options.group || null,
        _geom: null
      };
    },

    createPolygon: function (def, labelText, options) {
      options = options || {};
      return {
        id: options.id || objects.nextId(),
        type: 'polygon',
        def: def, // e.g. { kind: 'rectangle', line: 'o1', point: 'o2', a: 4, b: 3, su: 1, sv: 1 }
        label: {
          text: labelText || '',
          visible: options.showLabel !== undefined ? options.showLabel : false,
          dx: 0,
          dy: 0
        },
        style: {
          color: options.color || 'ink',
          width: options.width || 2,
          dash: options.dash || 'solid',
          fill: options.fill || 'rgba(47,111,235,0.12)',
          fillEnabled: options.fillEnabled !== undefined ? options.fillEnabled : true
        },
        visible: options.visible !== undefined ? options.visible : true,
        aux: !!options.aux,
        group: options.group || null,
        _geom: null
      };
    },

    createMeasure: function (def, options) {
      options = options || {};
      return {
        id: options.id || objects.nextId(),
        type: 'measure',
        def: def, // e.g. { kind: 'length', seg: 'o3' } or { kind: 'distPP', p: 'o1', q: 'o2' }
        label: {
          text: '',
          visible: true,
          dx: 0,
          dy: 14
        },
        style: {
          color: options.color || 'ink',
          precision: options.precision || 2
        },
        visible: true,
        aux: false,
        group: null,
        _geom: null
      };
    },

    // Extracts parent IDs referenced by this object's def
    extractParentIds: function (obj) {
      var parents = [];
      if (!obj || !obj.def) return parents;
      var d = obj.def;

      for (var k in d) {
        if (!d.hasOwnProperty(k)) continue;
        if (k === 'kind') continue;
        var val = d[k];
        if (typeof val === 'string' && val.charAt(0) === 'o') {
          parents.push(val);
        } else if (Array.isArray(val)) {
          for (var i = 0; i < val.length; i++) {
            if (typeof val[i] === 'string' && val[i].charAt(0) === 'o') {
              parents.push(val[i]);
            }
          }
        }
      }
      return parents;
    }
  };

  Geo.model.objects = objects;
})(window.Geo);
