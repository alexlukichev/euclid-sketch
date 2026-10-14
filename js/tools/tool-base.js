/**
 * Euclid Sketch — Tool Framework & Step Machine Controller
 */
(function (Geo) {
  'use strict';

  var graph = Geo.model.graph;
  var snap = Geo.view.snap;
  var hittest = Geo.view.hittest;
  var camera = Geo.view.camera;
  var measure = Geo.model.measure;
  var vec = Geo.kernel.vec;

  var toolsRegistry = {};

  var controller = {
    activeTool: null,
    stepIndex: 0,
    picks: [],
    candidateSolutions: null,
    selectedBranch: 0,
    snapTarget: null,
    hoverObject: null,
    previewGeom: null,
    snappingEnabled: true,

    register: function (spec) {
      if (!spec || !spec.id) return;
      toolsRegistry[spec.id] = spec;
    },

    get: function (id) {
      return toolsRegistry[id] || null;
    },

    getAll: function () {
      return toolsRegistry;
    },

    activate: function (toolId, initialPicks) {
      var spec = toolsRegistry[toolId];
      if (!spec) return;

      if (this.activeTool && this.activeTool.onDeactivate) {
        this.activeTool.onDeactivate();
      }

      this.activeTool = spec;
      this.stepIndex = 0;
      this.picks = initialPicks ? initialPicks.slice() : [];
      this.candidateSolutions = null;
      this.selectedBranch = 0;
      this.previewGeom = null;

      if (this.activeTool.onActivate) {
        this.activeTool.onActivate();
      }

      this._updatePrompt();
      Geo.events.emit('tool:activated', { id: toolId, spec: spec });
    },

    setSnappingEnabled: function (val) {
      this.snappingEnabled = !!val;
      Geo.events.emit('snap:toggled', this.snappingEnabled);
    },

    resetToSelect: function () {
      this.activate('peek');
    },

    // Step back or cancel
    stepBack: function () {
      if (this.candidateSolutions) {
        this.candidateSolutions = null;
        this.previewGeom = null;
        this._updatePrompt();
        Geo.events.emit('canvas:requestRender');
        return;
      }

      if (this.picks.length > 0) {
        this.picks.pop();
        this.stepIndex = Math.max(0, this.stepIndex - 1);
        this._updatePrompt();
        Geo.events.emit('canvas:requestRender');
      } else {
        this.resetToSelect();
      }
    },

    _updatePrompt: function () {
      if (!this.activeTool) return;
      var promptText = '';
      var totalSteps = (this.activeTool.steps && this.activeTool.steps.length) || 0;

      if (this.candidateSolutions) {
        if (this.candidateSolutions[0] && this.candidateSolutions[0].type === 'ray') {
          promptText = 'Click to choose bisector ray direction (or press 1/2, Tab, Enter)';
        } else {
          promptText = 'Click the area of the plane for the desired circle (or press 1-' + this.candidateSolutions.length + ', Enter)';
        }
      } else if (this.activeTool.steps && this.stepIndex < totalSteps) {
        var st = this.activeTool.steps[this.stepIndex];
        promptText = st.prompt || '';
      } else if (this.activeTool.defaultPrompt) {
        promptText = this.activeTool.defaultPrompt;
      }

      Geo.events.emit('tool:prompt', {
        toolName: this.activeTool.name || '',
        step: this.stepIndex + 1,
        totalSteps: totalSteps,
        prompt: promptText
      });
    },

    _findCandidateBranchAtPoint: function (worldPt) {
      if (!this.candidateSolutions || this.candidateSolutions.length === 0) return 0;
      var bestBranch = this.candidateSolutions[0].branch;
      var bestDist = Infinity;
      for (var c = 0; c < this.candidateSolutions.length; c++) {
        var sol = this.candidateSolutions[c];
        if (sol.circle) {
          var solCirc = sol.circle;
          var dToCenter = vec.dist(worldPt, solCirc.O);
          var dToPerimeter = Math.abs(dToCenter - solCirc.r);
          var discDist = Math.max(0, dToCenter - solCirc.r);
          var score = Math.min(dToCenter, discDist * 1.5, dToPerimeter);
          if (score < bestDist) {
            bestDist = score;
            bestBranch = sol.branch;
          }
        } else if (sol.dir && sol.origin) {
          var v = vec.sub(worldPt, sol.origin);
          var dot = vec.dot(v, sol.dir);
          var dist;
          if (dot >= 0) {
            var proj = vec.add(sol.origin, vec.scale(sol.dir, dot));
            dist = vec.dist(worldPt, proj);
          } else {
            dist = vec.dist(worldPt, sol.origin) + Math.abs(dot) * 2;
          }
          if (dist < bestDist) {
            bestDist = dist;
            bestBranch = sol.branch;
          }
        }
      }
      return bestBranch;
    },

    // Pointer events called from main canvas event listeners
    onPointerMove: function (screenPt, evt) {
      if (this.activeTool && this.activeTool.id === 'pan') {
        this.snapTarget = null;
        this.hoverObject = null;
        if (this.activeTool.onPointerMove) {
          this.activeTool.onPointerMove(screenPt, null, evt);
        }
        Geo.events.emit('canvas:requestRender');
        return;
      }

      var isAltDown = evt ? evt.altKey : false;
      var snapOn = this.snappingEnabled && !isAltDown;

      // Update snap target
      this.snapTarget = snap.findSnap(screenPt, graph.objects, snapOn);

      // Hit-test hover object for selection tool or specific picks
      var hitList = hittest.hitTest(screenPt, graph.objects, 8);
      if (this.activeTool && this.activeTool.id === 'select') {
        this.hoverObject = null;
        for (var h = 0; h < hitList.length; h++) {
          if (hitList[h].object && hitList[h].object.type === 'point') {
            this.hoverObject = hitList[h].object;
            break;
          }
        }
      } else {
        this.hoverObject = (hitList.length > 0) ? hitList[0].object : null;
      }

      if (this.candidateSolutions) {
        var worldPt = camera.screenToWorld(screenPt);
        this.selectedBranch = this._findCandidateBranchAtPoint(worldPt);
        var solType = (this.candidateSolutions[0] && this.candidateSolutions[0].type === 'ray') ? 'multi_ray' : 'multi_circle';
        this.previewGeom = {
          type: solType,
          candidates: this.candidateSolutions,
          selectedBranch: this.selectedBranch
        };
        Geo.events.emit('canvas:requestRender');
        return;
      }

      if (this.activeTool && this.activeTool.onPointerMove) {
        this.activeTool.onPointerMove(screenPt, this.snapTarget, evt);
      }

      // If active tool has preview function
      if (this.activeTool && this.activeTool.preview && !this.candidateSolutions) {
        this.previewGeom = this.activeTool.preview(this.picks, this.snapTarget);
      }

      Geo.events.emit('canvas:requestRender');
    },

    onPointerDown: function (screenPt, evt) {
      if (evt && evt.button !== undefined && evt.button !== 0) return; // Left click only

      if (this.candidateSolutions) {
        // User clicked on an area of the plane: select closest candidate circle and commit
        var worldPt = camera.screenToWorld(screenPt);
        this.selectedBranch = this._findCandidateBranchAtPoint(worldPt);
        this._commitSolution();
        return;
      }

      if (this.activeTool && this.activeTool.onPointerDown) {
        var handled = this.activeTool.onPointerDown(screenPt, this.snapTarget, evt);
        if (handled) {
          Geo.events.emit('canvas:requestRender');
          return;
        }
      }

      // Standard step-based tool pick resolution
      if (this.activeTool && this.activeTool.steps && this.stepIndex < this.activeTool.steps.length) {
        this._handleStepPick(this.snapTarget, evt);
      }
    },

    onPointerUp: function (evt) {
      if (this.activeTool && this.activeTool.onPointerUp) {
        this.activeTool.onPointerUp(evt);
      }
    },

    _handleStepPick: function (snapTarget, evt) {
      var step = this.activeTool.steps[this.stepIndex];
      var accept = step.accept;
      var pickObj = null;

      if (accept === 'point') {
        if (snapTarget.kind === 'point') {
          pickObj = snapTarget.object;
        } else if (snapTarget.kind === 'intersection') {
          // Check if intersection point already exists
          var existing = graph.findExistingPoint(snapTarget.point);
          if (existing) {
            pickObj = existing;
          } else {
            // Create intersection point
            var ptInter = Geo.model.objects.createPoint({
              kind: 'intersection',
              a: snapTarget.parentA.id,
              b: snapTarget.parentB.id,
              branch: snapTarget.branch
            }, Geo.model.labels.nextAvailableLabel('point', graph.objects));
            graph.add(ptInter);
            pickObj = ptInter;
          }
        } else if (snapTarget.kind === 'onObject') {
          var ptOn = Geo.model.objects.createPoint({
            kind: 'onObject',
            obj: snapTarget.targetObj.id,
            t: snapTarget.t
          }, Geo.model.labels.nextAvailableLabel('point', graph.objects));
          graph.add(ptOn);
          pickObj = ptOn;
        } else { // Free point
          var ptFree = Geo.model.objects.createPoint({
            kind: 'free',
            x: snapTarget.point.x,
            y: snapTarget.point.y
          }, Geo.model.labels.nextAvailableLabel('point', graph.objects));
          graph.add(ptFree);
          pickObj = ptFree;
        }
      } else if (accept === 'linear' || accept === 'line' || accept === 'segment') {
        if (this.hoverObject && this.hoverObject.type === 'line') {
          if (accept === 'segment' && this.hoverObject.extent !== 'segment') return;
          pickObj = this.hoverObject;
        }
      } else if (accept === 'circle') {
        if (this.hoverObject && this.hoverObject.type === 'circle') {
          pickObj = this.hoverObject;
        }
      } else if (accept === 'curve') {
        if (this.hoverObject && (this.hoverObject.type === 'line' || this.hoverObject.type === 'circle')) {
          pickObj = this.hoverObject;
        }
      } else if (accept === 'any') {
        if (this.hoverObject) pickObj = this.hoverObject;
      }

      if (!pickObj) return;

      this.picks.push(pickObj);
      this.stepIndex++;

      // Check if candidate solutions exist (e.g. Apollonius tangent circles)
      if (this.activeTool.solutions) {
        var sols = this.activeTool.solutions(this.picks);
        if (sols && sols.length > 0) {
          if (sols.length === 1) {
            this.selectedBranch = sols[0].branch;
            this._commitTool();
            return;
          } else {
            this.candidateSolutions = sols;
            this.selectedBranch = sols[0].branch;
            var initSolType = (sols[0] && sols[0].type === 'ray') ? 'multi_ray' : 'multi_circle';
            this.previewGeom = {
              type: initSolType,
              candidates: this.candidateSolutions,
              selectedBranch: this.selectedBranch
            };
            this._updatePrompt();
            Geo.events.emit('canvas:requestRender');
            return;
          }
        }
      }

      // If all steps complete, commit
      if (this.stepIndex >= this.activeTool.steps.length) {
        this._commitTool();
      } else {
        this._updatePrompt();
        Geo.events.emit('canvas:requestRender');
      }
    },

    _commitSolution: function () {
      if (!this.candidateSolutions) return;
      var chosenBranch = this.selectedBranch;
      this.candidateSolutions = null;
      if (this.activeTool && this.activeTool.commit) {
        this.activeTool.commit(this.picks, chosenBranch);
      }
      this.picks = [];
      this.stepIndex = 0;
      this.previewGeom = null;
      this._updatePrompt();
      Geo.events.emit('history:snapshot');
      Geo.events.emit('canvas:requestRender');
    },

    _commitTool: function () {
      if (this.activeTool && this.activeTool.commit) {
        this.activeTool.commit(this.picks, this.selectedBranch);
      }
      this.picks = [];
      this.stepIndex = 0;
      this.previewGeom = null;
      this.candidateSolutions = null;
      this._updatePrompt();
      Geo.events.emit('history:snapshot');
      Geo.events.emit('canvas:requestRender');
    },

    onKeyDown: function (evt) {
      if (evt.key === 'Escape') {
        this.stepBack();
        return true;
      }

      if (this.candidateSolutions) {
        if (evt.key >= '1' && evt.key <= '4') {
          var idx = parseInt(evt.key, 10) - 1;
          if (idx < this.candidateSolutions.length) {
            this.selectedBranch = this.candidateSolutions[idx].branch;
            this._commitSolution();
            return true;
          }
        }
        if (evt.key === 'Tab') {
          evt.preventDefault();
          var curIdx = 0;
          for (var i = 0; i < this.candidateSolutions.length; i++) {
            if (this.candidateSolutions[i].branch === this.selectedBranch) {
              curIdx = i; break;
            }
          }
          var nextIdx = (curIdx + 1) % this.candidateSolutions.length;
          this.selectedBranch = this.candidateSolutions[nextIdx].branch;
          var tabSolType = (this.candidateSolutions[0] && this.candidateSolutions[0].type === 'ray') ? 'multi_ray' : 'multi_circle';
          this.previewGeom = {
            type: tabSolType,
            candidates: this.candidateSolutions,
            selectedBranch: this.selectedBranch
          };
          Geo.events.emit('canvas:requestRender');
          return true;
        }
        if (evt.key === 'Enter') {
          this._commitSolution();
          return true;
        }
      }

      if (this.activeTool && this.activeTool.onKeyDown) {
        return this.activeTool.onKeyDown(evt);
      }
      return false;
    }
  };

  Geo.tools.controller = controller;
  Geo.tools.register = controller.register.bind(controller);
})(window.Geo);
