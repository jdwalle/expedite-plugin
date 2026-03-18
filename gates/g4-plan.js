#!/usr/bin/env node
'use strict';

var path = require('path');
var utils = require('./lib/gate-utils');

var GATE_ID = 'G4';
var EVALUATOR = 'g4-plan-script';
var HOLD_OUTCOME = 'recycle';

/**
 * G4 Plan Completeness Gate
 *
 * Usage: node gates/g4-plan.js <project-dir>
 *
 * Reads:
 *   <project-dir>/.expedite/plan/PLAN.md
 *   <project-dir>/.expedite/scope/SCOPE.md
 *   <project-dir>/.expedite/design/override-context.md (if exists)
 *   <project-dir>/.expedite/tasks.yml (if exists)
 *
 * Writes:
 *   <project-dir>/.expedite/gates.yml (append)
 *
 * Exits 0 on go/go_advisory, 1 on recycle.
 */

function main() {
  var projectDir = process.argv[2];
  if (!projectDir) {
    console.error('Usage: node gates/g4-plan.js <project-dir>');
    process.exit(2);
  }

  projectDir = path.resolve(projectDir);

  var planPath = path.join(projectDir, '.expedite', 'plan', 'PLAN.md');
  var scopePath = path.join(projectDir, '.expedite', 'scope', 'SCOPE.md');
  var overridePath = path.join(projectDir, '.expedite', 'design', 'override-context.md');
  var tasksPath = path.join(projectDir, '.expedite', 'tasks.yml');
  var gatesPath = path.join(projectDir, '.expedite', 'gates.yml');

  var planContent = utils.readFile(planPath);
  var scopeContent = utils.readFile(scopePath);
  var overrideContent = utils.readFile(overridePath);
  var tasksData = utils.readYaml(tasksPath);

  // --- Helper: extract phase sections from PLAN.md ---
  function extractPhases(content) {
    if (!content) return [];
    var phases = [];
    var lines = content.split('\n');
    var currentPhase = null;
    var currentContent = [];
    var currentTasks = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      // Match phase/wave/epic headings
      var phaseMatch = line.match(/^#{1,4}\s+(?:Phase|Wave|Epic)\s+(\d+)/i);
      if (phaseMatch) {
        if (currentPhase !== null) {
          phases.push({
            label: currentPhase,
            content: currentContent.join('\n'),
            tasks: currentTasks,
          });
        }
        currentPhase = 'Phase ' + phaseMatch[1];
        currentContent = [];
        currentTasks = [];
        continue;
      }

      if (currentPhase !== null) {
        currentContent.push(line);
        // Count task items (bullets or numbered items)
        if (/^\s*(?:[-*]|\d+[.)]\s)\s*\S/.test(line)) {
          currentTasks.push(line.trim());
        }
      }
    }
    // Push last phase
    if (currentPhase !== null) {
      phases.push({
        label: currentPhase,
        content: currentContent.join('\n'),
        tasks: currentTasks,
      });
    }

    return phases;
  }

  // --- Helper: count total tasks across all text (bullets + numbered items under phase headings) ---
  function countAllTasks(content) {
    if (!content) return 0;
    var count = 0;
    var lines = content.split('\n');
    var inPhase = false;
    for (var i = 0; i < lines.length; i++) {
      if (/^#{1,4}\s+(?:Phase|Wave|Epic)\s+\d+/i.test(lines[i])) {
        inPhase = true;
        continue;
      }
      if (inPhase && /^\s*(?:[-*]|\d+[.)]\s)\s*\S/.test(lines[i])) {
        count++;
      }
    }
    return count;
  }

  var das = utils.extractDAs(scopeContent);
  var phases = extractPhases(planContent);

  // --- MUST criteria ---

  var mustResults = [];

  // M1: PLAN.md exists and non-empty
  mustResults.push({
    criterion: 'M1',
    passed: planContent !== null && planContent.trim().length > 0,
    detail: planContent === null
      ? 'PLAN.md does not exist at ' + planPath
      : (planContent.trim().length === 0
        ? 'PLAN.md exists but is empty at ' + planPath
        : 'PLAN.md exists and has content (' + planContent.trim().length + ' chars)'),
  });

  // M2: Every DA from SCOPE.md is referenced in at least one phase
  var m2Passed = true;
  var m2Missing = [];
  if (das.length === 0 && scopeContent) {
    // No DAs found in SCOPE.md -- auto-pass with note
    m2Passed = true;
    mustResults.push({
      criterion: 'M2',
      passed: true,
      detail: 'No DA identifiers found in SCOPE.md (nothing to cross-reference)',
    });
  } else if (!scopeContent) {
    mustResults.push({
      criterion: 'M2',
      passed: false,
      detail: 'Cannot check DA coverage: SCOPE.md does not exist at ' + scopePath,
    });
    m2Passed = false;
  } else {
    for (var dIdx = 0; dIdx < das.length; dIdx++) {
      var da = das[dIdx];
      var found = planContent && planContent.toUpperCase().indexOf(da.id.toUpperCase()) !== -1;
      if (!found) {
        m2Missing.push(da.id);
        m2Passed = false;
      }
    }
    mustResults.push({
      criterion: 'M2',
      passed: m2Passed,
      detail: m2Passed
        ? 'All ' + das.length + ' DAs from SCOPE.md are referenced in PLAN.md'
        : 'DAs not referenced in any phase of PLAN.md: ' + m2Missing.join(', '),
    });
  }

  // M3: PLAN.md contains phase sections with tasks, phase count between 1 and 20
  var m3Passed = phases.length >= 1 && phases.length <= 20;
  mustResults.push({
    criterion: 'M3',
    passed: m3Passed,
    detail: m3Passed
      ? 'Found ' + phases.length + ' phase sections (within 1-20 range)'
      : (phases.length === 0
        ? 'No phase sections found in PLAN.md (expected headings like "Phase 1", "Wave 1", or "Epic 1")'
        : 'Phase count (' + phases.length + ') is outside valid range of 1-20'),
  });

  // M4: PLAN.md contains tactical decision references (TD- patterns)
  var m4Passed = false;
  var m4Detail = '';
  if (planContent) {
    var tdMatches = planContent.match(/TD-\d+/gi);
    if (tdMatches && tdMatches.length > 0) {
      // Check that at least some phases have TD references
      var phasesWithTD = 0;
      for (var p4 = 0; p4 < phases.length; p4++) {
        if (/TD-\d+/i.test(phases[p4].content)) {
          phasesWithTD++;
        }
      }
      m4Passed = phasesWithTD > 0;
      m4Detail = m4Passed
        ? 'Found ' + tdMatches.length + ' TD references across ' + phasesWithTD + ' phase(s)'
        : 'TD references exist in PLAN.md but not within any phase section';
    } else {
      // Also check for "tactical decision" text as alternative
      var hasTacticalText = /tactical\s+decision/i.test(planContent);
      m4Passed = hasTacticalText;
      m4Detail = m4Passed
        ? 'Found tactical decision text (no TD-N identifiers)'
        : 'No tactical decision references (TD-N or "tactical decision") found in PLAN.md';
    }
  } else {
    m4Detail = 'Cannot check tactical decisions: PLAN.md does not exist';
  }
  mustResults.push({
    criterion: 'M4',
    passed: m4Passed,
    detail: m4Detail,
  });

  // M5: PLAN.md contains acceptance criteria with DA references
  var m5Passed = false;
  var m5Detail = '';
  if (planContent) {
    // Look for acceptance/success criteria sections or "done when" patterns
    var acPattern = /(?:acceptance|success\s+criteria|done\s+when)/i;
    var hasAC = acPattern.test(planContent);

    if (hasAC) {
      // Check if any DA references appear near criteria
      var daRefPattern = /\(DA-\d+\)|DA-\d+/i;
      var hasDARefs = daRefPattern.test(planContent);
      m5Passed = hasDARefs;
      m5Detail = hasDARefs
        ? 'Acceptance criteria found with DA traceability references'
        : 'Acceptance criteria found but no DA references (e.g., "(DA-1)") for traceability';
    } else {
      m5Detail = 'No acceptance criteria sections found in PLAN.md (expected "acceptance", "success criteria", or "done when")';
    }
  } else {
    m5Detail = 'Cannot check acceptance criteria: PLAN.md does not exist';
  }
  mustResults.push({
    criterion: 'M5',
    passed: m5Passed,
    detail: m5Detail,
  });

  // M6: If tasks.yml exists, every task has assigned_agent. Auto-PASS if no tasks.yml.
  var m6Passed = true;
  var m6Detail = '';
  if (tasksData === null) {
    m6Detail = 'tasks.yml not yet created (populated by execute skill) -- auto-PASS';
  } else if (tasksData && Array.isArray(tasksData.tasks)) {
    var tasksWithoutAgent = [];
    for (var t = 0; t < tasksData.tasks.length; t++) {
      var task = tasksData.tasks[t];
      if (!task.assigned_agent) {
        tasksWithoutAgent.push(task.id || ('task[' + t + ']'));
      }
    }
    if (tasksWithoutAgent.length > 0) {
      m6Passed = false;
      m6Detail = 'Tasks missing assigned_agent: ' + tasksWithoutAgent.join(', ');
    } else {
      m6Detail = 'All ' + tasksData.tasks.length + ' tasks have assigned_agent';
    }
  } else if (tasksData && !Array.isArray(tasksData.tasks)) {
    // tasks.yml exists but doesn't have tasks array
    m6Detail = 'tasks.yml exists but has no tasks array -- auto-PASS';
  } else {
    m6Detail = 'tasks.yml not yet created (populated by execute skill) -- auto-PASS';
  }
  mustResults.push({
    criterion: 'M6',
    passed: m6Passed,
    detail: m6Detail,
  });

  // --- SHOULD criteria ---

  var shouldResults = [];

  // S1: Phases appear in logical ordering (sequential numbering)
  var s1Passed = true;
  var s1Detail = '';
  if (phases.length > 1) {
    // Extract phase numbers and check sequential
    var phaseNumbers = [];
    for (var pn = 0; pn < phases.length; pn++) {
      var numMatch = phases[pn].label.match(/\d+/);
      if (numMatch) phaseNumbers.push(parseInt(numMatch[0], 10));
    }
    for (var pCheck = 1; pCheck < phaseNumbers.length; pCheck++) {
      if (phaseNumbers[pCheck] <= phaseNumbers[pCheck - 1]) {
        s1Passed = false;
        break;
      }
    }
    s1Detail = s1Passed
      ? 'Phases are in sequential order (' + phaseNumbers.join(', ') + ')'
      : 'Phase numbering is not strictly sequential (' + phaseNumbers.join(', ') + ')';
  } else {
    s1Detail = phases.length === 1
      ? 'Only one phase -- ordering check not applicable'
      : 'No phases found -- ordering check not applicable';
  }
  shouldResults.push({
    criterion: 'S1',
    passed: s1Passed,
    detail: s1Detail,
  });

  // S2: PLAN.md contains effort/sizing information
  var s2Passed = false;
  if (planContent) {
    s2Passed = /(?:effort|estimate|size|sizing|complexity|story\s+points?|hours?|days?)/i.test(planContent);
  }
  shouldResults.push({
    criterion: 'S2',
    passed: s2Passed,
    detail: s2Passed
      ? 'Effort/sizing information found in PLAN.md'
      : 'No effort or sizing information found in PLAN.md (expected "effort", "estimate", "size", or "complexity")',
  });

  // S3: No orphan tasks (all task bullets are under a phase heading)
  var s3Passed = true;
  var s3Detail = '';
  if (planContent) {
    var allLines = planContent.split('\n');
    var orphanCount = 0;
    var inPhaseSection = false;
    for (var ol = 0; ol < allLines.length; ol++) {
      if (/^#{1,4}\s+(?:Phase|Wave|Epic)\s+\d+/i.test(allLines[ol])) {
        inPhaseSection = true;
        continue;
      }
      // If we hit a non-phase heading, we leave the phase section
      if (/^#{1,2}\s+/.test(allLines[ol]) && !/^#{1,4}\s+(?:Phase|Wave|Epic)\s+\d+/i.test(allLines[ol])) {
        inPhaseSection = false;
      }
      // Task bullet not under a phase
      if (!inPhaseSection && /^\s*(?:[-*]|\d+[.)]\s)\s*\S/.test(allLines[ol])) {
        // Exclude bullets that are clearly not tasks (in header sections, metadata, etc.)
        var lineText = allLines[ol].trim();
        if (lineText.length > 10) { // Short bullets are likely metadata, not tasks
          orphanCount++;
        }
      }
    }
    s3Passed = orphanCount === 0;
    s3Detail = s3Passed
      ? 'All task items are under phase headings'
      : orphanCount + ' task-like bullet(s) found outside of phase sections';
  } else {
    s3Detail = 'Cannot check for orphan tasks: PLAN.md does not exist';
  }
  shouldResults.push({
    criterion: 'S3',
    passed: s3Passed,
    detail: s3Detail,
  });

  // S4: If override-context.md exists, PLAN.md mentions overridden DAs. Auto-PASS if no override.
  var s4Passed = true;
  var s4Detail = '';
  if (overrideContent === null) {
    s4Detail = 'No override-context.md found -- auto-PASS';
  } else {
    // Extract DA references from override-context.md
    var overrideDAs = [];
    var overrideDAMatches = overrideContent.match(/DA-\d+/gi);
    if (overrideDAMatches) {
      // Deduplicate
      var seen = {};
      for (var oi = 0; oi < overrideDAMatches.length; oi++) {
        var odaId = overrideDAMatches[oi].toUpperCase();
        if (!seen[odaId]) {
          overrideDAs.push(odaId);
          seen[odaId] = true;
        }
      }
    }

    if (overrideDAs.length === 0) {
      s4Detail = 'override-context.md exists but no DA references found -- auto-PASS';
    } else {
      var missingOverrideDAs = [];
      for (var oda = 0; oda < overrideDAs.length; oda++) {
        if (planContent && planContent.toUpperCase().indexOf(overrideDAs[oda]) === -1) {
          missingOverrideDAs.push(overrideDAs[oda]);
        }
      }
      if (missingOverrideDAs.length > 0) {
        s4Passed = false;
        s4Detail = 'Override-affected DAs not mentioned in PLAN.md: ' + missingOverrideDAs.join(', ');
      } else {
        s4Detail = 'All override-affected DAs (' + overrideDAs.join(', ') + ') are referenced in PLAN.md';
      }
    }
  }
  shouldResults.push({
    criterion: 'S4',
    passed: s4Passed,
    detail: s4Detail,
  });

  // S5: Total task count across all phases is at least 5
  var totalTasks = countAllTasks(planContent);
  shouldResults.push({
    criterion: 'S5',
    passed: totalTasks >= 5,
    detail: totalTasks >= 5
      ? 'Total task count is ' + totalTasks + ' (minimum 5)'
      : 'Total task count is ' + totalTasks + ', expected at least 5',
  });

  // --- Build entry and output ---

  var entry = utils.buildEntry(GATE_ID, EVALUATOR, mustResults, shouldResults, HOLD_OUTCOME);
  utils.appendGateResult(gatesPath, entry);

  var allChecks = mustResults.concat(shouldResults);
  var failedChecks = allChecks.filter(function (c) { return !c.passed; });

  utils.printResult(entry, failedChecks);

  if (entry.outcome === 'recycle') {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
