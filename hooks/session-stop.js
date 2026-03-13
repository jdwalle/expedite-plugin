#!/usr/bin/env node
'use strict';

// ============================================================================
// Stop Hook: Write Session Summary
// ============================================================================
// Fires at session end. Reads current state from .expedite/ files on disk and
// writes .expedite/session-summary.md with phase, skill, step, and next action.
// Non-blocking (exit code is informational only).
//
// Exit codes:
//   0 - Always (Stop hooks must never block)
// ============================================================================

// Emergency bypass
if (process.env.EXPEDITE_HOOKS_DISABLED === 'true' || process.env.EXPEDITE_HOOKS_DISABLED === '1') {
  process.exit(0);
}

var chunks = [];

process.stdin.on('data', function (chunk) {
  chunks.push(chunk);
});

process.stdin.on('end', function () {
  try {
    // stdin is read to completion but not used (avoid broken pipe)
    var path = require('path');
    var fs = require('fs');

    // Determine .expedite/ directory from project root
    var expediteDir = path.join(process.cwd(), '.expedite');

    // If no state.yml exists, no lifecycle is active -- nothing to summarize
    try {
      fs.accessSync(path.join(expediteDir, 'state.yml'), fs.constants.R_OK);
    } catch (e) {
      process.exit(0);
    }

    // Write session summary using shared helper
    var sessionSummary = require('./lib/session-summary');
    sessionSummary.writeSummary(expediteDir);

    process.exit(0);
  } catch (err) {
    // Fail open on unexpected errors -- log to stderr for debugging
    process.stderr.write('session-stop hook error: ' + err.message + '\n');
    process.exit(0);
  }
});

process.stdin.on('error', function () {
  // Fail open on stdin errors
  process.exit(0);
});
