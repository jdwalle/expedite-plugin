#!/usr/bin/env node
'use strict';

var path = require('path');
var utils = require('./lib/gate-utils');

var GATE_ID = 'G1';
var EVALUATOR = 'g1-scope-script';
var HOLD_OUTCOME = 'hold';

/**
 * G1 Scope Completeness Gate
 *
 * Usage: node gates/g1-scope.js <project-dir>
 *
 * Reads:
 *   <project-dir>/.expedite/scope/SCOPE.md
 *   <project-dir>/.expedite/state.yml
 *
 * Writes:
 *   <project-dir>/.expedite/gates.yml (append)
 *
 * Exits 0 on go/go_advisory, 1 on hold.
 */

function main() {
  var projectDir = process.argv[2];
  if (!projectDir) {
    console.error('Usage: node gates/g1-scope.js <project-dir>');
    process.exit(2);
  }

  projectDir = path.resolve(projectDir);

  var scopePath = path.join(projectDir, '.expedite', 'scope', 'SCOPE.md');
  var statePath = path.join(projectDir, '.expedite', 'state.yml');
  var gatesPath = path.join(projectDir, '.expedite', 'gates.yml');

  var scopeContent = utils.readFile(scopePath);
  var state = utils.readYaml(statePath);

  // --- MUST criteria ---

  var mustResults = [];

  // M1: SCOPE.md exists and non-empty
  mustResults.push({
    criterion: 'M1',
    passed: scopeContent !== null && scopeContent.trim().length > 0,
    detail: scopeContent === null
      ? 'SCOPE.md does not exist at ' + scopePath
      : (scopeContent.trim().length === 0
        ? 'SCOPE.md exists but is empty at ' + scopePath
        : 'SCOPE.md exists and has content (' + scopeContent.trim().length + ' chars)'),
  });

  // M2: questions.yml has questions array with at least 3 entries
  var questionsPath = path.join(projectDir, '.expedite', 'questions.yml');
  var questionsData = utils.readYaml(questionsPath);
  var questions = (questionsData && Array.isArray(questionsData.questions)) ? questionsData.questions : [];
  mustResults.push({
    criterion: 'M2',
    passed: questions.length >= 3,
    detail: questions.length >= 3
      ? 'Found ' + questions.length + ' questions in questions.yml (minimum 3)'
      : 'Found ' + questions.length + ' questions in questions.yml, need at least 3',
  });

  // M3: state.yml has intent set to "product" or "engineering"
  var intent = (state && state.intent) ? String(state.intent).toLowerCase() : '';
  var validIntents = ['product', 'engineering'];
  mustResults.push({
    criterion: 'M3',
    passed: validIntents.indexOf(intent) !== -1,
    detail: validIntents.indexOf(intent) !== -1
      ? 'Intent is "' + intent + '"'
      : 'Intent is "' + (state && state.intent ? state.intent : 'not set') + '", must be "product" or "engineering"',
  });

  // M4: SCOPE.md contains Success Criteria section with at least one bullet
  var hasSuccessCriteria = false;
  if (scopeContent) {
    // Find "Success Criteria" heading, then look for bullets after it
    var lines = scopeContent.split('\n');
    var inSuccessCriteria = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^#{1,4}\s+.*success\s+criteria/i.test(line)) {
        inSuccessCriteria = true;
        continue;
      }
      if (inSuccessCriteria && /^#{1,4}\s+/.test(line)) {
        // Hit next heading, stop
        break;
      }
      if (inSuccessCriteria && /^\s*[-*]\s+\S/.test(line)) {
        hasSuccessCriteria = true;
        break;
      }
    }
  }
  mustResults.push({
    criterion: 'M4',
    passed: hasSuccessCriteria,
    detail: hasSuccessCriteria
      ? 'Success Criteria section found with at least one bullet point'
      : 'No bullet points found under a "Success Criteria" heading in SCOPE.md',
  });

  // M5: Every question has non-null, non-empty evidence_requirements
  var m5Passed = true;
  var m5Missing = [];
  for (var q = 0; q < questions.length; q++) {
    var er = questions[q].evidence_requirements;
    if (!er || (typeof er === 'string' && er.trim().length === 0)) {
      m5Passed = false;
      m5Missing.push(questions[q].id || ('question[' + q + ']'));
    }
  }
  // If no questions at all, M5 passes vacuously (M2 catches the count issue)
  if (questions.length === 0) m5Passed = true;
  mustResults.push({
    criterion: 'M5',
    passed: m5Passed,
    detail: m5Passed
      ? 'All questions have evidence_requirements'
      : 'Missing evidence_requirements for: ' + m5Missing.join(', '),
  });

  // M6: SCOPE.md has DA sections with depth and readiness
  var m6Passed = false;
  var m6Detail = '';
  if (scopeContent) {
    var daLines = scopeContent.split('\n');
    var daHeadings = [];
    // Primary pass: headings with explicit DA-N or "Decision Area" markers
    for (var d = 0; d < daLines.length; d++) {
      if (/^#{1,4}\s+.*(?:DA-\d+|Decision\s+Area)/i.test(daLines[d])) {
        daHeadings.push({ line: d, text: daLines[d] });
      }
    }
    // Fallback pass: if no DA headings found via primary regex, look for
    // headings whose section content contains both depth and readiness
    // (these are DA sections even without the DA-N label)
    if (daHeadings.length === 0) {
      var candidateHeadings = [];
      for (var d2 = 0; d2 < daLines.length; d2++) {
        if (/^#{1,4}\s+/.test(daLines[d2]) && !/^#{1,4}\s+.*success\s+criteria/i.test(daLines[d2]) && !/^#{1,4}\s+.*source\s+config/i.test(daLines[d2]) && !/^#{1,4}\s+.*metadata/i.test(daLines[d2]) && !/^#{1,4}\s+.*project\s+context/i.test(daLines[d2]) && !/^#{1,4}\s+.*risk/i.test(daLines[d2]) && !/^#{1,4}\s+.*concern/i.test(daLines[d2])) {
          candidateHeadings.push({ line: d2, text: daLines[d2] });
        }
      }
      // Check each candidate: is the section content DA-like?
      for (var ch = 0; ch < candidateHeadings.length; ch++) {
        var chStart = candidateHeadings[ch].line;
        var chEnd = (ch + 1 < candidateHeadings.length) ? candidateHeadings[ch + 1].line : daLines.length;
        var chSection = daLines.slice(chStart, chEnd).join('\n');
        if (/depth/i.test(chSection) && /readiness/i.test(chSection)) {
          daHeadings.push({ line: chStart, text: candidateHeadings[ch].text });
        }
      }
    }

    if (daHeadings.length === 0) {
      m6Detail = 'No Decision Area headings (DA-N or "Decision Area") found in SCOPE.md';
    } else {
      var dasWithoutDepth = [];
      var dasWithoutReadiness = [];

      for (var h = 0; h < daHeadings.length; h++) {
        var startLine = daHeadings[h].line;
        var endLine = (h + 1 < daHeadings.length) ? daHeadings[h + 1].line : daLines.length;
        var section = daLines.slice(startLine, endLine).join('\n');

        var hasDepth = /depth/i.test(section);
        var hasReadiness = /readiness/i.test(section);

        var daLabel = daHeadings[h].text.replace(/^#+\s*/, '').trim();
        if (!hasDepth) dasWithoutDepth.push(daLabel);
        if (!hasReadiness) dasWithoutReadiness.push(daLabel);
      }

      if (dasWithoutDepth.length === 0 && dasWithoutReadiness.length === 0) {
        m6Passed = true;
        m6Detail = 'All ' + daHeadings.length + ' DA sections have depth and readiness';
      } else {
        var issues = [];
        if (dasWithoutDepth.length > 0) {
          issues.push('Missing depth: ' + dasWithoutDepth.join(', '));
        }
        if (dasWithoutReadiness.length > 0) {
          issues.push('Missing readiness: ' + dasWithoutReadiness.join(', '));
        }
        m6Detail = issues.join('. ');
      }
    }
  } else {
    m6Detail = 'Cannot check DA sections: SCOPE.md does not exist';
  }
  mustResults.push({
    criterion: 'M6',
    passed: m6Passed,
    detail: m6Detail,
  });

  // --- SHOULD criteria ---

  var shouldResults = [];

  // S1: Every question has non-empty source_hints
  var s1Passed = true;
  var s1Missing = [];
  for (var s1q = 0; s1q < questions.length; s1q++) {
    var sh = questions[s1q].source_hints;
    if (!sh || (Array.isArray(sh) && sh.length === 0)) {
      s1Passed = false;
      s1Missing.push(questions[s1q].id || ('question[' + s1q + ']'));
    }
  }
  if (questions.length === 0) s1Passed = true;
  shouldResults.push({
    criterion: 'S1',
    passed: s1Passed,
    detail: s1Passed
      ? 'All questions have source_hints'
      : 'Missing source_hints for: ' + s1Missing.join(', '),
  });

  // S2: At least 2 unique decision_area values
  var uniqueDAs = {};
  for (var s2q = 0; s2q < questions.length; s2q++) {
    var da = questions[s2q].decision_area;
    if (da) uniqueDAs[da] = true;
  }
  var daCount = Object.keys(uniqueDAs).length;
  shouldResults.push({
    criterion: 'S2',
    passed: daCount >= 2,
    detail: daCount >= 2
      ? 'Found ' + daCount + ' unique decision areas'
      : 'Found ' + daCount + ' unique decision area(s), need at least 2',
  });

  // S3: No more than 15 questions
  shouldResults.push({
    criterion: 'S3',
    passed: questions.length <= 15,
    detail: questions.length <= 15
      ? 'Question count (' + questions.length + ') is within limit of 15'
      : 'Question count (' + questions.length + ') exceeds limit of 15',
  });

  // --- Build entry and output ---

  var entry = utils.buildEntry(GATE_ID, EVALUATOR, mustResults, shouldResults, HOLD_OUTCOME);
  utils.appendGateResult(gatesPath, entry);

  var allChecks = mustResults.concat(shouldResults);
  var failedChecks = allChecks.filter(function (c) { return !c.passed; });

  utils.printResult(entry, failedChecks);

  if (entry.outcome === 'hold') {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
