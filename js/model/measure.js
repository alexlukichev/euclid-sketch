/**
 * Euclid Sketch — Reference Segment & Measurement Management
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

  var vec = Geo.kernel.vec;

  var measure = {
    // Current active reference segment configuration: { segId: 'o4', value: 5, unit: 'cm' } | null
    reference: null,

    setReference: function (segId, value, unit) {
      if (!segId || !value || value <= 0) return false;
      measure.reference = {
        segId: segId,
        value: Number(value),
        unit: (unit && typeof unit === 'string') ? unit.trim() : ''
      };
      Geo.events.emit('reference:changed', measure.reference);
      return true;
    },

    clearReference: function () {
      measure.reference = null;
      Geo.events.emit('reference:changed', null);
    },

    hasReference: function () {
      return !!measure.reference;
    },

    // Compute metric scale ratio: refValue / worldLength
    getScaleRatio: function (objectsById) {
      if (!measure.reference) return null;
      var seg = objectsById[measure.reference.segId];
      if (!seg || !seg._geom || !seg._geom.P0 || !seg._geom.P1) return null;

      var worldLen = vec.dist(seg._geom.P0, seg._geom.P1);
      if (worldLen < Geo.EPS) return null;

      return measure.reference.value / worldLen;
    },

    // Convert world distance to reference units
    worldToRefUnits: function (worldDist, objectsById) {
      var ratio = measure.getScaleRatio(objectsById);
      if (ratio === null) return null;
      return worldDist * ratio;
    },

    // Convert reference length to world length
    refUnitsToWorld: function (refDist, objectsById) {
      var ratio = measure.getScaleRatio(objectsById);
      if (ratio === null) return null;
      return refDist / ratio;
    },

    // Format a numeric distance with unit and precision
    formatDistance: function (val, precision) {
      if (val === null || val === undefined || !isFinite(val)) return '—';
      var prec = (precision !== undefined) ? precision : 2;
      var str = Number(val).toFixed(prec);
      if (measure.reference && measure.reference.unit) {
        str += ' ' + measure.reference.unit;
      }
      return str;
    },

    // Format an area (distance^2)
    formatArea: function (val, precision) {
      if (val === null || val === undefined || !isFinite(val)) return '—';
      var prec = (precision !== undefined) ? precision : 2;
      var str = Number(val).toFixed(prec);
      if (measure.reference && measure.reference.unit) {
        str += ' ' + measure.reference.unit + '²';
      }
      return str;
    },

    // Format angle in degrees or radians
    formatAngle: function (radians, unit, precision) {
      if (radians === null || radians === undefined || !isFinite(radians)) return '—';
      var prec = (precision !== undefined) ? precision : 1;
      if (unit === 'rad') {
        return Number(radians).toFixed(prec) + ' rad';
      }
      var deg = (radians * 180) / Math.PI;
      return Number(deg).toFixed(prec) + '°';
    }
  };

  Geo.model.measure = measure;
})(window.Geo);
