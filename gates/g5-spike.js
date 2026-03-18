#!/usr/bin/env node
'use strict';

var path = require('path');
var utils = require('./lib/gate-utils');

var GATE_ID = 'G5';
var EVALUATOR = 'g5-structural-script';
var HOLD_OUTCOME = 'recycle';

/**
 * G5 Spike Structural Gate
 *
 * Usage: node gates/g5-spike.js <project-dir> <phase-slug>
 *
 * Reads:
 *   <project-dir>/.expedite/plan/phases/<phase-slug>/SPIKE.md
 *   <project-dir>/.expedite/plan/PLAN.md
 *   <project-dir>/.expedite/scope/SCOPE.md
 *
 * Writes:
 *   <project-dir>/.expedite/gates.yml (append)
 *
 * Exits 0 on go/go_advisory, 1 on recycle, 2 on usage error.
 */

function main() {
  var projectDir = process.argv[2];
  var phaseSlug = process.argv[3];

  if (!projectDir || !phaseSlug) {
    console.error('Usage: node gates/g5-spike.js <project-dir> <phase-slug>');
    process.exit(2);
  }

  projectDir = path.resolve(projectDir);

  var spikePath = path.join(projectDir, '.expedite', 'plan', 'phases', phaseSlug, 'SPIKE.md');
  var planPath = path.join(projectDir, '.expedite', 'plan', 'PLAN.md');
  var scopePath = path.join(projectDir, '.expedite', 'scope', 'SCOPE.md');
  var gatesPath = path.join(projectDir, '.expedite', 'gates.yml');

  var spikeContent = utils.readFile(spikePath);
  var planContent = utils.readFile(planPath);
  var scopeContent = utils.readFile(scopePath);

  // --- Helper: extract TD identifiers from PLAN.md for the target phase ---
  function extractPhaseTDs(content, slug) {
    if (!content) return [];
    var tds = [];
    var lines = content.split('\n');
    var inTargetPhase = false;
    // Derive phase number from slug (e.g., "wave-1" -> 1, "epic-2" -> 2)
    var slugNum = slug.match(/(\d+)/);
    var phaseNum = slugNum ? slugNum[1] : null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      // Match phase/wave/epic headings
      var phaseMatch = line.match(/^#{1,4}\s+(?:Phase|Wave|Epic)\s+(\d+)/i);
      if (phaseMatch) {
        inTargetPhase = phaseNum && phaseMatch[1] === phaseNum;
        continue;
      }
      // Also match slug directly in heading (e.g., "### wave-1")
      if (!inTargetPhase && line.match(new RegExp('^#{1,4}\\s+.*' + slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))) {
        inTargetPhase = true;
        continue;
      }
      // Exit phase on next phase heading
      if (inTargetPhase && /^#{1,4}\s+(?:Phase|Wave|Epic)\s+\d+/i.test(line) && !line.match(new RegExp(slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))) {
        inTargetPhase = false;
      }
      // Collect TD references within target phase
      if (inTargetPhase) {
        var tdMatches = line.match(/TD-\d+/gi);
        if (tdMatches) {
          for (var t = 0; t < tdMatches.length; t++) {
            var tdId = tdMatches[t].toUpperCase();
            if (tds.indexOf(tdId) === -1) {
              tds.push(tdId);
            }
          }
        }
      }
    }

    return tds;
  }

  // --- Helper: count implementation steps ---
  function countImplementationSteps(content) {
    if (!content) return 0;
    var lines = content.split('\n');
    var inImplSection = false;
    var count = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      // Look for implementation/steps heading
      if (/^#{1,4}\s+.*(?:implementation|steps)/i.test(line)) {
        inImplSection = true;
        continue;
      }
      // Exit on next heading of same or higher level
      if (inImplSection && /^#{1,4}\s+/.test(line) && !/^#{1,4}\s+.*(?:implementation|steps)/i.test(line)) {
        // Check if it's a sub-heading (lower level) or same/higher level
        var headingLevel = line.match(/^(#+)/);
        if (headingLevel && headingLevel[1].length <= 3) {
          break;
        }
      }
      // Count numbered or bulleted items in implementation section
      if (inImplSection && /^\s*(?:\d+[.)]\s+|-\s+|\*\s+)\S/.test(line)) {
        count++;
      }
    }

    return count;
  }

  var phaseTDs = extractPhaseTDs(planContent, phaseSlug);

  // --- MUST criteria ---

  var mustResults = [];

  // M1: SPIKE.md exists and is non-empty
  mustResults.push({
    criterion: 'M1',
    passed: spikeContent !== null && spikeContent.trim().length > 0,
    detail: spikeContent === null
      ? 'SPIKE.md does not exist at ' + spikePath
      : (spikeContent.trim().length === 0
        ? 'SPIKE.md exists but is empty at ' + spikePath
        : 'SPIKE.md exists and has content (' + spikeContent.trim().length + ' chars)'),
  });

  // M2: Every TD referenced in the phase section of PLAN.md has a corresponding resolution in SPIKE.md
  var m2Passed = true;
  var m2Missing = [];
  if (phaseTDs.length === 0) {
    // No TDs found for this phase -- pass with advisory
    mustResults.push({
      criterion: 'M2',
      passed: true,
      detail: 'No TD identifiers found in PLAN.md for phase ' + phaseSlug + ' (nothing to cross-reference) -- pass with advisory',
    });
  } else if (!spikeContent) {
    m2Passed = false;
    mustResults.push({
      criterion: 'M2',
      passed: false,
      detail: 'Cannot check TD coverage: SPIKE.md does not exist',
    });
  } else {
    for (var tIdx = 0; tIdx < phaseTDs.length; tIdx++) {
      var td = phaseTDs[tIdx];
      var tdFound = spikeContent.toUpperCase().indexOf(td) !== -1;
      if (!tdFound) {
        m2Missing.push(td);
        m2Passed = false;
      }
    }
    mustResults.push({
      criterion: 'M2',
      passed: m2Passed,
      detail: m2Passed
        ? 'All ' + phaseTDs.length + ' TDs from PLAN.md phase ' + phaseSlug + ' have corresponding sections in SPIKE.md'
        : 'TDs with no corresponding section in SPIKE.md: ' + m2Missing.join(', '),
    });
  }

  // M3: Each TD resolution in SPIKE.md has a rationale
  var m3Passed = true;
  var m3Missing = [];
  if (spikeContent && phaseTDs.length > 0) {
    var spikeLines = spikeContent.split('\n');
    for (var m3i = 0; m3i < phaseTDs.length; m3i++) {
      var tdRef = phaseTDs[m3i];
      var foundTD = false;
      var hasRationale = false;
      var afterResolution = false;
      var contentAfterTD = 0;

      for (var li = 0; li < spikeLines.length; li++) {
        var sLine = spikeLines[li];
        // Find TD reference in SPIKE.md
        if (sLine.toUpperCase().indexOf(tdRef) !== -1) {
          foundTD = true;
          afterResolution = true;
          continue;
        }
        // After finding TD, check for rationale indicators or content
        if (afterResolution) {
          // Stop at next TD or major heading
          if (/^#{1,3}\s+/.test(sLine) && /TD-\d+/i.test(sLine)) {
            break;
          }
          // Check for explicit rationale markers
          if (/(?:rationale|reason|because)/i.test(sLine)) {
            hasRationale = true;
            break;
          }
          // Count non-empty lines as content (paragraph after resolution = implicit rationale)
          if (sLine.trim().length > 10) {
            contentAfterTD++;
            if (contentAfterTD >= 2) {
              hasRationale = true;
              break;
            }
          }
        }
      }

      if (foundTD && !hasRationale) {
        m3Passed = false;
        m3Missing.push(tdRef);
      }
    }
  } else if (!spikeContent) {
    m3Passed = false;
  }

  if (!spikeContent && phaseTDs.length > 0) {
    mustResults.push({
      criterion: 'M3',
      passed: false,
      detail: 'Cannot check TD rationale: SPIKE.md does not exist',
    });
  } else if (phaseTDs.length === 0) {
    mustResults.push({
      criterion: 'M3',
      passed: true,
      detail: 'No TDs to check rationale for (no TDs in this phase)',
    });
  } else {
    mustResults.push({
      criterion: 'M3',
      passed: m3Passed,
      detail: m3Passed
        ? 'All TD resolutions have rationale text'
        : 'TD resolution(s) with no rationale: ' + m3Missing.join(', '),
    });
  }

  // M4: SPIKE.md contains implementation steps section with at least 3 steps
  var implStepCount = countImplementationSteps(spikeContent);
  mustResults.push({
    criterion: 'M4',
    passed: implStepCount >= 3,
    detail: implStepCount >= 3
      ? 'Implementation steps section has ' + implStepCount + ' steps (minimum 3)'
      : (spikeContent
        ? 'Implementation steps section has ' + implStepCount + ' step(s), minimum is 3'
        : 'Cannot check implementation steps: SPIKE.md does not exist'),
  });

  // --- SHOULD criteria ---

  var shouldResults = [];

  // S1: Implementation steps contain file path references
  var s1Passed = false;
  if (spikeContent) {
    // Check for file paths within implementation section or broadly
    s1Passed = /(?:src\/|lib\/|\.js|\.ts|\.md|\.yml|\.yaml|\.json|\/[\w-]+\/[\w-]+)/i.test(spikeContent);
  }
  shouldResults.push({
    criterion: 'S1',
    passed: s1Passed,
    detail: s1Passed
      ? 'SPIKE.md contains file path references'
      : 'No file path references found in SPIKE.md (expected paths like src/, lib/, or file extensions)',
  });

  // S2: Implementation steps have traceability references (TD-N or DA-N)
  var s2Passed = false;
  if (spikeContent) {
    var hasTraceRefs = /(?:TD-\d+|DA-\d+)/i.test(spikeContent);
    s2Passed = hasTraceRefs;
  }
  shouldResults.push({
    criterion: 'S2',
    passed: s2Passed,
    detail: s2Passed
      ? 'SPIKE.md contains TD/DA traceability references'
      : 'No TD-N or DA-N traceability references found in implementation steps',
  });

  // S3: Each TD resolution references the specific ambiguity or decision point it resolves
  var s3Passed = true;
  if (spikeContent && phaseTDs.length > 0) {
    // Simplified check: each TD section should have descriptive resolution text (not just "chose X")
    var s3Lines = spikeContent.split('\n');
    var genericResolutions = 0;
    for (var s3i = 0; s3i < phaseTDs.length; s3i++) {
      var s3TD = phaseTDs[s3i];
      var inTDSection = false;
      var sectionWords = 0;
      for (var s3l = 0; s3l < s3Lines.length; s3l++) {
        if (s3Lines[s3l].toUpperCase().indexOf(s3TD) !== -1) {
          inTDSection = true;
          continue;
        }
        if (inTDSection) {
          if (/^#{1,3}\s+/.test(s3Lines[s3l]) && /TD-\d+/i.test(s3Lines[s3l])) break;
          sectionWords += s3Lines[s3l].trim().split(/\s+/).filter(function (w) { return w.length > 0; }).length;
        }
      }
      if (inTDSection && sectionWords < 15) {
        genericResolutions++;
      }
    }
    s3Passed = genericResolutions === 0;
  }
  shouldResults.push({
    criterion: 'S3',
    passed: s3Passed,
    detail: s3Passed
      ? 'TD resolutions contain substantive descriptions of the decision point'
      : 'Some TD resolutions appear too brief (fewer than 15 words of context)',
  });

  // S4: SPIKE.md total word count exceeds 300 words
  var spikeWords = utils.wordCount(spikeContent);
  shouldResults.push({
    criterion: 'S4',
    passed: spikeWords > 300,
    detail: spikeWords > 300
      ? 'SPIKE.md word count is ' + spikeWords + ' (exceeds 300 minimum)'
      : 'SPIKE.md word count is ' + spikeWords + ', recommend at least 300 for meaningful spike output',
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
