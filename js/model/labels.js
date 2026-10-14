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
    }
  };

  Geo.model.labels = labels;
})(window.Geo);
