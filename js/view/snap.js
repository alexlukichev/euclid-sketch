/**
 * Euclid Sketch — Snapping Engine
 */
(function (Geo) {
  'use strict';

  var vec = Geo.kernel.vec;
  var prim = Geo.kernel.primitives;
  var inter = Geo.kernel.intersect;
  var camera = Geo.view.camera;

  var snap = {
    // Finds best snap target at screenPt
    findSnap: function (screenPt, objects, enabled, allowAltBypass) {
      var worldPt = camera.screenToWorld(screenPt);

      if (!enabled) {
        return {
          kind: 'free',
          point: worldPt,
          screenPt: screenPt,
          tooltip: ''
        };
      }

      var radiusPoint = 10;
      var radiusIntersect = 10;
      var radiusCurve = 8;
      var radiusSpecial = 8;

      // 1. Existing points
      var bestPoint = null;
      var bestPtDist = Infinity;
      for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];
        if (obj.type === 'point' && obj.visible && obj._geom) {
          var sP = camera.worldToScreen(obj._geom);
          var d = vec.dist(screenPt, sP);
          if (d <= radiusPoint && d < bestPtDist) {
            bestPtDist = d;
            bestPoint = obj;
          }
        }
      }
      if (bestPoint) {
        return {
          kind: 'point',
          object: bestPoint,
          point: { x: bestPoint._geom.x, y: bestPoint._geom.y },
          screenPt: camera.worldToScreen(bestPoint._geom),
          tooltip: bestPoint.label && bestPoint.label.text ? bestPoint.label.text : 'Point'
        };
      }

      // 2. Intersections of curves (on infinite carrier lines)
      var curves = [];
      for (var c = 0; c < objects.length; c++) {
        var o = objects[c];
        if ((o.type === 'line' || o.type === 'circle') && o.visible && o._geom) {
          curves.push(o);
        }
      }

      var bestInter = null;
      var bestInterDist = Infinity;

      for (var c1 = 0; c1 < curves.length; c1++) {
        for (var c2 = c1 + 1; c2 < curves.length; c2++) {
          var curveA = curves[c1];
          var curveB = curves[c2];
          var interPoints = [];

          if (curveA.type === 'line' && curveB.type === 'line') {
            var ptLL = inter.lineLine(curveA._geom, curveB._geom);
            if (ptLL) interPoints.push({ pt: ptLL, branch: 0 });
          } else if (curveA.type === 'line' && curveB.type === 'circle') {
            var ptsLC = inter.lineCircle(curveA._geom, curveB._geom);
            for (var k = 0; k < ptsLC.length; k++) interPoints.push({ pt: ptsLC[k], branch: k });
          } else if (curveA.type === 'circle' && curveB.type === 'line') {
            var ptsCL = inter.lineCircle(curveB._geom, curveA._geom);
            for (var m = 0; m < ptsCL.length; m++) interPoints.push({ pt: ptsCL[m], branch: m });
          } else if (curveA.type === 'circle' && curveB.type === 'circle') {
            var ptsCC = inter.circleCircle(curveA._geom, curveB._geom);
            for (var n = 0; n < ptsCC.length; n++) interPoints.push({ pt: ptsCC[n], branch: n });
          }

          for (var p = 0; p < interPoints.length; p++) {
            var cand = interPoints[p];
            var sCand = camera.worldToScreen(cand.pt);
            var distS = vec.dist(screenPt, sCand);
            if (distS <= radiusIntersect && distS < bestInterDist) {
              bestInterDist = distS;
              var labelA = curveA.label && curveA.label.text ? curveA.label.text : (curveA.type === 'circle' ? 'c' : 'l');
              var labelB = curveB.label && curveB.label.text ? curveB.label.text : (curveB.type === 'circle' ? 'c' : 'l');
              bestInter = {
                kind: 'intersection',
                point: cand.pt,
                screenPt: sCand,
                parentA: curveA,
                parentB: curveB,
                branch: cand.branch,
                tooltip: labelA + ' ∩ ' + labelB
              };
            }
          }
        }
      }
      if (bestInter) return bestInter;

      // 3. Special points: circle centers, segment midpoints
      var bestSpecial = null;
      var bestSpecialDist = Infinity;
      for (var s = 0; s < objects.length; s++) {
        var spObj = objects[s];
        if (!spObj.visible || !spObj._geom) continue;

        if (spObj.type === 'circle') {
          var sO = camera.worldToScreen(spObj._geom.O);
          var dO = vec.dist(screenPt, sO);
          if (dO <= radiusSpecial && dO < bestSpecialDist) {
            bestSpecialDist = dO;
            bestSpecial = {
              kind: 'center',
              point: { x: spObj._geom.O.x, y: spObj._geom.O.y },
              screenPt: sO,
              circleObj: spObj,
              tooltip: 'center of ' + (spObj.label && spObj.label.text ? spObj.label.text : 'circle')
            };
          }
        }
      }
      if (bestSpecial) return bestSpecial;

      // 4. On a curve (line or circle)
      var bestCurve = null;
      var bestCurveDist = Infinity;
      for (var cv = 0; cv < curves.length; cv++) {
        var curObj = curves[cv];
        if (curObj.type === 'line') {
          var projWorld = prim.projectPointToLine(worldPt, curObj._geom);
          var sProj = camera.worldToScreen(projWorld);
          var dL = vec.dist(screenPt, sProj);
          if (dL <= radiusCurve && dL < bestCurveDist) {
            bestCurveDist = dL;
            var tParam = prim.paramOnLine(projWorld, curObj._geom);
            bestCurve = {
              kind: 'onObject',
              point: projWorld,
              screenPt: sProj,
              targetObj: curObj,
              t: tParam,
              tooltip: 'on ' + (curObj.label && curObj.label.text ? curObj.label.text : 'line')
            };
          }
        } else if (curObj.type === 'circle') {
          var dirC = vec.sub(worldPt, curObj._geom.O);
          var lenC = vec.len(dirC);
          if (lenC > 1e-6) {
            var uC = { x: dirC.x / lenC, y: dirC.y / lenC };
            var projOnCirc = vec.add(curObj._geom.O, vec.scale(uC, curObj._geom.r));
            var sProjC = camera.worldToScreen(projOnCirc);
            var dC = vec.dist(screenPt, sProjC);
            if (dC <= radiusCurve && dC < bestCurveDist) {
              bestCurveDist = dC;
              var angleParam = Math.atan2(uC.y, uC.x);
              bestCurve = {
                kind: 'onObject',
                point: projOnCirc,
                screenPt: sProjC,
                targetObj: curObj,
                t: angleParam,
                tooltip: 'on ' + (curObj.label && curObj.label.text ? curObj.label.text : 'circle')
              };
            }
          }
        }
      }
      if (bestCurve) return bestCurve;

      // Default: free point at cursor
      return {
        kind: 'free',
        point: worldPt,
        screenPt: screenPt,
        tooltip: ''
      };
    }
  };

  Geo.view.snap = snap;
})(window.Geo);
