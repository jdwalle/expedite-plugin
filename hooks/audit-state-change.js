#!/usr/bin/env node
'use strict';

// ============================================================================
// PostToolUse Hook: Audit State File Changes
// ============================================================================
// Logs .expedite/*.yml writes to .expedite/audit.log as append-only entries.
// Non-state writes pass through immediately. Never blocks (always exit 0).
//
// Exit codes:
//   0 - Always (PostToolUse hooks must never block)
// ============================================================================
// STATE-04: audit.log is append-only and never loaded into LLM context.

// Emergency bypass
if (process.env.EXPEDITE_HOOKS_DISABLED === 'true' || process.env.EXPEDITE_HOOKS_DISABLED === '1') {
  process.exit(0);
}

var STATE_FILE_NAMES = ['state.yml', 'checkpoint.yml', 'questions.yml', 'gates.yml', 'tasks.yml'];

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
      process.exit(0);
    }

    // Non-state passthrough
    var matchedFile = null;
    for (var i = 0; i < STATE_FILE_NAMES.length; i++) {
      if (filePath.endsWith('/.expedite/' + STATE_FILE_NAMES[i])) {
        matchedFile = STATE_FILE_NAMES[i];
        break;
      }
    }

    if (!matchedFile) {
      process.exit(0);
    }

    // Build audit entry
    var fs = require('fs');
    var path = require('path');
    var timestamp = new Date().toISOString();
    var content = input.tool_input.content || '';

    var entry;

    // Determine expedite directory early (needed by override detection)
    var expediteDir = path.dirname(filePath);

    // Check for override-specific logging
    if (matchedFile === 'gates.yml' && /outcome:\s*['"]?overridden['"]?/.test(content)) {
      // Extract gate, override_reason, and severity from content
      var gateMatch = content.match(/gate:\s*["']?([A-Z]\d+)["']?/);
      var reasonMatch = content.match(/override_reason:\s*["']?([^\n"']+)["']?/);
      var severityMatch = content.match(/severity:\s*["']?(low|medium|high)["']?/);

      // STATE-04: Look up current phase from state.yml for traceability
      var yaml = require('js-yaml');
      var currentPhase = 'unknown';
      try {
        var statePath = path.join(expediteDir, 'state.yml');
        var stateRaw = fs.readFileSync(statePath, 'utf8');
        var stateObj = yaml.load(stateRaw);
        if (stateObj && stateObj.phase) currentPhase = stateObj.phase;
      } catch (e) { /* fail open */ }

      entry = '---\n' +
        'event: override_write\n' +
        'timestamp: "' + timestamp + '"\n' +
        'file: "' + matchedFile + '"\n' +
        'gate: "' + (gateMatch ? gateMatch[1] : 'unknown') + '"\n' +
        'override_reason: "' + (reasonMatch ? reasonMatch[1].trim() : 'not specified') + '"\n' +
        'severity: "' + (severityMatch ? severityMatch[1] : 'unspecified') + '"\n' +
        'current_phase: "' + currentPhase + '"\n';
    } else {
      entry = '---\n' +
        'event: state_write\n' +
        'timestamp: "' + timestamp + '"\n' +
        'file: "' + matchedFile + '"\n';
    }

    // Determine audit log path: sibling of the state file
    var auditLogPath = path.join(expediteDir, 'audit.log');

    // Append to audit log
    fs.appendFileSync(auditLogPath, entry);
    process.exit(0);
  } catch (err) {
    // Never block -- log to stderr for debugging
    process.stderr.write('audit-state-change hook error: ' + err.message + '\n');
    process.exit(0);
  }
});

process.stdin.on('error', function () {
  // Never block
  process.exit(0);
});
