/**
 * Euclid Sketch — Namespace & Core Constants
 */
(function (root) {
  'use strict';

  var Geo = {
    EPS: 1e-10,
    VERSION: 1,
    kernel: {},
    model: {},
    view: {},
    tools: {},
    ui: {},

    // Event bus for decoupled UI updates
    events: {
      _listeners: {},
      on: function (event, fn) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(fn);
      },
      off: function (event, fn) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(function (f) { return f !== fn; });
      },
      emit: function (event, data) {
        if (!this._listeners[event]) return;
        var list = this._listeners[event].slice();
        for (var i = 0; i < list.length; i++) {
          try {
            list[i](data);
          } catch (e) {
            console.error('Error in event listener for', event, e);
          }
        }
      }
    },

    // Safe mathematical expression evaluator for inputs (e.g. "3/2", "sqrt(2)", "2*pi")
    evalMathExpr: function (str) {
      if (typeof str === 'number') return isFinite(str) ? str : null;
      if (!str || typeof str !== 'string') return null;
      var clean = str.trim().toLowerCase()
        .replace(/π/g, 'pi')
        .replace(/√/g, 'sqrt')
        .replace(/×/g, '*')
        .replace(/÷/g, '/');

      // Check for valid math characters only
      if (!/^[0-9+\-*/().\s,a-z]+$/.test(clean)) return null;

      // Safe tokenization & recursive descent parser
      var pos = 0;
      function peek() {
        while (pos < clean.length && clean[pos] === ' ') pos++;
        return pos < clean.length ? clean[pos] : null;
      }
      function getChar() {
        var c = peek();
        if (c !== null) pos++;
        return c;
      }
      function parseExpr() {
        var val = parseTerm();
        while (true) {
          var op = peek();
          if (op === '+' || op === '-') {
            getChar();
            var rhs = parseTerm();
            val = (op === '+') ? val + rhs : val - rhs;
          } else {
            break;
          }
        }
        return val;
      }
      function parseTerm() {
        var val = parseFactor();
        while (true) {
          var op = peek();
          if (op === '*' || op === '/') {
            getChar();
            var rhs = parseFactor();
            val = (op === '*') ? val * rhs : val / rhs;
          } else {
            break;
          }
        }
        return val;
      }
      function parseFactor() {
        var c = peek();
        if (c === '+') { getChar(); return parseFactor(); }
        if (c === '-') { getChar(); return -parseFactor(); }
        if (c === '(') {
          getChar();
          var v = parseExpr();
          if (peek() === ')') getChar();
          return v;
        }

        // Identifier or number
        if (/[a-z]/.test(c)) {
          var id = '';
          while (pos < clean.length && /[a-z]/.test(clean[pos])) {
            id += clean[pos++];
          }
          if (id === 'pi') return Math.PI;
          if (id === 'e') return Math.E;
          if (id === 'sqrt') {
            if (peek() === '(') {
              getChar();
              var inner = parseExpr();
              if (peek() === ')') getChar();
              return Math.sqrt(inner);
            }
          }
          if (id === 'sin' || id === 'cos' || id === 'tan') {
            if (peek() === '(') {
              getChar();
              var arg = parseExpr();
              if (peek() === ')') getChar();
              return Math[id](arg);
            }
          }
          return null;
        }

        // Number
        var numStr = '';
        while (pos < clean.length && /[0-9.]/.test(clean[pos])) {
          numStr += clean[pos++];
        }
        var num = parseFloat(numStr);
        return isNaN(num) ? null : num;
      }

      try {
        var res = parseExpr();
        return (typeof res === 'number' && isFinite(res)) ? res : null;
      } catch (err) {
        return null;
      }
    }
  };

  root.Geo = Geo;
})(typeof window !== 'undefined' ? window : this);
