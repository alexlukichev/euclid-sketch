/**
 * Euclid Sketch — Reference Segment & Measurement Management
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
