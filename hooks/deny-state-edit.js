#!/usr/bin/env node
'use strict';

// Deny Edit tool on .expedite/*.yml state files.
// State files must use Write tool (complete-rewrite semantics) for proper
// schema validation and FSM enforcement by validate-state-write.js.

if (process.env.EXPEDITE_HOOKS_DISABLED === 'true' || process.env.EXPEDITE_HOOKS_DISABLED === '1') {
  process.exit(0);
}

var STATE_FILE_NAMES = ['state.yml', 'checkpoint.yml', 'questions.yml', 'gates.yml', 'tasks.yml'];

var chunks = [];
process.stdin.on('data', function (chunk) { chunks.push(chunk); });
process.stdin.on('end', function () {
  try {
    var input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    var filePath = input.tool_input && input.tool_input.file_path;
    if (!filePath) { process.exit(0); }

    for (var i = 0; i < STATE_FILE_NAMES.length; i++) {
      if (filePath.endsWith('/.expedite/' + STATE_FILE_NAMES[i])) {
        process.stdout.write(JSON.stringify({
          permissionDecision: 'deny',
          permissionDecisionReason: 'State files (.expedite/*.yml) must be written with the Write tool, not Edit. ' +
            'Use complete-rewrite semantics: read the current file, modify in memory, write the entire file. ' +
            'To bypass enforcement entirely, set EXPEDITE_HOOKS_DISABLED=true.',
        }));
        process.exit(2);
      }
    }
    process.exit(0);
  } catch (err) {
    process.exit(0);
  }
});
process.stdin.on('error', function () { process.exit(0); });
