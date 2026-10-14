/**
 * Euclid Sketch — Metric Construction Tools (Segment of Given Length, Rectangle, Angle of Given Size)
 */
(function (Geo) {
  'use strict';

  var graph = Geo.model.graph;
  var objects = Geo.model.objects;
  var labels = Geo.model.labels;
  var measure = Geo.model.measure;

  // --- Segment of Given Length Tool (4) ---
  Geo.tools.register({
    id: 'segment_length',
    name: 'Segment of Given Length',
    steps: [
      { accept: 'linear', prompt: 'Select line, ray, or segment' },
      { accept: 'point', prompt: 'Select starting point on line' }
    ],
    commit: function (picks) {
      if (picks.length < 2) return;
      var ln = picks[0];
      var pt = picks[1];

      // Strict reference requirement check
      if (!measure.hasReference()) {
        Geo.events.emit('reference:required', {
          action: 'Segment of given length',
          onReferenceSet: function () {
            Geo.tools.controller.activate('segment_length', [ln, pt]);
          }
        });
        return;
      }

      Geo.events.emit('dialog:number', {
        title: 'Segment Length',
        prompt: 'Enter segment length in reference units (' + (measure.reference.unit || 'units') + '):',
        defaultValue: '5',
        onConfirm: function (val) {
          var len = parseFloat(val);
          if (isNaN(len) || len <= 0) return;

          // End point on line
          var endLabel = labels.nextAvailableLabel('point', graph.objects);
          var endPt = objects.createPoint({
            kind: 'offsetOnLine',
            line: ln.id,
            point: pt.id,
            length: len,
            sign: 1
          }, endLabel);
          graph.add(endPt);

          // Connecting segment
          var seg = objects.createLine({
            kind: 'twoPoints',
            p: pt.id,
            q: endPt.id
          }, 'segment', '');
          graph.add(seg);

          Geo.events.emit('history:snapshot');
        }
      });
    }
  });

  // --- Rectangle with Given Sides Tool (5) ---
  Geo.tools.register({
    id: 'rectangle',
    name: 'Rectangle with Given Sides',
    steps: [
      { accept: 'linear', prompt: 'Select base line, ray, or segment' },
      { accept: 'point', prompt: 'Select first corner point on line' }
    ],
    commit: function (picks) {
      if (picks.length < 2) return;
      var ln = picks[0];
      var pt = picks[1];

      // Strict reference requirement check
      if (!measure.hasReference()) {
        Geo.events.emit('reference:required', {
          action: 'Rectangle with given sides',
          onReferenceSet: function () {
            Geo.tools.controller.activate('rectangle', [ln, pt]);
          }
        });
        return;
      }

      Geo.events.emit('dialog:rectangle', {
        title: 'Rectangle Dimensions',
        unit: measure.reference.unit || 'units',
        onConfirm: function (a, b) {
          if (isNaN(a) || isNaN(b) || a <= 0 || b <= 0) return;

          var groupName = 'rect_' + Date.now();

          // Corner 1: already pt (picks[1])
          // Corner 2: offset along line
          var p1Label = labels.nextAvailableLabel('point', graph.objects);
          var p1 = objects.createPoint({
            kind: 'rectCorner',
            line: ln.id,
            point: pt.id,
            a: a,
            b: b,
            su: 1,
            sv: 1,
            corner: 1
          }, p1Label, { group: groupName });
          graph.add(p1);

          // Corner 3: diagonal corner
          var p2Label = labels.nextAvailableLabel('point', graph.objects);
          var p2 = objects.createPoint({
            kind: 'rectCorner',
            line: ln.id,
            point: pt.id,
            a: a,
            b: b,
            su: 1,
            sv: 1,
            corner: 2
          }, p2Label, { group: groupName });
          graph.add(p2);

          // Corner 4: offset perpendicular
          var p3Label = labels.nextAvailableLabel('point', graph.objects);
          var p3 = objects.createPoint({
            kind: 'rectCorner',
            line: ln.id,
            point: pt.id,
            a: a,
            b: b,
            su: 1,
            sv: 1,
            corner: 3
          }, p3Label, { group: groupName });
          graph.add(p3);

          // Create filled polygon rectangle
          var poly = objects.createPolygon({
            kind: 'rectangle',
            line: ln.id,
            point: pt.id,
            a: a,
            b: b,
            su: 1,
            sv: 1
          }, '', {
            group: groupName,
            fill: 'rgba(47,111,235,0.12)',
            fillEnabled: true
          });
          graph.add(poly);

          Geo.events.emit('history:snapshot');
        }
      });
    }
  });

  // --- Angle of Given Magnitude Tool (6) ---
  Geo.tools.register({
    id: 'angle_size',
    name: 'Angle of Given Magnitude',
    steps: [
      { accept: 'linear', prompt: 'Select base line, ray, or segment' },
      { accept: 'point', prompt: 'Select vertex point on line' }
    ],
    commit: function (picks) {
      if (picks.length < 2) return;
      var ln = picks[0];
      var v = picks[1];

      Geo.events.emit('dialog:number', {
        title: 'Angle Magnitude',
        prompt: 'Enter angle magnitude in degrees (e.g. 45, 60, 90):',
        defaultValue: '60',
        onConfirm: function (val) {
          var deg = parseFloat(val);
          if (isNaN(deg) || deg <= 0 || deg >= 360) return;

          // Helper arm point
          var armPtLabel = labels.nextAvailableLabel('point', graph.objects);
          var armPt = objects.createPoint({
            kind: 'angleArm',
            line: ln.id,
            vertex: v.id,
            deg: deg,
            baseSign: 1,
            rotSign: 1,
            r: 2.0
          }, armPtLabel, { aux: true });
          graph.add(armPt);

          // Ray along arm
          var armRay = objects.createLine({
            kind: 'twoPoints',
            p: v.id,
            q: armPt.id
          }, 'ray', '');
          graph.add(armRay);

          // Angle object
          var angLabel = labels.nextAvailableLabel('angle', graph.objects);
          var ang = objects.createAngle({
            kind: 'fromLine',
            line: ln.id,
            vertex: v.id,
            deg: deg,
            baseSign: 1,
            rotSign: 1
          }, angLabel, { showMeasure: true });
          graph.add(ang);

          Geo.events.emit('history:snapshot');
        }
      });
    }
  });
})(window.Geo);
