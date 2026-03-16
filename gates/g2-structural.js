#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var utils = require('./lib/gate-utils');

var GATE_ID = 'G2';
var EVALUATOR = 'g2-structural-script';
var HOLD_OUTCOME = 'recycle';

/**
 * G2 Structural Research Completeness Gate
 *
 * Usage: node gates/g2-structural.js <project-dir>
 *
 * Reads:
 *   <project-dir>/.expedite/research/SYNTHESIS.md
 *   <project-dir>/.expedite/scope/SCOPE.md
 *   <project-dir>/.expedite/state.yml
 *   <project-dir>/.expedite/research/ (evidence files)
 *   <project-dir>/.expedite/research/sufficiency-results.yml (optional)
 *
 * Writes:
 *   <project-dir>/.expedite/gates.yml (append)
 *
 * Exits 0 on go/go_advisory, 1 on recycle.
 */

function main() {
  var projectDir = process.argv[2];
  if (!projectDir) {
    console.error('Usage: node gates/g2-structural.js <project-dir>');
    process.exit(2);
  }

  projectDir = path.resolve(projectDir);

  var synthesisPath = path.join(projectDir, '.expedite', 'research', 'SYNTHESIS.md');
  var scopePath = path.join(projectDir, '.expedite', 'scope', 'SCOPE.md');
  var researchDir = path.join(projectDir, '.expedite', 'research');
  var sufficiencyPath = path.join(projectDir, '.expedite', 'research', 'sufficiency-results.yml');
  var gatesPath = path.join(projectDir, '.expedite', 'gates.yml');

  var synthesisContent = utils.readFile(synthesisPath);
  var scopeContent = utils.readFile(scopePath);
  var sufficiencyData = utils.readYaml(sufficiencyPath);

  // --- Helper: extract DA identifiers and names from SCOPE.md ---
  function extractDAs(content) {
    if (!content) return [];
    var das = [];
    var lines = content.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var match = lines[i].match(/^#{1,4}\s+.*?(DA-\d+)(?:\s*[:\-]\s*(.+))?/i);
      if (match) {
        das.push({
          id: match[1].toUpperCase(),
          name: match[2] ? match[2].trim() : null,
        });
      }
    }
    return das;
  }

  // --- Helper: list evidence files matching evidence-*.md pattern ---
  function listEvidenceFiles(dir) {
    try {
      var files = fs.readdirSync(dir);
      return files.filter(function (f) {
        return /^evidence-.*\.md$/i.test(f);
      });
    } catch (err) {
      return [];
    }
  }

  // --- Helper: count words in a string ---
  function wordCount(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(function (w) { return w.length > 0; }).length;
  }

  var das = extractDAs(scopeContent);
  var evidenceFiles = listEvidenceFiles(researchDir);

  // --- MUST criteria ---

  var mustResults = [];

  // M1: SYNTHESIS.md exists and non-empty
  mustResults.push({
    criterion: 'M1',
    passed: synthesisContent !== null && synthesisContent.trim().length > 0,
    detail: synthesisContent === null
      ? 'SYNTHESIS.md does not exist at ' + synthesisPath
      : (synthesisContent.trim().length === 0
        ? 'SYNTHESIS.md exists but is empty at ' + synthesisPath
        : 'SYNTHESIS.md exists and has content (' + synthesisContent.trim().length + ' chars)'),
  });

  // M2: For each DA referenced in SCOPE.md, SYNTHESIS.md contains a corresponding section
  var m2Passed = true;
  var m2Missing = [];
  if (das.length === 0 && scopeContent) {
    mustResults.push({
      criterion: 'M2',
      passed: true,
      detail: 'No DA identifiers found in SCOPE.md (nothing to cross-reference)',
    });
  } else if (!scopeContent) {
    m2Passed = false;
    mustResults.push({
      criterion: 'M2',
      passed: false,
      detail: 'Cannot check DA coverage: SCOPE.md does not exist at ' + scopePath,
    });
  } else if (!synthesisContent) {
    m2Passed = false;
    mustResults.push({
      criterion: 'M2',
      passed: false,
      detail: 'Cannot check DA coverage: SYNTHESIS.md does not exist',
    });
  } else {
    for (var dIdx = 0; dIdx < das.length; dIdx++) {
      var da = das[dIdx];
      // Check for DA identifier or DA name in SYNTHESIS.md
      var idFound = synthesisContent.toUpperCase().indexOf(da.id) !== -1;
      var nameFound = da.name && synthesisContent.toLowerCase().indexOf(da.name.toLowerCase()) !== -1;
      if (!idFound && !nameFound) {
        m2Missing.push(da.id + (da.name ? ' (' + da.name + ')' : ''));
        m2Passed = false;
      }
    }
    mustResults.push({
      criterion: 'M2',
      passed: m2Passed,
      detail: m2Passed
        ? 'All ' + das.length + ' DAs from SCOPE.md have corresponding sections in SYNTHESIS.md'
        : 'DAs with no corresponding section in SYNTHESIS.md: ' + m2Missing.join(', '),
    });
  }

  // M3: At least one evidence file exists in .expedite/research/
  mustResults.push({
    criterion: 'M3',
    passed: evidenceFiles.length >= 1,
    detail: evidenceFiles.length >= 1
      ? 'Found ' + evidenceFiles.length + ' evidence file(s) in research directory'
      : 'No evidence files (evidence-*.md) found in ' + researchDir,
  });

  // M4: SYNTHESIS.md contains readiness/sufficiency assessment content
  var m4Passed = false;
  var m4Detail = '';
  if (synthesisContent) {
    // Check for readiness/sufficiency heading in SYNTHESIS.md
    var hasReadinessHeading = /^#{1,4}\s+.*(?:readiness|sufficiency)/im.test(synthesisContent);
    if (hasReadinessHeading) {
      m4Passed = true;
      m4Detail = 'SYNTHESIS.md contains a readiness/sufficiency assessment heading';
    } else {
      // Fallback: check for sufficiency-results.yml existence
      if (sufficiencyData !== null) {
        m4Passed = true;
        m4Detail = 'sufficiency-results.yml exists as readiness assessment (no heading in SYNTHESIS.md)';
      } else {
        // Last check: readiness mentioned anywhere in synthesis
        var hasReadinessContent = /readiness|sufficiency/i.test(synthesisContent);
        if (hasReadinessContent) {
          m4Passed = true;
          m4Detail = 'SYNTHESIS.md mentions readiness/sufficiency in content (no dedicated heading)';
        } else {
          m4Detail = 'SYNTHESIS.md has no readiness or sufficiency assessment content, and sufficiency-results.yml does not exist';
        }
      }
    }
  } else {
    m4Detail = 'Cannot check readiness assessment: SYNTHESIS.md does not exist';
  }
  mustResults.push({
    criterion: 'M4',
    passed: m4Passed,
    detail: m4Detail,
  });

  // M5: No DA has status "INSUFFICIENT" in the readiness assessment
  var m5Passed = true;
  var m5Detail = '';
  var insufficientDAs = [];

  // Check sufficiency-results.yml first (structured data, more reliable)
  if (sufficiencyData && typeof sufficiencyData === 'object') {
    // Check for per-DA results (support various structures)
    var results = sufficiencyData.results || sufficiencyData.assessments || sufficiencyData;
    if (Array.isArray(results)) {
      for (var ri = 0; ri < results.length; ri++) {
        var r = results[ri];
        var status = (r.status || r.verdict || r.assessment || '').toString().toUpperCase();
        if (status === 'INSUFFICIENT') {
          insufficientDAs.push(r.da || r.decision_area || r.id || ('result[' + ri + ']'));
        }
      }
    } else if (typeof results === 'object') {
      var keys = Object.keys(results);
      for (var ki = 0; ki < keys.length; ki++) {
        var val = results[keys[ki]];
        if (val && typeof val === 'object') {
          var s = (val.status || val.verdict || val.assessment || '').toString().toUpperCase();
          if (s === 'INSUFFICIENT') {
            insufficientDAs.push(keys[ki]);
          }
        }
      }
    }
  }

  // Also check SYNTHESIS.md for inline INSUFFICIENT markers
  if (synthesisContent) {
    // Look for patterns like "DA-1: INSUFFICIENT" or "Status: INSUFFICIENT"
    var lines = synthesisContent.split('\n');
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      if (/insufficient/i.test(line)) {
        // Extract DA reference if present
        var daMatch = line.match(/DA-\d+/i);
        if (daMatch) {
          var daRef = daMatch[0].toUpperCase();
          // Avoid duplicates from sufficiency-results.yml
          if (insufficientDAs.indexOf(daRef) === -1) {
            insufficientDAs.push(daRef);
          }
        }
      }
    }
  }

  if (insufficientDAs.length > 0) {
    m5Passed = false;
    m5Detail = 'DA(s) marked INSUFFICIENT: ' + insufficientDAs.join(', ') + ' -- evidence gap must be addressed before proceeding';
  } else if (!synthesisContent && !sufficiencyData) {
    // No data to parse -- pass with advisory note (M1 already catches missing SYNTHESIS)
    m5Passed = true;
    m5Detail = 'No status data to parse (SYNTHESIS.md and sufficiency-results.yml both missing) -- vacuous pass';
  } else {
    m5Detail = 'No DA marked INSUFFICIENT in readiness assessment';
  }
  mustResults.push({
    criterion: 'M5',
    passed: m5Passed,
    detail: m5Detail,
  });

  // --- SHOULD criteria ---

  var shouldResults = [];

  // S1: Every DA has an explicit readiness status (not just absence of INSUFFICIENT)
  var s1Passed = true;
  var s1Missing = [];
  if (das.length > 0 && (sufficiencyData || synthesisContent)) {
    for (var s1i = 0; s1i < das.length; s1i++) {
      var daId = das[s1i].id;
      var hasExplicitStatus = false;

      // Check sufficiency-results.yml
      if (sufficiencyData) {
        var sResults = sufficiencyData.results || sufficiencyData.assessments || sufficiencyData;
        if (Array.isArray(sResults)) {
          for (var sr = 0; sr < sResults.length; sr++) {
            var sra = sResults[sr];
            var sraId = (sra.da || sra.decision_area || sra.id || '').toString().toUpperCase();
            if (sraId === daId && (sra.status || sra.verdict || sra.assessment)) {
              hasExplicitStatus = true;
              break;
            }
          }
        }
      }

      // Check SYNTHESIS.md for explicit status near DA reference
      if (!hasExplicitStatus && synthesisContent) {
        var statusPattern = new RegExp(daId + '[^\\n]*(?:SUFFICIENT|ADEQUATE|STRONG|GOOD|COMPLETE|MET|PARTIAL|WEAK|INSUFFICIENT)', 'i');
        if (statusPattern.test(synthesisContent)) {
          hasExplicitStatus = true;
        }
      }

      if (!hasExplicitStatus) {
        s1Passed = false;
        s1Missing.push(daId);
      }
    }
  } else if (das.length === 0) {
    s1Passed = true;
  }
  shouldResults.push({
    criterion: 'S1',
    passed: s1Passed,
    detail: s1Passed
      ? 'All DAs have explicit readiness status'
      : 'DAs without explicit readiness status: ' + s1Missing.join(', '),
  });

  // S2: Evidence files cover multiple sources (at least 2 distinct evidence-*.md files)
  shouldResults.push({
    criterion: 'S2',
    passed: evidenceFiles.length >= 2,
    detail: evidenceFiles.length >= 2
      ? 'Found ' + evidenceFiles.length + ' evidence files (multiple sources covered)'
      : 'Found ' + evidenceFiles.length + ' evidence file(s), recommend at least 2 for source diversity',
  });

  // S3: SYNTHESIS.md word count exceeds 500 words
  var synthWords = wordCount(synthesisContent);
  shouldResults.push({
    criterion: 'S3',
    passed: synthWords > 500,
    detail: synthWords > 500
      ? 'SYNTHESIS.md word count is ' + synthWords + ' (exceeds 500 minimum)'
      : 'SYNTHESIS.md word count is ' + synthWords + ', recommend at least 500 for meaningful synthesis',
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
