'use strict';

var fs = require('fs');
var path = require('path');
var yaml = require(path.join(__dirname, '../../hooks/node_modules/js-yaml'));

/**
 * Read and parse a YAML file.
 * @param {string} filePath - Absolute or relative path to YAML file
 * @returns {object|null} Parsed object, or null on error/missing
 */
function readYaml(filePath) {
  try {
    var content = fs.readFileSync(filePath, 'utf8');
    return yaml.load(content) || null;
  } catch (err) {
    return null;
  }
}

/**
 * Read a file as UTF-8 string.
 * @param {string} filePath - Absolute or relative path
 * @returns {string|null} File content, or null if missing/error
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return null;
  }
}

/**
 * Append a gate result entry to gates.yml (read-then-append semantics).
 * Creates the file if it does not exist.
 * @param {string} gatesYmlPath - Path to gates.yml
 * @param {object} entry - Gate history entry to append
 */
function appendGateResult(gatesYmlPath, entry) {
  var existing = null;
  try {
    var raw = fs.readFileSync(gatesYmlPath, 'utf8');
    existing = yaml.load(raw);
  } catch (err) {
    // File does not exist or is invalid -- start fresh
  }

  if (!existing || !Array.isArray(existing.history)) {
    existing = { history: [] };
  }

  existing.history.push(entry);

  var output = yaml.dump(existing, { lineWidth: 120, noRefs: true });
  // Ensure parent directory exists
  var dir = path.dirname(gatesYmlPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(gatesYmlPath, output, 'utf8');
}

/**
 * Format an array of check results into human-readable failure messages.
 * @param {Array<{criterion: string, passed: boolean, detail: string}>} checks
 * @returns {string} Formatted string with one bullet per failed check
 */
function formatChecks(checks) {
  var lines = [];
  for (var i = 0; i < checks.length; i++) {
    if (!checks[i].passed) {
      lines.push('- ' + checks[i].criterion + ' FAILED: ' + checks[i].detail);
    }
  }
  return lines.join('\n');
}

/**
 * Compute gate outcome from MUST and SHOULD results.
 * @param {Array<{criterion: string, passed: boolean, detail: string}>} mustResults
 * @param {Array<{criterion: string, passed: boolean, detail: string}>} shouldResults
 * @param {string} [holdOutcome="hold"] - Outcome when MUST criteria fail ("hold" for G1, "recycle" for G4)
 * @returns {{outcome: string, must_passed: number, must_failed: number, should_passed: number, should_failed: number}}
 */
function computeOutcome(mustResults, shouldResults, holdOutcome) {
  if (!holdOutcome) holdOutcome = 'hold';

  var mustPassed = 0;
  var mustFailed = 0;
  var shouldPassed = 0;
  var shouldFailed = 0;

  for (var i = 0; i < mustResults.length; i++) {
    if (mustResults[i].passed) mustPassed++;
    else mustFailed++;
  }
  for (var j = 0; j < shouldResults.length; j++) {
    if (shouldResults[j].passed) shouldPassed++;
    else shouldFailed++;
  }

  var outcome;
  if (mustFailed > 0) {
    outcome = holdOutcome;
  } else if (shouldFailed > 0) {
    outcome = 'go_advisory';
  } else {
    outcome = 'go';
  }

  return {
    outcome: outcome,
    must_passed: mustPassed,
    must_failed: mustFailed,
    should_passed: shouldPassed,
    should_failed: shouldFailed,
  };
}

/**
 * Build a complete gate history entry ready for appendGateResult.
 * @param {string} gate - Gate ID (e.g., "G1", "G4")
 * @param {string} evaluator - Evaluator identifier (e.g., "g1-scope-script")
 * @param {Array} mustResults - MUST check results
 * @param {Array} shouldResults - SHOULD check results
 * @param {string} [holdOutcome="hold"] - Outcome when MUST criteria fail
 * @returns {object} Complete gate history entry
 */
function buildEntry(gate, evaluator, mustResults, shouldResults, holdOutcome) {
  var result = computeOutcome(mustResults, shouldResults, holdOutcome);

  // Build structural_checks object with per-criterion results
  var structuralChecks = {};
  var allChecks = mustResults.concat(shouldResults);
  for (var i = 0; i < allChecks.length; i++) {
    structuralChecks[allChecks[i].criterion] = {
      passed: allChecks[i].passed,
      detail: allChecks[i].detail,
    };
  }

  // Collect failure notes
  var failedChecks = allChecks.filter(function (c) { return !c.passed; });
  var notes = failedChecks.length > 0
    ? failedChecks.map(function (c) { return c.criterion + ': ' + c.detail; }).join('; ')
    : null;

  return {
    gate: gate,
    timestamp: new Date().toISOString(),
    outcome: result.outcome,
    evaluator: evaluator,
    must_passed: result.must_passed,
    must_failed: result.must_failed,
    should_passed: result.should_passed,
    should_failed: result.should_failed,
    structural_checks: structuralChecks,
    notes: notes,
    overridden: false,
  };
}

/**
 * Print structured JSON result to stdout for the calling skill to parse.
 * @param {object} entry - Gate history entry
 * @param {Array} failedChecks - Array of failed check objects
 */
function printResult(entry, failedChecks) {
  var failures = [];
  if (failedChecks && failedChecks.length > 0) {
    for (var i = 0; i < failedChecks.length; i++) {
      failures.push(failedChecks[i].criterion + ': ' + failedChecks[i].detail);
    }
  }

  var output = {
    gate: entry.gate,
    outcome: entry.outcome,
    must_passed: entry.must_passed,
    must_failed: entry.must_failed,
    should_passed: entry.should_passed,
    should_failed: entry.should_failed,
    structural_checks: entry.structural_checks,
    failures: failures,
  };

  console.log(JSON.stringify(output, null, 2));
}

module.exports = {
  readYaml: readYaml,
  readFile: readFile,
  appendGateResult: appendGateResult,
  formatChecks: formatChecks,
  computeOutcome: computeOutcome,
  buildEntry: buildEntry,
  printResult: printResult,
};
