#!/usr/bin/env node
'use strict';

// ============================================================================
// PreToolUse Hook: Validate State File Writes
// ============================================================================
// Intercepts all Write tool calls. If the target is an .expedite/*.yml state
// file, validates content against the corresponding schema before allowing
// the write. Non-state writes pass through immediately (exit 0).
//
// Exit codes:
//   0 - Allow (non-state file, valid state file, disabled, or hook error)
//   2 - Deny (invalid state file content)
// ============================================================================

// Emergency bypass
if (process.env.EXPEDITE_HOOKS_DISABLED === 'true' || process.env.EXPEDITE_HOOKS_DISABLED === '1') {
  process.exit(0);
}

// State file patterns: /.expedite/{name}.yml
var STATE_FILES = {
  'state.yml': 'validateStateYml',
  'checkpoint.yml': 'validateCheckpointYml',
  'questions.yml': 'validateQuestionsYml',
  'gates.yml': 'validateGatesYml',
  'tasks.yml': 'validateTasksYml',
};

var chunks = [];

process.stdin.on('data', function (chunk) {
  chunks.push(chunk);
});

process.stdin.on('end', function () {
  try {
    var raw = Buffer.concat(chunks).toString('utf8');
    var input = JSON.parse(raw);

    var filePath = input.tool_input && input.tool_input.file_path;
    if (!filePath) {
      // No file path -- pass through
      process.exit(0);
    }

    // Non-state passthrough: check BEFORE any YAML parsing for latency (HOOK-07)
    var matchedValidator = null;
    var fileNames = Object.keys(STATE_FILES);
    for (var i = 0; i < fileNames.length; i++) {
      if (filePath.endsWith('/.expedite/' + fileNames[i])) {
        matchedValidator = STATE_FILES[fileNames[i]];
        break;
      }
    }

    if (!matchedValidator) {
      // Not a state file -- pass through immediately
      process.exit(0);
    }

    // State file detected -- parse YAML and validate
    var yaml = require('js-yaml');
    var schema = require('./lib/state-schema');

    var content = input.tool_input.content;
    var parsed;
    try {
      parsed = yaml.load(content);
    } catch (yamlErr) {
      // YAML parse failure -- deny
      var reason = 'Invalid YAML in state file: ' + yamlErr.message;
      process.stdout.write(JSON.stringify({
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      }));
      process.exit(2);
      return;
    }

    // Run the appropriate validator
    var result = schema[matchedValidator](parsed);

    if (result.valid) {
      process.exit(0);
    } else {
      process.stdout.write(JSON.stringify({
        permissionDecision: 'deny',
        permissionDecisionReason: 'State validation failed: ' + result.errors.join('; '),
      }));
      process.exit(2);
    }
  } catch (err) {
    // Fail open on unexpected errors -- log to stderr for debugging
    process.stderr.write('validate-state-write hook error: ' + err.message + '\n');
    process.exit(0);
  }
});

process.stdin.on('error', function () {
  // Fail open on stdin errors
  process.exit(0);
});
