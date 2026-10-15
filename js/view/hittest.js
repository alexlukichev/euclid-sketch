/**
 * Euclid Sketch — Hit-Testing Engine
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
  var camera = Geo.view.camera;

  // Screen distance from point P to line segment AB
  function distPointToSegmentScreen(P, A, B) {
    var l2 = vec.distSq(A, B);
    if (l2 < 1e-6) return vec.dist(P, A);
    var t = ((P.x - A.x) * (B.x - A.x) + (P.y - A.y) * (B.y - A.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    var proj = { x: A.x + t * (B.x - A.x), y: A.y + t * (B.y - A.y) };
    return vec.dist(P, proj);
  }

  // Screen distance from point P to infinite line AB
  function distPointToLineScreen(P, A, B) {
    var l2 = vec.distSq(A, B);
    if (l2 < 1e-6) return vec.dist(P, A);
    var t = ((P.x - A.x) * (B.x - A.x) + (P.y - A.y) * (B.y - A.y)) / l2;
    var proj = { x: A.x + t * (B.x - A.x), y: A.y + t * (B.y - A.y) };
    return vec.dist(P, proj);
  }

  // Point in polygon test (ray casting)
  function isPointInPolygon(P, vertices) {
    var inside = false;
    for (var i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      var xi = vertices[i].x, yi = vertices[i].y;
      var xj = vertices[j].x, yj = vertices[j].y;
      var intersect = ((yi > P.y) !== (yj > P.y)) &&
        (P.x < (xj - xi) * (P.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  var hittest = {
    // Tests cursor against objects and returns hit candidates
    // Tolerance in screen CSS pixels (default: 8px mouse, 16px touch)
    hitTest: function (screenPt, objects, tol, filterFn) {
      var t = tol || 8;
      var candidates = [];

      for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];
        if (!obj._geom || !obj.visible) continue;
        if (filterFn && !filterFn(obj)) continue;

        var hitDist = hittest.distanceToObject(screenPt, obj);
        if (hitDist !== null && hitDist <= t) {
          candidates.push({
            object: obj,
            dist: hitDist,
            typePriority: hittest.typePriority(obj.type)
          });
        }
      }

      // Sort by type priority (points first), then distance
      candidates.sort(function (a, b) {
        if (a.typePriority !== b.typePriority) {
          return a.typePriority - b.typePriority;
        }
        return a.dist - b.dist;
      });

      return candidates;
    },

    typePriority: function (type) {
      switch (type) {
        case 'point': return 1;
        case 'angle': return 2;
        case 'line': return 3;
        case 'circle': return 4;
        case 'polygon': return 5;
        case 'measure': return 6;
        default: return 99;
      }
    },

    distanceToObject: function (screenPt, obj) {
      var geom = obj._geom;
      if (!geom) return null;

      if (obj.type === 'point') {
        var sP = camera.worldToScreen(geom);
        return vec.dist(screenPt, sP);
      }

      if (obj.type === 'line') {
        var sP0 = camera.worldToScreen(geom.P0);
        var sP1 = camera.worldToScreen(geom.P1);
        var sDir = vec.sub(sP1, sP0);
        var len = vec.len(sDir);
        if (len < 1e-5) return null;

        var t = ((screenPt.x - sP0.x) * sDir.x + (screenPt.y - sP0.y) * sDir.y) / (len * len);

        if (obj.extent === 'segment') {
          return distPointToSegmentScreen(screenPt, sP0, sP1);
        } else if (obj.extent === 'ray') {
          if (t < 0) {
            return vec.dist(screenPt, sP0);
          }
          return distPointToLineScreen(screenPt, sP0, sP1);
        } else { // 'line'
          return distPointToLineScreen(screenPt, sP0, sP1);
        }
      }

      if (obj.type === 'circle') {
        var sO = camera.worldToScreen(geom.O);
        var sR = camera.worldDistToScreen(geom.r);
        var distToCenter = vec.dist(screenPt, sO);
        return Math.abs(distToCenter - sR);
      }

      if (obj.type === 'angle') {
        var sV = camera.worldToScreen(geom.V);
        var distToV = vec.dist(screenPt, sV);
        var arcR = 26; // Screen radius of angle arc
        var distToArc = Math.abs(distToV - arcR);

        // Check if cursor angle lies within angle sweep
        var uCursor = vec.sub(screenPt, sV);
        var u1Screen = { x: geom.u1.x, y: -geom.u1.y }; // Screen inverted y
        var cursorAngle = vec.angleBetween(u1Screen, uCursor);

        if (cursorAngle <= geom.sweep || distToV <= 14) {
          return distToArc;
        }
        return null;
      }

      if (obj.type === 'polygon' && geom.vertices) {
        var sVerts = [];
        for (var v = 0; v < geom.vertices.length; v++) {
          sVerts.push(camera.worldToScreen(geom.vertices[v]));
        }
        // Distance to polygon boundary
        var minEdgeDist = Infinity;
        for (var e = 0; e < sVerts.length; e++) {
          var eNext = (e + 1) % sVerts.length;
          var ed = distPointToSegmentScreen(screenPt, sVerts[e], sVerts[eNext]);
          if (ed < minEdgeDist) minEdgeDist = ed;
        }

        // Inside polygon interior?
        if (isPointInPolygon(screenPt, sVerts)) {
          return Math.min(minEdgeDist, 4); // Interior click
        }
        return minEdgeDist;
      }

      return null;
    },

    hitTestLabel: function (screenPt, objects, tol) {
      var t = tol !== undefined ? tol : 4;
      if (!objects || !screenPt) return null;
      var labelsModel = Geo.model.labels;
      if (!labelsModel || !labelsModel.getLabelBoundingBox) return null;

      for (var i = objects.length - 1; i >= 0; i--) {
        var obj = objects[i];
        if (!obj.visible || !obj._geom || !obj.label || !obj.label.visible || !obj.label.text) continue;
        var anchor = labelsModel.getLabelAnchorScreen(obj, camera);
        if (!anchor) continue;
        var box = labelsModel.getLabelBoundingBox(obj, anchor, obj.label.dx, obj.label.dy);
        if (!box) continue;
        if (screenPt.x >= box.x - t &&
            screenPt.x <= box.x + box.width + t &&
            screenPt.y >= box.y - t &&
            screenPt.y <= box.y + box.height + t) {
          return { object: obj, box: box };
        }
      }
      return null;
    }
  };

  Geo.view.hittest = hittest;
})(window.Geo);
