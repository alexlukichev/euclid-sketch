/**
 * Euclid Sketch — Native Modal Dialogs Controller
 */
(function (Geo) {
  'use strict';

  var dialogs = {
    // Show a number input modal dialog
    showNumberPrompt: function (opts) {
      var d = document.getElementById('dialog-number');
      if (!d) return;

      var titleEl = d.querySelector('.dialog-title');
      var promptEl = d.querySelector('.dialog-prompt');
      var inputEl = d.querySelector('.dialog-input');
      var previewEl = d.querySelector('.dialog-eval-preview');
      var confirmBtn = d.querySelector('.btn-confirm');
      var cancelBtn = d.querySelector('.btn-cancel');

      titleEl.textContent = opts.title || 'Enter Value';
      promptEl.textContent = opts.prompt || 'Value:';
      inputEl.value = opts.defaultValue || '';
      previewEl.textContent = '';

      function updatePreview() {
        var res = Geo.evalMathExpr(inputEl.value);
        if (res !== null && isFinite(res)) {
          previewEl.textContent = '= ' + res.toFixed(4);
          previewEl.style.color = 'var(--text-3)';
          confirmBtn.disabled = false;
        } else {
          previewEl.textContent = 'Invalid expression';
          previewEl.style.color = 'var(--danger)';
          confirmBtn.disabled = true;
        }
      }

      inputEl.oninput = updatePreview;
      updatePreview();

      function onConfirm() {
        var res = Geo.evalMathExpr(inputEl.value);
        if (res !== null) {
          d.close();
          if (opts.onConfirm) opts.onConfirm(res);
        }
      }

      function onCancel() {
        d.close();
        if (opts.onCancel) opts.onCancel();
      }

      confirmBtn.onclick = onConfirm;
      cancelBtn.onclick = onCancel;
      inputEl.onkeydown = function (e) {
        if (e.key === 'Enter') onConfirm();
        if (e.key === 'Escape') onCancel();
      };

      d.showModal();
      inputEl.focus();
      inputEl.select();
    },

    // Show rectangle sides modal
    showRectangleDialog: function (opts) {
      var d = document.getElementById('dialog-rectangle');
      if (!d) return;

      var inputA = d.querySelector('#rect-input-a');
      var inputB = d.querySelector('#rect-input-b');
      var checkSquare = d.querySelector('#rect-check-square');
      var unitLabel = d.querySelector('.rect-unit-label');
      var confirmBtn = d.querySelector('.btn-confirm');
      var cancelBtn = d.querySelector('.btn-cancel');

      unitLabel.textContent = opts.unit || '';
      inputA.value = '4';
      inputB.value = '3';
      checkSquare.checked = false;
      inputB.disabled = false;

      checkSquare.onchange = function () {
        if (checkSquare.checked) {
          inputB.value = inputA.value;
          inputB.disabled = true;
        } else {
          inputB.disabled = false;
        }
      };

      inputA.oninput = function () {
        if (checkSquare.checked) inputB.value = inputA.value;
      };

      function onConfirm() {
        var a = Geo.evalMathExpr(inputA.value);
        var b = checkSquare.checked ? a : Geo.evalMathExpr(inputB.value);
        if (a > 0 && b > 0) {
          d.close();
          if (opts.onConfirm) opts.onConfirm(a, b);
        }
      }

      confirmBtn.onclick = onConfirm;
      cancelBtn.onclick = function () { d.close(); };

      d.showModal();
      inputA.focus();
    },

    // Show reference required modal (blocking flow)
    showReferenceRequired: function (opts) {
      var d = document.getElementById('dialog-reference-required');
      if (!d) return;

      var actionName = d.querySelector('.ref-action-name');
      var setNowBtn = d.querySelector('.btn-set-ref-now');
      var cancelBtn = d.querySelector('.btn-cancel');

      actionName.textContent = opts.action || 'This construction';

      setNowBtn.onclick = function () {
        d.close();
        Geo.tools.controller.activate('set_reference');
      };

      cancelBtn.onclick = function () {
        d.close();
        Geo.tools.controller.resetToSelect();
      };

      d.showModal();
    },

    // Show set reference dialog
    showSetReference: function (opts) {
      var d = document.getElementById('dialog-set-reference');
      if (!d) return;

      var inputVal = d.querySelector('#ref-input-val');
      var inputUnit = d.querySelector('#ref-input-unit');
      var confirmBtn = d.querySelector('.btn-confirm');
      var cancelBtn = d.querySelector('.btn-cancel');

      inputVal.value = '5';
      inputUnit.value = 'cm';

      confirmBtn.onclick = function () {
        var val = parseFloat(inputVal.value);
        if (val > 0) {
          d.close();
          if (opts.onConfirm) opts.onConfirm(val, inputUnit.value);
        }
      };

      cancelBtn.onclick = function () { d.close(); };
      d.showModal();
      inputVal.focus();
      inputVal.select();
    },

    // Show shortcut sheet
    showShortcuts: function () {
      var d = document.getElementById('dialog-shortcuts');
      if (d) d.showModal();
    }
  };

  Geo.ui.dialogs = dialogs;

  // Bind global dialog events
  Geo.events.on('dialog:number', function (opts) { dialogs.showNumberPrompt(opts); });
  Geo.events.on('dialog:rectangle', function (opts) { dialogs.showRectangleDialog(opts); });
  Geo.events.on('dialog:reference', function (opts) { dialogs.showSetReference(opts); });
  Geo.events.on('reference:required', function (opts) { dialogs.showReferenceRequired(opts); });
})(window.Geo);
