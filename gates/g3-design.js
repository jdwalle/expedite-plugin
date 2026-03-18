#!/usr/bin/env node
'use strict';

var path = require('path');
var utils = require('./lib/gate-utils');

var GATE_ID = 'G3';
var EVALUATOR = 'g3-structural-script';
var HOLD_OUTCOME = 'recycle';

/**
 * G3 Design Structural Gate (Layer 1 of dual-layer)
 *
 * Usage: node gates/g3-design.js <project-dir>
 *
 * Reads:
 *   <project-dir>/.expedite/design/DESIGN.md
 *   <project-dir>/.expedite/scope/SCOPE.md
 *   <project-dir>/.expedite/state.yml
 *
 * Writes:
 *   <project-dir>/.expedite/gates.yml (append)
 *
 * Exits 0 on go/go_advisory, 1 on recycle.
 */

function main() {
  var projectDir = process.argv[2];
  if (!projectDir) {
    console.error('Usage: node gates/g3-design.js <project-dir>');
    process.exit(2);
  }

  projectDir = path.resolve(projectDir);

  var designPath = path.join(projectDir, '.expedite', 'design', 'DESIGN.md');
  var scopePath = path.join(projectDir, '.expedite', 'scope', 'SCOPE.md');
  var statePath = path.join(projectDir, '.expedite', 'state.yml');
  var handoffPath = path.join(projectDir, '.expedite', 'design', 'HANDOFF.md');
  var gatesPath = path.join(projectDir, '.expedite', 'gates.yml');

  var designContent = utils.readFile(designPath);
  var scopeContent = utils.readFile(scopePath);
  var state = utils.readYaml(statePath);

  // --- Helper: extract DA sections from DESIGN.md ---
  // Returns array of { id, name, content, startLine, endLine }
  function extractDASections(content, das) {
    if (!content) return [];
    var lines = content.split('\n');
    var sections = [];
    var currentDA = null;
    var currentStart = -1;
    var currentLines = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      // Check if this line is a heading referencing a DA
      var headingMatch = line.match(/^#{1,4}\s+(.*)/);
      if (headingMatch) {
        var headingText = headingMatch[1];
        // Check if any DA id or name appears in this heading
        var matchedDA = null;
        for (var d = 0; d < das.length; d++) {
          var idPattern = new RegExp(das[d].id.replace('-', '[-\\s]?'), 'i');
          if (idPattern.test(headingText)) {
            matchedDA = das[d];
            break;
          }
          if (das[d].name && headingText.toLowerCase().indexOf(das[d].name.toLowerCase()) !== -1) {
            matchedDA = das[d];
            break;
          }
        }

        if (matchedDA) {
          // Close previous DA section
          if (currentDA) {
            sections.push({
              id: currentDA.id,
              name: currentDA.name,
              content: currentLines.join('\n'),
              startLine: currentStart,
              endLine: i - 1,
            });
          }
          currentDA = matchedDA;
          currentStart = i;
          currentLines = [line];
          continue;
        }

        // If we hit a heading of same or higher level that's NOT a DA heading,
        // close the current DA section
        if (currentDA && headingMatch) {
          var currentLevel = (line.match(/^(#+)/) || [''])[0].length;
          var daLevel = 3; // DA sections are typically ### level
          if (currentLevel <= daLevel) {
            sections.push({
              id: currentDA.id,
              name: currentDA.name,
              content: currentLines.join('\n'),
              startLine: currentStart,
              endLine: i - 1,
            });
            currentDA = null;
            currentLines = [];
          }
        }
      }

      if (currentDA) {
        currentLines.push(line);
      }
    }

    // Close last DA section
    if (currentDA) {
      sections.push({
        id: currentDA.id,
        name: currentDA.name,
        content: currentLines.join('\n'),
        startLine: currentStart,
        endLine: lines.length - 1,
      });
    }

    return sections;
  }

  var das = utils.extractDAs(scopeContent);
  var daSections = extractDASections(designContent, das);

  // --- MUST criteria ---

  var mustResults = [];

  // M1: DESIGN.md exists and non-empty
  mustResults.push({
    criterion: 'M1',
    passed: designContent !== null && designContent.trim().length > 0,
    detail: designContent === null
      ? 'DESIGN.md does not exist at ' + designPath
      : (designContent.trim().length === 0
        ? 'DESIGN.md exists but is empty at ' + designPath
        : 'DESIGN.md exists and has content (' + designContent.trim().length + ' chars)'),
  });

  // M2: Every DA from SCOPE.md has a corresponding section in DESIGN.md
  var m2Passed = true;
  var m2Missing = [];
  if (das.length === 0 && scopeContent) {
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
  } else if (!designContent) {
    mustResults.push({
      criterion: 'M2',
      passed: false,
      detail: 'Cannot check DA coverage: DESIGN.md does not exist',
    });
    m2Passed = false;
  } else {
    // Check each DA from SCOPE.md is referenced in DESIGN.md
    var coveredDAIds = {};
    for (var si = 0; si < daSections.length; si++) {
      coveredDAIds[daSections[si].id] = true;
    }
    for (var dIdx = 0; dIdx < das.length; dIdx++) {
      var da = das[dIdx];
      // First check extracted sections, then fallback to text search
      if (!coveredDAIds[da.id]) {
        // Fallback: check if DA id or name appears anywhere in DESIGN.md
        var idFound = designContent.toUpperCase().indexOf(da.id) !== -1;
        var nameFound = da.name && designContent.toLowerCase().indexOf(da.name.toLowerCase()) !== -1;
        if (!idFound && !nameFound) {
          m2Missing.push(da.id + (da.name ? ' (' + da.name + ')' : ''));
          m2Passed = false;
        }
      }
    }
    mustResults.push({
      criterion: 'M2',
      passed: m2Passed,
      detail: m2Passed
        ? 'All ' + das.length + ' DAs from SCOPE.md have corresponding sections in DESIGN.md'
        : 'DAs with no corresponding section in DESIGN.md: ' + m2Missing.join(', '),
    });
  }

  // M3: Each DA section in DESIGN.md contains at least one evidence citation
  var m3Passed = true;
  var m3Missing = [];
  if (daSections.length === 0 && designContent) {
    // No DA sections found -- pass with note (M2 would catch missing DAs)
    mustResults.push({
      criterion: 'M3',
      passed: true,
      detail: 'No DA sections extracted from DESIGN.md (nothing to check for evidence citations)',
    });
  } else if (!designContent) {
    mustResults.push({
      criterion: 'M3',
      passed: false,
      detail: 'Cannot check evidence citations: DESIGN.md does not exist',
    });
    m3Passed = false;
  } else {
    // Evidence citation patterns: F1, F2, Finding 1, evidence-*.md, SYNTHESIS.md
    var evidencePattern = /(?:F\d+|Finding\s+\d+|evidence-\S+\.md|SYNTHESIS\.md)/i;
    for (var ei = 0; ei < daSections.length; ei++) {
      var section = daSections[ei];
      if (!evidencePattern.test(section.content)) {
        m3Missing.push(section.id + (section.name ? ' (' + section.name + ')' : ''));
        m3Passed = false;
      }
    }
    mustResults.push({
      criterion: 'M3',
      passed: m3Passed,
      detail: m3Passed
        ? 'All ' + daSections.length + ' DA sections have evidence citations'
        : 'DA section(s) with no evidence citations in DESIGN.md: ' + m3Missing.join(', '),
    });
  }

  // M4: DESIGN.md has correct format for intent
  var intent = (state && state.intent) ? String(state.intent).toLowerCase() : '';
  var m4Passed = false;
  var m4Detail = '';
  if (!designContent) {
    m4Detail = 'Cannot check format: DESIGN.md does not exist';
  } else if (!intent) {
    // Intent cannot be determined -- pass with advisory
    m4Passed = true;
    m4Detail = 'Intent not found in state.yml -- format check auto-PASS with advisory';
  } else if (intent === 'product') {
    // PRD-style: check for Problem Statement, User Flows, or similar
    var prdPattern = /(?:problem\s+statement|user\s+flows?|user\s+stories|product\s+requirements|acceptance\s+criteria)/i;
    m4Passed = prdPattern.test(designContent);
    m4Detail = m4Passed
      ? 'DESIGN.md has PRD-style sections (product intent)'
      : 'DESIGN.md is missing PRD-style sections (Problem Statement, User Flows, etc.) for product intent';
  } else if (intent === 'engineering') {
    // RFC-style: check for Background, Design, or similar
    var rfcPattern = /(?:background|design|technical\s+design|architecture|implementation)/i;
    m4Passed = rfcPattern.test(designContent);
    m4Detail = m4Passed
      ? 'DESIGN.md has RFC-style sections (engineering intent)'
      : 'DESIGN.md is missing RFC-style sections (Background, Design, etc.) for engineering intent';
  } else {
    // Unknown intent -- pass with advisory
    m4Passed = true;
    m4Detail = 'Unknown intent "' + intent + '" -- format check auto-PASS with advisory';
  }
  mustResults.push({
    criterion: 'M4',
    passed: m4Passed,
    detail: m4Detail,
  });

  // M5: DESIGN.md word count per DA section exceeds minimum threshold (100 words)
  var m5Passed = true;
  var m5Failures = [];
  if (daSections.length === 0 && designContent) {
    mustResults.push({
      criterion: 'M5',
      passed: true,
      detail: 'No DA sections extracted from DESIGN.md (nothing to check for word count)',
    });
  } else if (!designContent) {
    mustResults.push({
      criterion: 'M5',
      passed: false,
      detail: 'Cannot check word counts: DESIGN.md does not exist',
    });
    m5Passed = false;
  } else {
    for (var wi = 0; wi < daSections.length; wi++) {
      var sectionWords = utils.wordCount(daSections[wi].content);
      if (sectionWords < 100) {
        m5Failures.push(daSections[wi].id + ' section has only ' + sectionWords + ' words (minimum 100)');
        m5Passed = false;
      }
    }
    mustResults.push({
      criterion: 'M5',
      passed: m5Passed,
      detail: m5Passed
        ? 'All ' + daSections.length + ' DA sections meet 100-word minimum'
        : m5Failures.join('; '),
    });
  }

  // --- SHOULD criteria ---

  var shouldResults = [];

  // S1: Each DA section contains a "Trade-offs" or "Alternatives" subsection
  var s1Passed = true;
  var s1Missing = [];
  if (daSections.length > 0) {
    var tradeoffPattern = /(?:trade-?offs?|alternatives?)/i;
    for (var t1 = 0; t1 < daSections.length; t1++) {
      if (!tradeoffPattern.test(daSections[t1].content)) {
        s1Passed = false;
        s1Missing.push(daSections[t1].id);
      }
    }
  }
  shouldResults.push({
    criterion: 'S1',
    passed: s1Passed,
    detail: s1Passed
      ? 'All DA sections have Trade-offs or Alternatives subsections'
      : 'DA sections missing Trade-offs/Alternatives: ' + s1Missing.join(', '),
  });

  // S2: Each DA section contains a "Confidence" level indicator
  var s2Passed = true;
  var s2Missing = [];
  if (daSections.length > 0) {
    var confidencePattern = /(?:confidence|(?:high|medium|low)\s+confidence|\d\/\d|\d\s*out\s*of\s*\d)/i;
    for (var c2 = 0; c2 < daSections.length; c2++) {
      if (!confidencePattern.test(daSections[c2].content)) {
        s2Passed = false;
        s2Missing.push(daSections[c2].id);
      }
    }
  }
  shouldResults.push({
    criterion: 'S2',
    passed: s2Passed,
    detail: s2Passed
      ? 'All DA sections have confidence level indicators'
      : 'DA sections missing confidence indicators: ' + s2Missing.join(', '),
  });

  // S3: DESIGN.md total word count exceeds 500 words
  var totalWords = utils.wordCount(designContent);
  shouldResults.push({
    criterion: 'S3',
    passed: totalWords > 500,
    detail: totalWords > 500
      ? 'DESIGN.md total word count is ' + totalWords + ' (exceeds 500)'
      : 'DESIGN.md total word count is ' + totalWords + ', recommend at least 500',
  });

  // S4: If intent is "product", HANDOFF.md exists. Auto-PASS for "engineering" intent.
  var s4Passed = true;
  var s4Detail = '';
  if (intent === 'product') {
    var handoffContent = utils.readFile(handoffPath);
    s4Passed = handoffContent !== null && handoffContent.trim().length > 0;
    s4Detail = s4Passed
      ? 'HANDOFF.md exists for product intent'
      : 'HANDOFF.md does not exist at ' + handoffPath + ' (recommended for product intent)';
  } else {
    s4Detail = 'Intent is "' + (intent || 'unknown') + '" -- HANDOFF.md check auto-PASS';
  }
  shouldResults.push({
    criterion: 'S4',
    passed: s4Passed,
    detail: s4Detail,
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
