/**
 * Euclid Sketch — Labels, Typography & Auto-Naming
 */
(function (Geo) {
  'use strict';

  var GREEK_MAP = {
    'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ',
    'epsilon': 'ε', 'zeta': 'ζ', 'eta': 'η', 'theta': 'θ',
    'iota': 'ι', 'kappa': 'κ', 'lambda': 'λ', 'mu': 'μ',
    'nu': 'ν', 'xi': 'ξ', 'omicron': 'ο', 'pi': 'π',
    'rho': 'ρ', 'sigma': 'σ', 'tau': 'τ', 'upsilon': 'υ',
    'phi': 'φ', 'chi': 'χ', 'psi': 'ψ', 'omega': 'ω'
  };

  var GREEK_LOWER_LIST = [
    'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ',
    'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π',
    'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω'
  ];
  var GREEK_LIST = GREEK_LOWER_LIST;

  var GREEK_UPPER_LIST = [
    'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ',
    'Ι', 'Κ', 'Λ', 'Μ', 'Ν', 'Ξ', 'Ο', 'Π',
    'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω'
  ];

  var labels = {
    GREEK_LIST: GREEK_LOWER_LIST,
    GREEK_LOWER_LIST: GREEK_LOWER_LIST,
    GREEK_UPPER_LIST: GREEK_UPPER_LIST,
    GREEK_MAP: GREEK_MAP,

    // Convert names like "\alpha" or "alpha" to Greek unicode
    replaceGreekNames: function (text) {
      if (!text) return '';
      var s = text;
      for (var name in GREEK_MAP) {
        var reSlash = new RegExp('\\\\' + name, 'gi');
        s = s.replace(reSlash, GREEK_MAP[name]);
        // Also match bare word if exactly equal, or before underscore/digits
        var reBare = new RegExp('^' + name + '(?=(_|\\d|$))', 'gi');
        s = s.replace(reBare, GREEK_MAP[name]);
      }
      return s;
    },

    // Normalize input text based on object type
    normalizeInput: function (type, input) {
      if (!input) return '';
      var s = input.trim();
      s = labels.replaceGreekNames(s);

      if (type === 'point') {
        // Automatically convert trailing digits to subscripts, e.g. A1 -> A_1, Ω1 -> Ω_1
        if (/^([a-zA-Z]|[Α-Ωα-ω])'{0,3}\d+$/.test(s)) {
          var base = s.match(/^([a-zA-Z]|[Α-Ωα-ω])'{0,3}/)[0];
          if (/^[a-z]/.test(base)) base = base.charAt(0).toUpperCase() + base.slice(1);
          var digits = s.slice(base.length);
          return base + '_' + digits;
        }
        if (/^[a-z]/.test(s)) {
          // Ensure first ASCII character is uppercase
          s = s.charAt(0).toUpperCase() + s.slice(1);
        }
      } else if (type === 'line' || type === 'ray' || type === 'angle' || type === 'circle') {
        // Auto-convert trailing digits to subscript: a1 -> a_1, alpha2 -> α_2, Γ1 -> Γ_1
        if (/^([a-zA-Z]|[Α-Ωα-ω])\d+$/.test(s)) {
          var charPart = s.match(/^([a-zA-Z]|[Α-Ωα-ω])/)[0];
          if (/^[A-Z]/.test(charPart)) charPart = charPart.toLowerCase();
          var digPart = s.slice(charPart.length);
          return charPart + '_' + digPart;
        }
        if (/^[A-Z]/.test(s)) {
          s = s.toLowerCase();
        }
      }
      return s;
    },

    // Validate normalized label text
    isValid: function (type, text) {
      if (!text || text.length === 0) return true; // Empty labels are allowed
      if (text.length > 32) return false;

      if (type === 'point') {
        return /^([A-Z]|[Α-Ωα-ω])'{0,3}(_[A-Za-z0-9Α-Ωα-ω]{1,4})?$/.test(text);
      }
      if (type === 'line' || type === 'ray' || type === 'angle' || type === 'circle') {
        return /^([a-z]|[Α-Ωα-ω])'{0,3}(_[A-Za-z0-9Α-Ωα-ω]{1,4})?$/.test(text);
      }
      if (type === 'polygon') {
        return /^[A-ZΑ-Ω]{3,8}$|^([a-z]|[Α-Ωα-ω])(_[A-Za-z0-9Α-Ωα-ω]{1,4})?$/.test(text);
      }
      if (type === 'segment') {
        // Segment expressions: algebraic expression grammar check
        return /^[0-9A-Za-zΑ-Ωα-ω+\-*/().^_={}'\s·√]+$/.test(text);
      }
      return true;
    },

    // Format display string into parts: base, primes, subscript
    parseLabelParts: function (text) {
      if (!text) return null;
      var match = text.match(/^([^'_]+)('{0,3})(?:_([^{}]+|\{[^}]+\}))?$/);
      if (!match) return { base: text, primes: '', sub: '' };
      var sub = match[3] || '';
      if (sub.charAt(0) === '{' && sub.charAt(sub.length - 1) === '}') {
        sub = sub.slice(1, -1);
      }
      return {
        base: match[1],
        primes: match[2] || '',
        sub: sub
      };
    },

    // Generate next available label
    nextAvailableLabel: function (type, existingObjects, prefixHint) {
      var used = {};
      for (var i = 0; i < existingObjects.length; i++) {
        var obj = existingObjects[i];
        if (obj.label && obj.label.text) {
          used[obj.label.text] = true;
        }
      }

      if (type === 'point') {
        var preferred = prefixHint || null;
        if (preferred && !used[preferred]) return preferred;

        var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (var idx = 0; idx < letters.length; idx++) {
          var candidate = letters[idx];
          if (!used[candidate]) return candidate;
        }
        // Then try subscripts: A_1, B_1, ...
        for (var sub = 1; sub <= 99; sub++) {
          for (var j = 0; j < letters.length; j++) {
            var candSub = letters[j] + '_' + sub;
            if (!used[candSub]) return candSub;
          }
        }
        return 'P';
      }

      if (type === 'line' || type === 'ray') {
        var lineLetters = 'abcdefghijklmnopqrstuvwxyz';
        for (var li = 0; li < lineLetters.length; li++) {
          var lCandidate = lineLetters[li];
          if (!used[lCandidate]) return lCandidate;
        }
        for (var lSub = 1; lSub <= 99; lSub++) {
          for (var lj = 0; lj < lineLetters.length; lj++) {
            var lCandSub = lineLetters[lj] + '_' + lSub;
            if (!used[lCandSub]) return lCandSub;
          }
        }
        return 'l';
      }

      if (type === 'circle') {
        var cLetters = ['c', 'd', 'e', 'k', 'ω'];
        for (var ci = 0; ci < cLetters.length; ci++) {
          if (!used[cLetters[ci]]) return cLetters[ci];
        }
        for (var cSub = 1; cSub <= 99; cSub++) {
          for (var cj = 0; cj < cLetters.length; cj++) {
            var cCandSub = cLetters[cj] + '_' + cSub;
            if (!used[cCandSub]) return cCandSub;
          }
        }
        return 'c';
      }

      if (type === 'angle') {
        for (var ai = 0; ai < GREEK_LIST.length; ai++) {
          if (!used[GREEK_LIST[ai]]) return GREEK_LIST[ai];
        }
        for (var aSub = 1; aSub <= 99; aSub++) {
          for (var aj = 0; aj < GREEK_LIST.length; aj++) {
            var aCandSub = GREEK_LIST[aj] + '_' + aSub;
            if (!used[aCandSub]) return aCandSub;
          }
        }
        return 'α';
      }

      return '';
    },

    estimateTextWidth: function (text) {
      if (!text) return 12;
      var parts = labels.parseLabelParts(text);
      if (!parts) return Math.max(12, text.length * 10);
      var baseLen = (parts.base || '').length + (parts.primes || '').length;
      var subLen = (parts.sub || '').length;
      return Math.max(12, baseLen * 10 + subLen * 7);
    },

    getLabelAnchorScreen: function (obj, camera) {
      if (Geo.view && Geo.view.mainPainter && Geo.view.mainPainter.getLabelAnchorScreen) {
        var s = Geo.view.mainPainter.getLabelAnchorScreen(obj);
        if (s) return s;
      }
      var geom = obj._geom;
      if (!geom || !camera) return null;
      var vec = Geo.kernel.vec;
      if (obj.type === 'point') {
        return camera.worldToScreen(geom);
      }
      if (obj.type === 'line') {
        if (obj.extent === 'segment' && geom.P0 && geom.P1) {
          return camera.worldToScreen(vec.midpoint(geom.P0, geom.P1));
        }
        if (geom.P0) return camera.worldToScreen(geom.P0);
      }
      if (obj.type === 'circle' && geom.O && geom.r !== undefined) {
        var p45 = {
          x: geom.O.x + geom.r * Math.SQRT1_2,
          y: geom.O.y + geom.r * Math.SQRT1_2
        };
        return camera.worldToScreen(p45);
      }
      return null;
    },

    getLabelBoundingBox: function (obj, anchorScreen, dx, dy) {
      if (!obj || !obj.label) return null;
      var w = labels.estimateTextWidth(obj.label.text);
      var posX = anchorScreen.x + ((dx !== undefined) ? dx : (obj.label.dx || 8));
      var posY = anchorScreen.y + ((dy !== undefined) ? dy : (obj.label.dy || -10));
      return {
        x: posX - 3,
        y: posY - 14,
        width: w + 6,
        height: 18,
        anchor: anchorScreen,
        pos: { x: posX, y: posY }
      };
    },

    computeOptimalPlacement: function (obj, allObjects, camera, placedBoxes) {
      if (!obj || !obj._geom || !obj.label || !obj.label.text || !camera) return null;
      var anchor = labels.getLabelAnchorScreen(obj, camera);
      if (!anchor) return null;

      var vec = Geo.kernel.vec;
      var W = labels.estimateTextWidth(obj.label.text);
      var candidates = [];

      if (obj.type === 'point') {
        candidates = [
          { dx: 9, dy: -11, pref: 0 },
          { dx: -Math.round(W / 2), dy: -16, pref: 1 },
          { dx: -W - 7, dy: -11, pref: 2 },
          { dx: 12, dy: 4, pref: 3 },
          { dx: -W - 9, dy: 4, pref: 4 },
          { dx: 9, dy: 16, pref: 5 },
          { dx: -Math.round(W / 2), dy: 19, pref: 6 },
          { dx: -W - 7, dy: 16, pref: 7 },
          // Larger radius candidates if crowded:
          { dx: 14, dy: -18, pref: 10 },
          { dx: -Math.round(W / 2), dy: -24, pref: 11 },
          { dx: -W - 12, dy: -18, pref: 12 },
          { dx: 18, dy: 4, pref: 13 },
          { dx: -W - 15, dy: 4, pref: 14 },
          { dx: 14, dy: 24, pref: 15 },
          { dx: -Math.round(W / 2), dy: 27, pref: 16 },
          { dx: -W - 12, dy: 24, pref: 17 }
        ];
      } else if (obj.type === 'line' && obj._geom.P0 && obj._geom.P1) {
        var s0 = camera.worldToScreen(obj._geom.P0);
        var s1 = camera.worldToScreen(obj._geom.P1);
        var dLine = vec.sub(s1, s0);
        var u = vec.normalize(dLine) || { x: 1, y: 0 };
        var n = { x: -u.y, y: u.x };

        candidates = [
          { dx: Math.round(15 * n.x - W / 2), dy: Math.round(15 * n.y), pref: 0 },
          { dx: Math.round(-15 * n.x - W / 2), dy: Math.round(-15 * n.y), pref: 1 },
          { dx: Math.round(24 * n.x - W / 2), dy: Math.round(24 * n.y), pref: 5 },
          { dx: Math.round(-24 * n.x - W / 2), dy: Math.round(-24 * n.y), pref: 6 }
        ];
        if (obj.extent === 'segment') {
          candidates.push(
            { dx: Math.round(15 * n.x + 20 * u.x - W / 2), dy: Math.round(15 * n.y + 20 * u.y), pref: 8 },
            { dx: Math.round(-15 * n.x + 20 * u.x - W / 2), dy: Math.round(-15 * n.y + 20 * u.y), pref: 9 },
            { dx: Math.round(15 * n.x - 20 * u.x - W / 2), dy: Math.round(15 * n.y - 20 * u.y), pref: 10 },
            { dx: Math.round(-15 * n.x - 20 * u.x - W / 2), dy: Math.round(-15 * n.y - 20 * u.y), pref: 11 }
          );
        }
      } else if (obj.type === 'circle' && obj._geom.O && obj._geom.r !== undefined) {
        var sO = camera.worldToScreen(obj._geom.O);
        var sR = camera.worldDistToScreen(obj._geom.r);
        var angles = [
          Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75,
          Math.PI * 0.08, Math.PI * 0.42, Math.PI * 0.58, Math.PI * 0.92,
          Math.PI * 1.08, Math.PI * 1.42, Math.PI * 1.58, Math.PI * 1.92,
          0, Math.PI * 0.5, Math.PI, Math.PI * 1.5
        ];
        for (var a = 0; a < angles.length; a++) {
          var ang = angles[a];
          var cosA = Math.cos(ang);
          var sinA = Math.sin(ang);
          var pTarget = { x: sO.x + (sR + 12) * cosA, y: sO.y + (sR + 12) * sinA };
          if (cosA < -0.3) pTarget.x -= W;
          else if (cosA <= 0.3) pTarget.x -= W / 2;
          if (sinA < -0.3) pTarget.y -= 4;
          else if (sinA > 0.3) pTarget.y += 10;

          candidates.push({
            dx: Math.round(pTarget.x - anchor.x),
            dy: Math.round(pTarget.y - anchor.y),
            pref: a
          });
        }
      } else {
        candidates = [{ dx: 8, dy: -10, pref: 0 }];
      }

      function distPtSeg(P, A, B) {
        var l2 = vec.distSq(A, B);
        if (l2 < 1e-6) return vec.dist(P, A);
        var t = ((P.x - A.x) * (B.x - A.x) + (P.y - A.y) * (B.y - A.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        var proj = { x: A.x + t * (B.x - A.x), y: A.y + t * (B.y - A.y) };
        return vec.dist(P, proj);
      }

      function distPtLine(P, A, B) {
        var l2 = vec.distSq(A, B);
        if (l2 < 1e-6) return vec.dist(P, A);
        var t = ((P.x - A.x) * (B.x - A.x) + (P.y - A.y) * (B.y - A.y)) / l2;
        var proj = { x: A.x + t * (B.x - A.x), y: A.y + t * (B.y - A.y) };
        return vec.dist(P, proj);
      }

      var bestScore = Infinity;
      var bestCand = candidates[0];
      var bestBox = null;

      for (var c = 0; c < candidates.length; c++) {
        var cand = candidates[c];
        var box = labels.getLabelBoundingBox(obj, anchor, cand.dx, cand.dy);
        var score = cand.pref * 0.1; // Small bias for natural preferred angles
        var center = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
        var bRadius = Math.max(box.width, box.height) * 0.5;

        for (var i = 0; i < allObjects.length; i++) {
          var other = allObjects[i];
          if (!other || !other.visible || !other._geom || other === obj) continue;

          if (other.type === 'point') {
            var sP = camera.worldToScreen(other._geom);
            if (sP.x >= box.x - 5 && sP.x <= box.x + box.width + 5 &&
                sP.y >= box.y - 5 && sP.y <= box.y + box.height + 5) {
              score += 150;
            }
          } else if (other.type === 'line' && other._geom.P0 && other._geom.P1) {
            var lineS0 = camera.worldToScreen(other._geom.P0);
            var lineS1 = camera.worldToScreen(other._geom.P1);
            var dL = (other.extent === 'segment') ?
              distPtSeg(center, lineS0, lineS1) :
              distPtLine(center, lineS0, lineS1);
            if (dL < bRadius + 4) {
              score += 35;
            }
          } else if (other.type === 'circle' && other._geom.O && other._geom.r !== undefined) {
            var circSO = camera.worldToScreen(other._geom.O);
            var circSR = camera.worldDistToScreen(other._geom.r);
            var dC = vec.dist(center, circSO);
            if (Math.abs(dC - circSR) < bRadius + 6) {
              score += 35;
            }
          }
        }

        if (placedBoxes) {
          for (var pb = 0; pb < placedBoxes.length; pb++) {
            var pBox = placedBoxes[pb];
            if (pBox.objId === obj.id) continue;
            var overlap = !(box.x + box.width < pBox.x ||
                            box.x > pBox.x + pBox.width ||
                            box.y + box.height < pBox.y ||
                            box.y > pBox.y + pBox.height);
            if (overlap) {
              score += 120;
            }
          }
        }

        if (score < bestScore) {
          bestScore = score;
          bestCand = cand;
          bestBox = box;
        }
      }

      return {
        dx: bestCand.dx,
        dy: bestCand.dy,
        box: bestBox,
        score: bestScore
      };
    },

    optimizePlacements: function (allObjects, camera) {
      if (!allObjects || !camera) return;
      var placedBoxes = [];

      // Collect manually positioned labels first
      for (var i = 0; i < allObjects.length; i++) {
        var obj = allObjects[i];
        if (obj.visible && obj._geom && obj.label && obj.label.visible && obj.label.text) {
          if (obj.label.manual) {
            var anchor = labels.getLabelAnchorScreen(obj, camera);
            if (anchor) {
              var dx = (obj.label.dx !== undefined) ? obj.label.dx : 8;
              var dy = (obj.label.dy !== undefined) ? obj.label.dy : -10;
              var box = labels.getLabelBoundingBox(obj, anchor, dx, dy);
              if (box) {
                box.objId = obj.id;
                placedBoxes.push(box);
              }
            }
          }
        }
      }

      // Optimize automatic labels
      for (var j = 0; j < allObjects.length; j++) {
        var target = allObjects[j];
        if (target.visible && target._geom && target.label && target.label.visible && target.label.text) {
          if (!target.label.manual) {
            var best = labels.computeOptimalPlacement(target, allObjects, camera, placedBoxes);
            if (best) {
              target.label.dx = best.dx;
              target.label.dy = best.dy;
              if (best.box) {
                best.box.objId = target.id;
                placedBoxes.push(best.box);
              }
            }
          }
        }
      }
    }
  };

  Geo.model.labels = labels;
})(window.Geo);
