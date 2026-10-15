/**
 * Euclid Sketch — Construction Dependency Graph & Kernel Evaluation Engine
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
  var prim = Geo.kernel.primitives;
  var inter = Geo.kernel.intersect;
  var circ = Geo.kernel.circles;
  var polar = Geo.kernel.polar;
  var measure = Geo.model.measure;
  var EPS = Geo.EPS;

  function Graph() {
    this.objects = [];        // In creation order
    this.objectsById = {};
  }

  Graph.prototype = {
    clear: function () {
      this.objects = [];
      this.objectsById = {};
      measure.clearReference();
      Geo.events.emit('graph:changed');
    },

    add: function (obj) {
      if (!obj || !obj.id) return null;
      this.objects.push(obj);
      this.objectsById[obj.id] = obj;
      this.recomputeObject(obj);
      Geo.events.emit('graph:changed');
      return obj;
    },

    get: function (id) {
      return this.objectsById[id] || null;
    },

    remove: function (id) {
      var toDelete = this.getDescendantIds(id);
      toDelete.push(id);

      var toDeleteSet = {};
      for (var i = 0; i < toDelete.length; i++) {
        toDeleteSet[toDelete[i]] = true;
      }

      // Check if reference segment is being deleted
      if (measure.reference && toDeleteSet[measure.reference.segId]) {
        measure.clearReference();
      }

      var remaining = [];
      for (var j = 0; j < this.objects.length; j++) {
        var obj = this.objects[j];
        if (toDeleteSet[obj.id]) {
          delete this.objectsById[obj.id];
        } else {
          remaining.push(obj);
        }
      }
      this.objects = remaining;
      this.recomputeAll();
      Geo.events.emit('graph:changed');
      return toDelete.length;
    },

    getDescendantIds: function (id) {
      var descendants = [];
      var visited = {};
      visited[id] = true;

      for (var i = 0; i < this.objects.length; i++) {
        var obj = this.objects[i];
        var parents = Geo.model.objects.extractParentIds(obj);
        for (var p = 0; p < parents.length; p++) {
          if (visited[parents[p]]) {
            visited[obj.id] = true;
            descendants.push(obj.id);
            break;
          }
        }
      }
      return descendants;
    },

    // Check if an existing point is close enough to reuse (dedupe)
    findExistingPoint: function (geom, tol) {
      if (!geom) return null;
      var t = tol || 1e-7;
      for (var i = 0; i < this.objects.length; i++) {
        var obj = this.objects[i];
        if (obj.type === 'point' && obj._geom) {
          if (vec.dist(obj._geom, geom) <= t) {
            return obj;
          }
        }
      }
      return null;
    },

    recomputeAll: function () {
      for (var i = 0; i < this.objects.length; i++) {
        this.recomputeObject(this.objects[i]);
      }
      Geo.events.emit('graph:recomputed');
    },

    recomputeObject: function (obj) {
      if (!obj || !obj.def) {
        obj._geom = null;
        return;
      }

      var def = obj.def;
      var byId = this.objectsById;

      try {
        switch (obj.type) {
          case 'point':
            obj._geom = this._evalPoint(def, byId);
            break;
          case 'line':
            obj._geom = this._evalLine(def, obj.extent, byId);
            break;
          case 'circle':
            obj._geom = this._evalCircle(def, byId);
            break;
          case 'angle':
            obj._geom = this._evalAngle(def, obj.style, byId);
            break;
          case 'polygon':
            obj._geom = this._evalPolygon(def, byId);
            break;
          case 'measure':
            obj._geom = this._evalMeasure(def, byId);
            break;
          default:
            obj._geom = null;
        }
      } catch (err) {
        console.warn('Error evaluating object', obj.id, err);
        obj._geom = null;
      }
    },

    _evalPoint: function (def, byId) {
      switch (def.kind) {
        case 'free':
          return { x: def.x, y: def.y };

        case 'onLine':
        case 'onObject':
          var target = byId[def.obj || def.line];
          if (!target || !target._geom) return null;
          var t = def.t !== undefined ? def.t : 0;
          if (target.type === 'line') {
            var lineGeom = target._geom;
            return prim.pointAtParamOnLine(lineGeom, t);
          } else if (target.type === 'circle') {
            var cGeom = target._geom;
            return {
              x: cGeom.O.x + cGeom.r * Math.cos(t),
              y: cGeom.O.y + cGeom.r * Math.sin(t)
            };
          }
          return null;

        case 'intersection':
          var a = byId[def.a];
          var b = byId[def.b];
          if (!a || !b || !a._geom || !b._geom) return null;
          var branch = def.branch || 0;

          if (a.type === 'line' && b.type === 'line') {
            return inter.lineLine(a._geom, b._geom);
          } else if (a.type === 'line' && b.type === 'circle') {
            var ptsLC = inter.lineCircle(a._geom, b._geom);
            return (branch < ptsLC.length) ? ptsLC[branch] : null;
          } else if (a.type === 'circle' && b.type === 'line') {
            var ptsCL = inter.lineCircle(b._geom, a._geom);
            return (branch < ptsCL.length) ? ptsCL[branch] : null;
          } else if (a.type === 'circle' && b.type === 'circle') {
            var ptsCC = inter.circleCircle(a._geom, b._geom);
            return (branch < ptsCC.length) ? ptsCC[branch] : null;
          }
          return null;

        case 'midpoint':
          if (def.seg) {
            var seg = byId[def.seg];
            if (!seg || !seg._geom || !seg._geom.P0 || !seg._geom.P1) return null;
            return vec.midpoint(seg._geom.P0, seg._geom.P1);
          } else if (def.p && def.q) {
            var pObj = byId[def.p];
            var qObj = byId[def.q];
            if (!pObj || !qObj || !pObj._geom || !qObj._geom) return null;
            return vec.midpoint(pObj._geom, qObj._geom);
          }
          return null;

        case 'center':
          var circObj = byId[def.circle];
          if (!circObj || !circObj._geom || !circObj._geom.O) return null;
          return { x: circObj._geom.O.x, y: circObj._geom.O.y };

        case 'foot':
          var pFoot = byId[def.point];
          var lFoot = byId[def.line];
          if (!pFoot || !lFoot || !pFoot._geom || !lFoot._geom) return null;
          return prim.projectPointToLine(pFoot._geom, lFoot._geom);

        case 'pole':
          var cPole = byId[def.circle];
          var lPole = byId[def.line];
          if (!cPole || !lPole || !cPole._geom || !lPole._geom) return null;
          return polar.poleOfLine(lPole._geom, cPole._geom);

        case 'offsetOnLine':
          var lOff = byId[def.line];
          var pOff = byId[def.point];
          if (!lOff || !pOff || !lOff._geom || !pOff._geom) return null;
          var worldLen = measure.refUnitsToWorld(def.length, byId);
          if (worldLen === null) return null;
          var sign = def.sign >= 0 ? 1 : -1;
          return vec.add(pOff._geom, vec.scale(lOff._geom.d, sign * worldLen));

        case 'rectCorner':
          var lRect = byId[def.line];
          var pRect = byId[def.point];
          if (!lRect || !pRect || !lRect._geom || !pRect._geom) return null;
          var aW = measure.refUnitsToWorld(def.a, byId);
          var bW = measure.refUnitsToWorld(def.b, byId);
          if (aW === null || bW === null) return null;
          var corners = prim.rectangleCorners(lRect._geom, pRect._geom, aW, bW, def.su, def.sv);
          return corners[def.corner || 0] || null;

        case 'angleArm':
          var lArm = byId[def.line];
          var vArm = byId[def.vertex];
          if (!lArm || !vArm || !lArm._geom || !vArm._geom) return null;
          var baseDir = vec.scale(lArm._geom.d, (def.baseSign >= 0 ? 1 : -1));
          var rad = (def.deg * Math.PI) / 180;
          var rotDir = vec.rot(baseDir, (def.rotSign >= 0 ? 1 : -1) * rad);
          var armR = def.r || 2.0; // World unit arm length
          return vec.add(vArm._geom, vec.scale(rotDir, armR));

        default:
          return null;
      }
    },

    _evalLine: function (def, extent, byId) {
      switch (def.kind) {
        case 'twoPoints':
          var p1 = byId[def.p];
          var p2 = byId[def.q];
          if (!p1 || !p2 || !p1._geom || !p2._geom) return null;
          var l2P = prim.createLineFromTwoPoints(p1._geom, p2._geom);
          if (!l2P) return null;
          l2P.P0 = { x: p1._geom.x, y: p1._geom.y };
          l2P.P1 = { x: p2._geom.x, y: p2._geom.y };
          return l2P;

        case 'parallel':
          var lOrig = byId[def.line];
          var pPar = byId[def.point];
          if (!lOrig || !pPar || !lOrig._geom || !pPar._geom) return null;
          var lPar = prim.parallelLineThroughPoint(lOrig._geom, pPar._geom);
          lPar.P0 = { x: pPar._geom.x, y: pPar._geom.y };
          var pDir = def.reverse ? vec.scale(lPar.d, -1) : lPar.d;
          lPar.P1 = vec.add(pPar._geom, pDir);
          return lPar;

        case 'polar':
          var cPol = byId[def.circle];
          var pPol = byId[def.point];
          if (!cPol || !pPol || !cPol._geom || !pPol._geom) return null;
          var lPol = polar.polarOfPoint(pPol._geom, cPol._geom);
          if (!lPol) return null;
          lPol.P0 = lPol.P;
          lPol.P1 = vec.add(lPol.P, lPol.d);
          return lPol;

        case 'altitude':
          var pAlt = byId[def.point];
          var lAlt = byId[def.line];
          if (!pAlt || !lAlt || !pAlt._geom || !lAlt._geom) return null;
          var foot = prim.projectPointToLine(pAlt._geom, lAlt._geom);
          var dAlt = vec.sub(foot, pAlt._geom);
          var lenAlt = vec.len(dAlt);
          if (lenAlt < EPS) return null; // Degenerate altitude
          var lSeg = prim.createLineFromTwoPoints(pAlt._geom, foot);
          if (!lSeg) return null;
          if (def.reverse) {
            lSeg.P0 = foot;
            lSeg.P1 = { x: pAlt._geom.x, y: pAlt._geom.y };
          } else {
            lSeg.P0 = { x: pAlt._geom.x, y: pAlt._geom.y };
            lSeg.P1 = foot;
          }
          return lSeg;

        case 'bisector':
          var pA = byId[def.a];
          var pV = byId[def.vertex];
          var pB = byId[def.b];
          if (!pA || !pV || !pB || !pA._geom || !pV._geom || !pB._geom) return null;
          var u1 = vec.normalize(vec.sub(pA._geom, pV._geom));
          var u2 = vec.normalize(vec.sub(pB._geom, pV._geom));
          if (!u1 || !u2) return null;
          var w = vec.add(u1, u2);
          var bDir;
          if (vec.len(w) < EPS) {
            bDir = vec.perp(u1);
          } else {
            bDir = vec.normalize(w);
          }
          if (!bDir) return null;
          var isRev = !!def.reverse ^ (def.direction === 1);
          var finalDir = isRev ? vec.scale(bDir, -1) : bDir;
          var p1 = vec.add(pV._geom, finalDir);
          var lBis = prim.createLineFromTwoPoints(pV._geom, p1);
          if (!lBis) return null;
          lBis.P0 = { x: pV._geom.x, y: pV._geom.y };
          lBis.P1 = { x: p1.x, y: p1.y };
          return lBis;

        case 'perpendicularBisector':
        case 'perpBisector':
          var pPB1 = byId[def.p];
          var pPB2 = byId[def.q];
          if (!pPB1 || !pPB2 || !pPB1._geom || !pPB2._geom) return null;
          var lPB = prim.perpendicularBisector(pPB1._geom, pPB2._geom);
          if (!lPB) return null;
          var midPB = vec.scale(vec.add(pPB1._geom, pPB2._geom), 0.5);
          lPB.P0 = { x: midPB.x, y: midPB.y };
          var pbDir = def.reverse ? vec.scale(lPB.d, -1) : lPB.d;
          lPB.P1 = vec.add(midPB, pbDir);
          return lPB;

        default:
          return null;
      }
    },

    _evalCircle: function (def, byId) {
      switch (def.kind) {
        case 'threePoints':
          var a = byId[def.a];
          var b = byId[def.b];
          var c = byId[def.c];
          if (!a || !b || !c || !a._geom || !b._geom || !c._geom) return null;
          return prim.circumcircle(a._geom, b._geom, c._geom);

        case 'centerPoint':
          var cen = byId[def.center];
          var pt = byId[def.p];
          if (!cen || !pt || !cen._geom || !pt._geom) return null;
          return prim.circleCenterPoint(cen._geom, pt._geom);

        case 'centerTangent':
          var cenT = byId[def.center];
          var lineT = byId[def.line];
          if (!cenT || !lineT || !cenT._geom || !lineT._geom) return null;
          return prim.circleCenterTangent(cenT._geom, lineT._geom);

        case 'tangent3L':
          var l1 = byId[def.l1];
          var l2 = byId[def.l2];
          var l3 = byId[def.l3];
          if (!l1 || !l2 || !l3 || !l1._geom || !l2._geom || !l3._geom) return null;
          var sols3L = circ.tangent3Lines(l1._geom, l2._geom, l3._geom);
          var targetBranch = def.branch || 0;
          for (var i = 0; i < sols3L.length; i++) {
            if (sols3L[i].branch === targetBranch) return sols3L[i].circle;
          }
          return sols3L[0] ? sols3L[0].circle : null;

        case 'tangent2P1L':
          var pPPL = byId[def.p];
          var qPPL = byId[def.q];
          var lPPL = byId[def.line];
          if (!pPPL || !qPPL || !lPPL || !pPPL._geom || !qPPL._geom || !lPPL._geom) return null;
          var solsPPL = circ.tangent2Points1Line(pPPL._geom, qPPL._geom, lPPL._geom);
          var brPPL = def.branch || 0;
          return solsPPL[brPPL] ? solsPPL[brPPL].circle : (solsPPL[0] ? solsPPL[0].circle : null);

        case 'tangent1P2L':
          var pPLL = byId[def.p];
          var l1PLL = byId[def.l1];
          var l2PLL = byId[def.l2];
          if (!pPLL || !l1PLL || !l2PLL || !pPLL._geom || !l1PLL._geom || !l2PLL._geom) return null;
          var solsPLL = circ.tangent1Point2Lines(pPLL._geom, l1PLL._geom, l2PLL._geom);
          var brPLL = def.branch || 0;
          return solsPLL[brPLL] ? solsPLL[brPLL].circle : (solsPLL[0] ? solsPLL[0].circle : null);

        default:
          return null;
      }
    },

    _evalAngle: function (def, style, byId) {
      var V, u1, u2;
      if (def.kind === 'threePoints') {
        var a = byId[def.a];
        var v = byId[def.vertex];
        var b = byId[def.b];
        if (!a || !v || !b || !a._geom || !v._geom || !b._geom) return null;
        V = v._geom;
        u1 = vec.normalize(vec.sub(a._geom, V));
        u2 = vec.normalize(vec.sub(b._geom, V));
      } else if (def.kind === 'twoRays') {
        var r1 = byId[def.r1];
        var r2 = byId[def.r2];
        if (!r1 || !r2 || !r1._geom || !r2._geom) return null;
        V = r1._geom.P0;
        u1 = r1._geom.d;
        u2 = r2._geom.d;
      } else if (def.kind === 'fromLine') {
        var lObj = byId[def.line];
        var vObj = byId[def.vertex];
        if (!lObj || !vObj || !lObj._geom || !vObj._geom) return null;
        V = vObj._geom;
        var baseDir = vec.scale(lObj._geom.d, (def.baseSign >= 0 ? 1 : -1));
        var rad = (def.deg * Math.PI) / 180;
        var armDir = vec.rot(baseDir, (def.rotSign >= 0 ? 1 : -1) * rad);
        u1 = baseDir;
        u2 = armDir;
      } else {
        return null;
      }

      if (!V || !u1 || !u2) return null;
      var sweep = vec.angleBetween(u1, u2);
      return {
        V: V,
        u1: u1,
        u2: u2,
        sweep: sweep
      };
    },

    _evalPolygon: function (def, byId) {
      if (def.kind === 'rectangle') {
        var l = byId[def.line];
        var p = byId[def.point];
        if (!l || !p || !l._geom || !p._geom) return null;
        var aW = measure.refUnitsToWorld(def.a, byId);
        var bW = measure.refUnitsToWorld(def.b, byId);
        if (aW === null || bW === null) return null;
        var corners = prim.rectangleCorners(l._geom, p._geom, aW, bW, def.su, def.sv);
        return {
          vertices: corners,
          a: def.a,
          b: def.b,
          area: def.a * def.b,
          perimeter: 2 * (def.a + def.b)
        };
      }
      return null;
    },

    _evalMeasure: function (def, byId) {
      switch (def.kind) {
        case 'length':
          var seg = byId[def.seg];
          if (!seg || !seg._geom || !seg._geom.P0 || !seg._geom.P1) return null;
          var wLen = vec.dist(seg._geom.P0, seg._geom.P1);
          var rLen = measure.worldToRefUnits(wLen, byId);
          return { worldVal: wLen, refVal: rLen, P0: seg._geom.P0, P1: seg._geom.P1 };

        case 'distPP':
          var p1 = byId[def.p];
          var p2 = byId[def.q];
          if (!p1 || !p2 || !p1._geom || !p2._geom) return null;
          var d = vec.dist(p1._geom, p2._geom);
          var rd = measure.worldToRefUnits(d, byId);
          return { worldVal: d, refVal: rd, P0: p1._geom, P1: p2._geom };

        case 'distPL':
          var pt = byId[def.p];
          var ln = byId[def.line];
          if (!pt || !ln || !pt._geom || !ln._geom) return null;
          var dPL = prim.distPointToLine(pt._geom, ln._geom);
          var rdPL = measure.worldToRefUnits(dPL, byId);
          var foot = prim.projectPointToLine(pt._geom, ln._geom);
          return { worldVal: dPL, refVal: rdPL, P0: pt._geom, P1: foot };

        case 'angle':
          var ang = byId[def.angle];
          if (!ang || !ang._geom) return null;
          return { sweep: ang._geom.sweep, rad: ang._geom.sweep, deg: (ang._geom.sweep * 180) / Math.PI };

        case 'circle':
          var cObj = byId[def.circle];
          if (!cObj || !cObj._geom) return null;
          var rW = cObj._geom.r;
          var rRef = measure.worldToRefUnits(rW, byId);
          return {
            r: rRef,
            d: rRef ? rRef * 2 : null,
            C: rRef ? 2 * Math.PI * rRef : null,
            A: rRef ? Math.PI * rRef * rRef : null,
            what: def.what || 'r'
          };

        case 'polygon':
          var poly = byId[def.polygon];
          if (!poly || !poly._geom) return null;
          return {
            A: poly._geom.area,
            P: poly._geom.perimeter,
            what: def.what || 'A'
          };

        default:
          return null;
      }
    },

    toJSON: function () {
      var doc = {
        format: 'euclid-sketch',
        version: Geo.VERSION,
        reference: measure.reference ? {
          seg: measure.reference.segId,
          value: measure.reference.value,
          unit: measure.reference.unit
        } : null,
        objects: []
      };

      for (var i = 0; i < this.objects.length; i++) {
        var obj = this.objects[i];
        doc.objects.push({
          id: obj.id,
          type: obj.type,
          extent: obj.extent,
          def: obj.def,
          label: obj.label,
          style: obj.style,
          visible: obj.visible,
          aux: obj.aux,
          group: obj.group
        });
      }
      return doc;
    },

    fromJSON: function (doc) {
      if (!doc || doc.format !== 'euclid-sketch') {
        throw new Error('Invalid document format');
      }
      this.clear();
      var maxNum = 0;

      if (doc.reference) {
        measure.setReference(doc.reference.seg, doc.reference.value, doc.reference.unit);
      }

      if (Array.isArray(doc.objects)) {
        for (var i = 0; i < doc.objects.length; i++) {
          var o = doc.objects[i];
          var numMatch = o.id.match(/^o(\d+)$/);
          if (numMatch) {
            var n = parseInt(numMatch[1], 10);
            if (n > maxNum) maxNum = n;
          }
          this.objects.push(o);
          this.objectsById[o.id] = o;
        }
      }

      Geo.model.objects.resetIdCounter(maxNum + 1);
      this.recomputeAll();
      Geo.events.emit('graph:changed');
    }
  };

  Geo.model.Graph = Graph;
  Geo.model.graph = new Graph();
})(window.Geo);
