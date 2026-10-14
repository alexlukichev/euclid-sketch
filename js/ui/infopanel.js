/**
 * Euclid Sketch — Info Panel & Properties Inspector
 */
(function (Geo) {
  'use strict';

  var graph = Geo.model.graph;
  var measure = Geo.model.measure;
  var labels = Geo.model.labels;
  var vec = Geo.kernel.vec;

  var PALETTE = ['ink', 'blue', 'red', 'green', 'orange', 'purple', 'teal', 'gray'];

  var infopanel = {
    panelEl: null,
    currentTab: 'properties',
    greekPickerOpen: false,
    greekPickerCase: 'lower',

    init: function () {
      this.panelEl = document.getElementById('info-panel');
      if (!this.panelEl) return;

      var self = this;
      // Tab switching
      var tabProps = document.getElementById('tab-btn-properties');
      var tabObjs = document.getElementById('tab-btn-objects');

      if (tabProps && tabObjs) {
        tabProps.onclick = function () { self.switchTab('properties'); };
        tabObjs.onclick = function () { self.switchTab('objects'); };
      }

      Geo.events.on('selection:changed', function (selected) {
        self.update(selected);
      });

      Geo.events.on('graph:recomputed', function () {
        self.update(Geo.tools.selection.getSelectedObjects());
      });
    },

    switchTab: function (tab) {
      this.currentTab = tab;
      var tabProps = document.getElementById('tab-btn-properties');
      var tabObjs = document.getElementById('tab-btn-objects');
      var paneProps = document.getElementById('pane-properties');
      var paneObjs = document.getElementById('pane-objects');

      if (tab === 'properties') {
        if (tabProps && tabProps.classList) tabProps.classList.add('active');
        if (tabObjs && tabObjs.classList) tabObjs.classList.remove('active');
        if (paneProps) paneProps.style.display = 'block';
        if (paneObjs) paneObjs.style.display = 'none';
        this.update(Geo.tools.selection.getSelectedObjects());
      } else {
        if (tabObjs && tabObjs.classList) tabObjs.classList.add('active');
        if (tabProps && tabProps.classList) tabProps.classList.remove('active');
        if (paneProps) paneProps.style.display = 'none';
        if (paneObjs) paneObjs.style.display = 'block';
        this.renderObjectsList();
      }
    },

    update: function (selected) {
      if (this.currentTab === 'objects') {
        this.renderObjectsList();
        return;
      }

      var container = document.getElementById('pane-properties');
      if (!container) return;

      if (!selected || selected.length === 0) {
        container.innerHTML = this.renderEmptyState();
        return;
      }

      if (selected.length === 1) {
        container.innerHTML = this.renderSingleObject(selected[0]);
        this.bindSingleObjectEvents(selected[0], container);
      } else {
        container.innerHTML = this.renderMultiSelection(selected);
        this.bindMultiSelectionEvents(selected, container);
      }
    },

    renderEmptyState: function () {
      var refText = measure.hasReference() ?
        'Reference: ' + measure.reference.value + ' ' + (measure.reference.unit || '') :
        'No reference segment set';

      return [
        '<div class="panel-empty-state">',
        '  <div class="empty-icon">📐</div>',
        '  <div class="empty-title">Euclid Sketch</div>',
        '  <div class="empty-desc">Select an object on the canvas to inspect and edit its properties.</div>',
        '  <div class="empty-doc-info">',
        '    <div>Objects: <strong>' + graph.objects.length + '</strong></div>',
        '    <div>' + refText + '</div>',
        '  </div>',
        '</div>'
      ].join('\n');
    },

    renderGreekGridButtons: function (caseMode) {
      var list = (caseMode === 'upper') ? labels.GREEK_UPPER_LIST : labels.GREEK_LOWER_LIST;
      var btns = [];
      for (var i = 0; i < list.length; i++) {
        var ch = list[i];
        btns.push('<button type="button" class="greek-char-btn" data-char="' + ch + '" title="Insert ' + ch + '">' + ch + '</button>');
      }
      return btns.join('');
    },

    renderSingleObject: function (obj) {
      var geom = obj._geom;
      var typeTitle = obj.type.charAt(0).toUpperCase() + obj.type.slice(1);
      if (obj.type === 'line') typeTitle = obj.extent.charAt(0).toUpperCase() + obj.extent.slice(1);

      var html = [];
      html.push('<div class="prop-header">');
      html.push('  <div class="prop-title"><span class="type-badge">' + typeTitle + '</span> ' + (obj.label.text || obj.id) + '</div>');
      html.push('  <button class="btn-ghost btn-delete-obj" title="Delete object">🗑</button>');
      html.push('</div>');

      // Label section
      var isUpper = this.greekPickerCase === 'upper';
      html.push('<div class="prop-section">');
      html.push('  <div class="section-label">LABEL</div>');
      html.push('  <div class="label-input-row">');
      html.push('    <input type="text" class="input-text prop-label-input" value="' + (obj.label.text || '') + '" placeholder="e.g. A_1, α"/>');
      html.push('    <button type="button" class="btn-secondary btn-greek-picker' + (this.greekPickerOpen ? ' active' : '') + '" title="Toggle Greek letters panel">αβγ</button>');
      html.push('  </div>');
      html.push('  <div class="greek-picker-subpanel" style="display:' + (this.greekPickerOpen ? 'block' : 'none') + ';">');
      html.push('    <div class="greek-case-tabs">');
      html.push('      <button type="button" class="greek-case-btn' + (!isUpper ? ' active' : '') + '" data-case="lower">Lowercase (αβγ)</button>');
      html.push('      <button type="button" class="greek-case-btn' + (isUpper ? ' active' : '') + '" data-case="upper">Uppercase (ΑΒΓ)</button>');
      html.push('    </div>');
      html.push('    <div class="greek-letters-grid">');
      html.push('      ' + this.renderGreekGridButtons(this.greekPickerCase));
      html.push('    </div>');
      html.push('  </div>');
      html.push('  <div class="label-error-msg" style="display:none; color:var(--danger); font-size:11px; margin-top:2px;"></div>');
      html.push('</div>');

      // Geometry & Dimensions
      html.push('<div class="prop-section">');
      html.push('  <div class="section-label">GEOMETRY</div>');
      html.push('  <div class="geom-grid">');

      if (obj.type === 'point' && geom) {
        var isFree = obj.def && obj.def.kind === 'free';
        var refX = measure.worldToRefUnits(geom.x, graph.objectsById);
        var refY = measure.worldToRefUnits(geom.y, graph.objectsById);
        html.push('    <div class="grid-row"><span>X:</span><strong>' + (refX !== null ? measure.formatDistance(refX) : geom.x.toFixed(2)) + '</strong></div>');
        html.push('    <div class="grid-row"><span>Y:</span><strong>' + (refY !== null ? measure.formatDistance(refY) : geom.y.toFixed(2)) + '</strong></div>');
        html.push('    <div class="grid-row"><span>Status:</span><span>' + (isFree ? 'Free (draggable)' : 'Constrained') + '</span></div>');
      } else if (obj.type === 'line' && geom) {
        var fP = (obj.def && obj.def.firstP) || (obj.def && obj.def.p);
        var fQ = (obj.def && obj.def.firstQ) || (obj.def && obj.def.q);
        if (obj.def && obj.def.kind === 'twoPoints') {
          if (!obj.def.firstP) obj.def.firstP = fP;
          if (!obj.def.firstQ) obj.def.firstQ = fQ;
        }
        var pA = fP ? graph.get(fP) : null;
        var pB = fQ ? graph.get(fQ) : null;
        var nameA = (pA && pA.label && pA.label.text) ? pA.label.text : (pA ? pA.id.toUpperCase() : 'P1');
        var nameB = (pB && pB.label && pB.label.text) ? pB.label.text : (pB ? pB.id.toUpperCase() : 'P2');

        var isRayB = (obj.extent === 'ray' && (!obj.def || (obj.def.kind === 'twoPoints' ? obj.def.p === fQ : !!obj.def.reverse)));

        if (obj.extent === 'segment') {
          var wLen = (geom.P0 && geom.P1) ? vec.dist(geom.P0, geom.P1) : 0;
          var rLen = measure.worldToRefUnits(wLen, graph.objectsById);
          html.push('    <div class="grid-row"><span>Length:</span><strong>' + measure.formatDistance(rLen) + '</strong></div>');
          if (measure.hasReference()) {
            html.push('    <div class="grid-row"><span>World len:</span><span>' + wLen.toFixed(2) + '</span></div>');
          }
          if (geom.P0 && geom.P1) {
            var mid = vec.midpoint(geom.P0, geom.P1);
            html.push('    <div class="grid-row"><span>Endpoints:</span><span>(' + geom.P0.x.toFixed(2) + ', ' + geom.P0.y.toFixed(2) + ') – (' + geom.P1.x.toFixed(2) + ', ' + geom.P1.y.toFixed(2) + ')</span></div>');
            html.push('    <div class="grid-row"><span>Midpoint:</span><span>(' + mid.x.toFixed(2) + ', ' + mid.y.toFixed(2) + ')</span></div>');
          }
        } else if (obj.extent === 'ray') {
          var curOriginName = isRayB ? nameB : nameA;
          var curTargetName = isRayB ? nameA : nameB;
          if (geom.P0) {
            html.push('    <div class="grid-row"><span>Origin:</span><strong>' + curOriginName + ' (' + geom.P0.x.toFixed(2) + ', ' + geom.P0.y.toFixed(2) + ')</strong></div>');
          }
          if (geom.d) {
            var angleDegR = Math.atan2(geom.d.y, geom.d.x) * 180 / Math.PI;
            if (angleDegR < 0) angleDegR += 360;
            html.push('    <div class="grid-row"><span>Direction:</span><span>towards ' + curTargetName + ' (' + angleDegR.toFixed(1) + '°)</span></div>');
          }
        } else { // line
          if (geom.n) {
            html.push('    <div class="grid-row"><span>Normal eq:</span><span>' + geom.n.x.toFixed(2) + 'x + ' + geom.n.y.toFixed(2) + 'y = ' + geom.c.toFixed(2) + '</span></div>');
          }
          if (geom.d) {
            var angleDegL = Math.atan2(geom.d.y, geom.d.x) * 180 / Math.PI;
            if (angleDegL < 0) angleDegL += 360;
            html.push('    <div class="grid-row"><span>Slope angle:</span><span>' + angleDegL.toFixed(1) + '°</span></div>');
          }
        }
      } else if (obj.type === 'circle' && geom) {
        var rRef = measure.worldToRefUnits(geom.r, graph.objectsById);
        html.push('    <div class="grid-row"><span>Radius:</span><strong>' + measure.formatDistance(rRef) + '</strong></div>');
        html.push('    <div class="grid-row"><span>Diameter:</span><strong>' + measure.formatDistance(rRef ? rRef * 2 : null) + '</strong></div>');
        html.push('    <div class="grid-row"><span>Area:</span><strong>' + measure.formatArea(rRef ? Math.PI * rRef * rRef : null) + '</strong></div>');
      } else if (obj.type === 'polygon' && geom) {
        html.push('    <div class="grid-row"><span>Width a:</span><strong>' + measure.formatDistance(geom.a) + '</strong></div>');
        html.push('    <div class="grid-row"><span>Height b:</span><strong>' + measure.formatDistance(geom.b) + '</strong></div>');
        html.push('    <div class="grid-row"><span>Area:</span><strong>' + measure.formatArea(geom.area) + '</strong></div>');
        html.push('    <div class="grid-row"><span>Perimeter:</span><strong>' + measure.formatDistance(geom.perimeter) + '</strong></div>');
      } else if (obj.type === 'angle' && geom) {
        var deg = (geom.sweep * 180) / Math.PI;
        html.push('    <div class="grid-row"><span>Angle (°):</span><strong>' + deg.toFixed(2) + '°</strong></div>');
        html.push('    <div class="grid-row"><span>Angle (rad):</span><strong>' + geom.sweep.toFixed(3) + ' rad</strong></div>');
      }

      html.push('  </div>');
      html.push('</div>');

      // Style section
      html.push('<div class="prop-section">');
      html.push('  <div class="section-label">STYLE</div>');
      html.push('  <div class="swatches-row">');
      for (var s = 0; s < PALETTE.length; s++) {
        var cKey = PALETTE[s];
        var isSel = obj.style.color === cKey;
        html.push('    <div class="color-swatch ' + cKey + (isSel ? ' active' : '') + '" data-color="' + cKey + '"></div>');
      }
      html.push('  </div>');

      if (obj.type === 'polygon') {
        html.push('  <div class="fill-slider-row" style="margin-top:10px;">');
        html.push('    <label><input type="checkbox" class="check-fill" ' + (obj.style.fillEnabled !== false ? 'checked' : '') + '/> Fill interior</label>');
        html.push('  </div>');
      }
      html.push('</div>');

      // Quick actions
      if (obj.type === 'line' || obj.type === 'circle') {
        html.push('<div class="prop-section">');
        html.push('  <div class="section-label">QUICK ACTIONS</div>');
        html.push('  <div class="quick-actions-row">');
        if (obj.type === 'line') {
          var fP = (obj.def && obj.def.firstP) || (obj.def && obj.def.p);
          var fQ = (obj.def && obj.def.firstQ) || (obj.def && obj.def.q);
          var pA = fP ? graph.get(fP) : null;
          var pB = fQ ? graph.get(fQ) : null;
          var lblA = (pA && pA.label && pA.label.text) ? pA.label.text : (pA ? pA.id.toUpperCase() : 'P1');
          var lblB = (pB && pB.label && pB.label.text) ? pB.label.text : (pB ? pB.id.toUpperCase() : 'P2');

          if (obj.extent === 'segment') {
            html.push('    <button class="btn-secondary btn-action-ref">Set Reference</button>');
            html.push('    <button class="btn-secondary btn-action-mid">Find Midpoint</button>');
            html.push('    <button class="btn-secondary btn-qa-ray-a" title="Convert to ray starting at ' + lblA + '">➔ Ray (' + lblA + ' → ' + lblB + ')</button>');
            html.push('    <button class="btn-secondary btn-qa-ray-b" title="Convert to ray starting at ' + lblB + '">➔ Ray (' + lblB + ' → ' + lblA + ')</button>');
            html.push('    <button class="btn-secondary btn-qa-line" title="Convert to infinite line">↔ Full Line</button>');
          } else if (obj.extent === 'ray') {
            html.push('    <button class="btn-secondary btn-reverse-ray" title="Reverse ray direction">⇄ Reverse Ray</button>');
            html.push('    <button class="btn-secondary btn-qa-seg" title="Convert to segment">⎺ Segment</button>');
            html.push('    <button class="btn-secondary btn-qa-line" title="Convert to infinite line">↔ Full Line</button>');
          } else { // line
            html.push('    <button class="btn-secondary btn-qa-seg" title="Convert to segment">⎺ Segment</button>');
            html.push('    <button class="btn-secondary btn-qa-ray-a" title="Convert to ray starting at ' + lblA + '">➔ Ray (' + lblA + ' → ' + lblB + ')</button>');
            html.push('    <button class="btn-secondary btn-qa-ray-b" title="Convert to ray starting at ' + lblB + '">➔ Ray (' + lblB + ' → ' + lblA + ')</button>');
          }
        } else if (obj.type === 'circle') {
          html.push('    <button class="btn-secondary btn-action-center">Create Center</button>');
        }
        html.push('  </div>');
        html.push('</div>');
      }

      return html.join('\n');
    },

    bindSingleObjectEvents: function (obj, container) {
      if (!container || !container.querySelector) return;
      var self = this;
      var labelInput = container.querySelector('.prop-label-input');
      var errorMsg = container.querySelector('.label-error-msg');
      var greekBtn = container.querySelector('.btn-greek-picker');
      var greekSubpanel = container.querySelector('.greek-picker-subpanel');
      var greekGrid = container.querySelector('.greek-letters-grid');
      var deleteBtn = container.querySelector('.btn-delete-obj');
      var titleEl = container.querySelector('.prop-title');

      function applyLabelValue(rawVal, commitSnapshot) {
        var norm = labels.normalizeInput(obj.type, rawVal);
        if (labels.isValid(obj.type, norm)) {
          if (errorMsg) errorMsg.style.display = 'none';
          obj.label.text = norm;
          if (norm && obj.label) {
            obj.label.visible = true;
          }
          if (titleEl) {
            var typeTitle = obj.type.charAt(0).toUpperCase() + obj.type.slice(1);
            if (obj.type === 'line') typeTitle = obj.extent.charAt(0).toUpperCase() + obj.extent.slice(1);
            titleEl.innerHTML = '<span class="type-badge">' + typeTitle + '</span> ' + (obj.label.text || obj.id);
          }
          Geo.events.emit('canvas:requestRender');
          if (commitSnapshot) {
            Geo.events.emit('history:snapshot');
          }
        } else if (errorMsg) {
          errorMsg.textContent = 'Invalid label for ' + obj.type;
          errorMsg.style.display = 'block';
        }
      }

      if (labelInput) {
        labelInput.oninput = function () {
          applyLabelValue(labelInput.value, false);
        };
        labelInput.onchange = function () {
          Geo.events.emit('history:snapshot');
        };
      }

      function bindGreekCharButtons() {
        if (!greekGrid || !greekGrid.querySelectorAll) return;
        var charBtns = greekGrid.querySelectorAll('.greek-char-btn');
        charBtns.forEach(function (btn) {
          btn.onclick = function () {
            var ch = btn.getAttribute('data-char');
            if (!labelInput || !ch) return;
            var cur = labelInput.value || '';
            var isSegmentExpr = (obj.type === 'line' && obj.extent === 'segment');
            var nextVal;

            if (isSegmentExpr) {
              // Segments allow algebraic expressions; replace if single default char, otherwise append
              nextVal = (cur.length <= 1) ? ch : (cur + ch);
            } else {
              // For points, lines, rays, circles, angles: if ending with '_', append to subscript; otherwise replace base letter preserving primes/subscript
              if (cur.indexOf('_') !== -1 && cur.slice(cur.indexOf('_')) === '_') {
                nextVal = cur + ch;
              } else {
                var suffixMatch = cur.match(/('{0,3}(?:_.*)?)$/);
                var suffix = (suffixMatch && cur.length > 0) ? suffixMatch[1] : '';
                nextVal = ch + suffix;
              }
            }

            labelInput.value = nextVal;
            applyLabelValue(nextVal, true);
            if (labelInput.focus) labelInput.focus();
          };
        });
      }

      if (greekBtn && greekSubpanel) {
        greekBtn.onclick = function () {
          self.greekPickerOpen = !self.greekPickerOpen;
          greekSubpanel.style.display = self.greekPickerOpen ? 'block' : 'none';
          if (greekBtn.classList) {
            if (self.greekPickerOpen) greekBtn.classList.add('active');
            else greekBtn.classList.remove('active');
          }
        };

        var caseBtns = greekSubpanel.querySelectorAll ? greekSubpanel.querySelectorAll('.greek-case-btn') : [];
        caseBtns.forEach(function (cBtn) {
          cBtn.onclick = function () {
            var targetCase = cBtn.getAttribute('data-case') || 'lower';
            self.greekPickerCase = targetCase;
            caseBtns.forEach(function (b) {
              if (b.classList) {
                if (b.getAttribute('data-case') === targetCase) b.classList.add('active');
                else b.classList.remove('active');
              }
            });
            if (greekGrid) {
              greekGrid.innerHTML = self.renderGreekGridButtons(targetCase);
              bindGreekCharButtons();
            }
          };
        });

        bindGreekCharButtons();
      }

      if (deleteBtn) {
        deleteBtn.onclick = function () {
          graph.remove(obj.id);
          Geo.tools.selection.clear();
          Geo.events.emit('history:snapshot');
          Geo.events.emit('canvas:requestRender');
        };
      }

      var swatches = container.querySelectorAll('.color-swatch');
      swatches.forEach(function (sw) {
        sw.onclick = function () {
          var col = sw.getAttribute('data-color');
          obj.style.color = col;
          self.update([obj]);
          Geo.events.emit('history:snapshot');
          Geo.events.emit('canvas:requestRender');
        };
      });

      function setLineExtent(ext, isReverse) {
        obj.extent = ext;
        if (ext === 'ray') {
          if (obj.def && obj.def.kind === 'twoPoints') {
            var fP = obj.def.firstP || obj.def.p;
            var fQ = obj.def.firstQ || obj.def.q;
            obj.def.firstP = fP;
            obj.def.firstQ = fQ;
            obj.def.p = isReverse ? fQ : fP;
            obj.def.q = isReverse ? fP : fQ;
          } else if (obj.def) {
            obj.def.reverse = !!isReverse;
          }
        }
        graph.recomputeAll();
        self.update([obj]);
        Geo.events.emit('history:snapshot');
        Geo.events.emit('canvas:requestRender');
      }

      function flipRay() {
        if (obj.def && obj.def.kind === 'twoPoints') {
          var fP = obj.def.firstP || obj.def.p;
          var fQ = obj.def.firstQ || obj.def.q;
          obj.def.firstP = fP;
          obj.def.firstQ = fQ;
          if (obj.def.p === fP) {
            obj.def.p = fQ;
            obj.def.q = fP;
          } else {
            obj.def.p = fP;
            obj.def.q = fQ;
          }
        } else if (obj.def) {
          obj.def.reverse = !obj.def.reverse;
        }
        graph.recomputeAll();
        self.update([obj]);
        Geo.events.emit('history:snapshot');
        Geo.events.emit('canvas:requestRender');
      }

      var btnReverseRays = container.querySelectorAll('.btn-reverse-ray');
      btnReverseRays.forEach(function (btn) {
        btn.onclick = flipRay;
      });

      var qaRayA = container.querySelector('.btn-qa-ray-a');
      if (qaRayA) qaRayA.onclick = function () { setLineExtent('ray', false); };
      var qaRayB = container.querySelector('.btn-qa-ray-b');
      if (qaRayB) qaRayB.onclick = function () { setLineExtent('ray', true); };
      var qaLine = container.querySelector('.btn-qa-line');
      if (qaLine) qaLine.onclick = function () { setLineExtent('line', false); };
      var qaSeg = container.querySelector('.btn-qa-seg');
      if (qaSeg) qaSeg.onclick = function () { setLineExtent('segment', false); };

      var checkFill = container.querySelector('.check-fill');
      if (checkFill) {
        checkFill.onchange = function () {
          obj.style.fillEnabled = checkFill.checked;
          Geo.events.emit('history:snapshot');
          Geo.events.emit('canvas:requestRender');
        };
      }

      var btnRef = container.querySelector('.btn-action-ref');
      if (btnRef) {
        btnRef.onclick = function () {
          Geo.tools.controller.activate('set_reference', [obj]);
        };
      }

      var btnMid = container.querySelector('.btn-action-mid');
      if (btnMid) {
        btnMid.onclick = function () {
          Geo.tools.controller.activate('midpoint', [obj]);
        };
      }

      var btnCenter = container.querySelector('.btn-action-center');
      if (btnCenter) {
        btnCenter.onclick = function () {
          Geo.tools.controller.activate('circle_center', [obj]);
        };
      }
    },

    renderMultiSelection: function (selected) {
      return [
        '<div class="prop-header">',
        '  <div class="prop-title">' + selected.length + ' objects selected</div>',
        '  <button class="btn-ghost btn-delete-all">🗑</button>',
        '</div>',
        '<div class="prop-section">',
        '  <div class="section-label">STYLE</div>',
        '  <div class="swatches-row">',
        PALETTE.map(function (c) {
          return '    <div class="color-swatch ' + c + '" data-color="' + c + '"></div>';
        }).join('\n'),
        '  </div>',
        '</div>'
      ].join('\n');
    },

    bindMultiSelectionEvents: function (selected, container) {
      if (!container || !container.querySelector) return;
      var self = this;
      var delBtn = container.querySelector('.btn-delete-all');
      if (delBtn) {
        delBtn.onclick = function () {
          for (var i = 0; i < selected.length; i++) {
            graph.remove(selected[i].id);
          }
          Geo.tools.selection.clear();
          Geo.events.emit('history:snapshot');
          Geo.events.emit('canvas:requestRender');
        };
      }

      var swatches = container.querySelectorAll('.color-swatch');
      swatches.forEach(function (sw) {
        sw.onclick = function () {
          var col = sw.getAttribute('data-color');
          for (var i = 0; i < selected.length; i++) {
            selected[i].style.color = col;
          }
          Geo.events.emit('history:snapshot');
          Geo.events.emit('canvas:requestRender');
        };
      });
    },

    renderObjectsList: function () {
      var container = document.getElementById('pane-objects');
      if (!container) return;

      var html = ['<div class="objects-list">'];
      for (var i = 0; i < graph.objects.length; i++) {
        var obj = graph.objects[i];
        var isSel = Geo.tools.selection.selectedIds[obj.id];
        var label = obj.label && obj.label.text ? obj.label.text : obj.id;
        html.push('  <div class="obj-list-row' + (isSel ? ' selected' : '') + '" data-id="' + obj.id + '">');
        html.push('    <span class="obj-type-icon">' + obj.type.charAt(0).toUpperCase() + '</span>');
        html.push('    <span class="obj-label-name">' + label + '</span>');
        html.push('    <span class="obj-def-kind">' + (obj.def ? obj.def.kind : '') + '</span>');
        html.push('    <button class="btn-ghost btn-toggle-vis" title="Toggle visibility">' + (obj.visible ? '👁' : '🚫') + '</button>');
        html.push('  </div>');
      }
      html.push('</div>');
      container.innerHTML = html.join('\n');

      // Bind row clicks
      var rows = container.querySelectorAll('.obj-list-row');
      rows.forEach(function (row) {
        var id = row.getAttribute('data-id');
        var obj = graph.get(id);
        row.onclick = function (e) {
          if (e.target.classList.contains('btn-toggle-vis')) {
            obj.visible = !obj.visible;
            Geo.events.emit('canvas:requestRender');
            infopanel.renderObjectsList();
            return;
          }
          Geo.tools.selection.selectOnly(obj);
          Geo.events.emit('canvas:requestRender');
        };
      });
    }
  };

  Geo.ui.infopanel = infopanel;
})(window.Geo);
