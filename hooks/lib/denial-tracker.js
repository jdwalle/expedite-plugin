#!/usr/bin/env node
'use strict';

// ============================================================================
// Denial Tracker: Per-pattern denial count tracking with escalation threshold
// ============================================================================
// Tracks how many times each transition pattern has been denied. After
// ESCALATION_THRESHOLD denials, callers append manual intervention guidance.
// Fail-open: any I/O error returns 1 (first denial) to avoid blocking.
// ============================================================================

var ESCALATION_THRESHOLD = 3;

var DENIAL_COUNTS_FILE = '.denial-counts.json';

/**
 * Record a denial for the given pattern string.
 * Returns the new count (number). Creates file if missing. Fail-open on error.
 * @param {string} expediteDir - Path to .expedite/ directory
 * @param {string} pattern - Pattern string (e.g., 'gate:G1:scope_complete')
 * @returns {number} New denial count for this pattern
 */
function recordDenial(expediteDir, pattern) {
  try {
    var fs = require('fs');
    var path = require('path');
    var filePath = path.join(expediteDir, DENIAL_COUNTS_FILE);
    var counts = {};

    try {
      var raw = fs.readFileSync(filePath, 'utf8');
      counts = JSON.parse(raw);
    } catch (e) {
      // File doesn't exist or is invalid -- start fresh
      counts = {};
    }

    counts[pattern] = (counts[pattern] || 0) + 1;
    fs.writeFileSync(filePath, JSON.stringify(counts, null, 2));
    return counts[pattern];
  } catch (e) {
    // Fail-open: return 1 on any error
    return 1;
  }
}

// Reserved: intended for clearing denial counts after a successful override resolves the pattern.
// Currently unused but has a clear future use case in the override flow.

/**
 * Clear denials for the given pattern string.
 * @param {string} expediteDir - Path to .expedite/ directory
 * @param {string} pattern - Pattern string to clear
 */
function clearDenials(expediteDir, pattern) {
  try {
    var fs = require('fs');
    var path = require('path');
    var filePath = path.join(expediteDir, DENIAL_COUNTS_FILE);
    var raw = fs.readFileSync(filePath, 'utf8');
    var counts = JSON.parse(raw);
    delete counts[pattern];
    fs.writeFileSync(filePath, JSON.stringify(counts, null, 2));
  } catch (e) {
    // Not critical path -- ignore errors
  }
}

module.exports = {
  recordDenial: recordDenial,
  clearDenials: clearDenials,
  ESCALATION_THRESHOLD: ESCALATION_THRESHOLD,
};
