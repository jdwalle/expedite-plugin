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

// Deny helper -- outputs structured denial and exits with code 2
function deny(reason) {
  process.stdout.write(JSON.stringify({
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  }));
  process.exit(2);
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

    // State file detected -- lazy-load dependencies (only on state-file path)
    var fs = require('fs');
    var path = require('path');
    var yaml = require('js-yaml');
    var schema = require('./lib/state-schema');
    var fsm = require('./lib/fsm');
    var gateChecks = require('./lib/gate-checks');
    var denialTracker = require('./lib/denial-tracker');

    var content = input.tool_input.content;
    var parsed;
    try {
      parsed = yaml.load(content);
    } catch (yamlErr) {
      // YAML parse failure -- deny
      deny('Invalid YAML in state file: ' + yamlErr.message);
      return;
    }

    // Run the appropriate schema validator
    var result = schema[matchedValidator](parsed);

    if (!result.valid) {
      deny('State validation failed: ' + result.errors.join('; ') +
        '. Fix the data to match the schema and retry the write.' +
        ' To bypass enforcement entirely, set EXPEDITE_HOOKS_DISABLED=true.');
      return;
    }

    // Schema valid -- now run enforcement layers based on file type
    var expediteDir = path.dirname(filePath);

    // ---- HOOK-01 + HOOK-02: FSM transition + gate passage (state.yml) ----
    if (matchedValidator === 'validateStateYml' && parsed.phase) {
      var currentStatePath = path.join(expediteDir, 'state.yml');

      try {
        var currentRaw = fs.readFileSync(currentStatePath, 'utf8');
        var currentState = yaml.load(currentRaw);

        if (currentState && currentState.phase && currentState.phase !== parsed.phase) {
          // Phase transition detected -- validate against FSM
          var transition = fsm.validateTransition(currentState.phase, parsed.phase);

          if (!transition.valid) {
            // HOOK-01: Block invalid transition with specific message
            var fsmPattern = 'fsm:' + currentState.phase + ':' + parsed.phase;
            var fsmCount = denialTracker.recordDenial(expediteDir, fsmPattern);
            var fsmReason = 'State write blocked: ' + transition.error +
              ' To bypass enforcement entirely, set EXPEDITE_HOOKS_DISABLED=true.';
            if (fsmCount >= denialTracker.ESCALATION_THRESHOLD) {
              fsmReason += '\n\nThis denial has occurred ' + fsmCount + ' times. ' +
                'Consider manual intervention: edit .expedite/state.yml directly, ' +
                'or set EXPEDITE_HOOKS_DISABLED=true to bypass all enforcement.';
            }
            deny(fsmReason);
            return;
          }

          // If gate is required, check gates.yml for passage
          if (transition.gate) {
            var gatesPath = path.join(expediteDir, 'gates.yml');
            try {
              var gatesRaw = fs.readFileSync(gatesPath, 'utf8');
              var gatesObj = yaml.load(gatesRaw);
              var passage = gateChecks.checkGatePassage(transition.gate, gatesObj);

              if (!passage.passed) {
                // HOOK-02: Block _complete advance without gate passage
                var gatePattern = 'gate:' + transition.gate + ':' + parsed.phase;
                var gateCount = denialTracker.recordDenial(expediteDir, gatePattern);
                var gateReason = 'State write blocked: cannot advance to ' + parsed.phase +
                  ' -- ' + transition.gate + ' has not passed. ' + passage.status + '.\n\n' +
                  'To override: Write gates.yml with a new history entry: ' +
                  '{gate: "' + transition.gate + '", timestamp: "<ISO 8601>", outcome: "overridden", ' +
                  'override_reason: "<your justification>", severity: "<low|medium|high>"}. ' +
                  'Then immediately retry this exact Write to state.yml.';
                if (gateCount >= denialTracker.ESCALATION_THRESHOLD) {
                  gateReason += '\n\nThis denial has occurred ' + gateCount + ' times. ' +
                    'Consider manual intervention: edit .expedite/state.yml directly, ' +
                    'or set EXPEDITE_HOOKS_DISABLED=true to bypass all enforcement.';
                }
                deny(gateReason);
                return;
              }
            } catch (gatesErr) {
              // gates.yml doesn't exist or can't be read -- gate hasn't passed
              var noGatePattern = 'gate:' + transition.gate + ':' + parsed.phase;
              var noGateCount = denialTracker.recordDenial(expediteDir, noGatePattern);
              var noGateReason = 'State write blocked: cannot advance to ' + parsed.phase +
                ' -- ' + transition.gate + ' has not passed. No gates.yml found.\n\n' +
                'To override: Write gates.yml with a new history entry: ' +
                '{gate: "' + transition.gate + '", timestamp: "<ISO 8601>", outcome: "overridden", ' +
                'override_reason: "<your justification>", severity: "<low|medium|high>"}. ' +
                'Then immediately retry this exact Write to state.yml.';
              if (noGateCount >= denialTracker.ESCALATION_THRESHOLD) {
                noGateReason += '\n\nThis denial has occurred ' + noGateCount + ' times. ' +
                  'Consider manual intervention: edit .expedite/state.yml directly, ' +
                  'or set EXPEDITE_HOOKS_DISABLED=true to bypass all enforcement.';
              }
              deny(noGateReason);
              return;
            }
          }
        }
      } catch (diskErr) {
        // Current state.yml doesn't exist (new lifecycle) -- skip FSM check
        // This is expected for the first write of a new lifecycle
      }
    }

    // ---- HOOK-03: Checkpoint step regression guard (checkpoint.yml) ----
    if (matchedValidator === 'validateCheckpointYml' && parsed.step !== null && parsed.step !== undefined) {
      var currentCheckpointPath = path.join(expediteDir, 'checkpoint.yml');

      try {
        var currentCpRaw = fs.readFileSync(currentCheckpointPath, 'utf8');
        var currentCp = yaml.load(currentCpRaw);

        if (currentCp && typeof currentCp.step === 'number' && typeof parsed.step === 'number') {
          if (parsed.step < currentCp.step) {
            // Step regression detected -- check inputs_hash
            var currentHash = currentCp.inputs_hash || null;
            var proposedHash = parsed.inputs_hash || null;

            if (currentHash === proposedHash) {
              // HOOK-03: Block regression when inputs haven't changed
              var cpPattern = 'checkpoint:' + parsed.step;
              var cpCount = denialTracker.recordDenial(expediteDir, cpPattern);
              var cpReason = 'Checkpoint write blocked: step regression from ' + currentCp.step +
                ' to ' + parsed.step + ' is not allowed when inputs_hash has not changed. ' +
                'If inputs have changed, update the inputs_hash field.' +
                ' To bypass enforcement entirely, set EXPEDITE_HOOKS_DISABLED=true.';
              if (cpCount >= denialTracker.ESCALATION_THRESHOLD) {
                cpReason += '\n\nThis denial has occurred ' + cpCount + ' times. ' +
                  'Consider manual intervention: edit .expedite/checkpoint.yml directly, ' +
                  'or set EXPEDITE_HOOKS_DISABLED=true to bypass all enforcement.';
              }
              deny(cpReason);
              return;
            }
            // inputs_hash differs -- allow regression (changed inputs justify re-execution)
          }
        }
      } catch (cpErr) {
        // No current checkpoint on disk -- skip regression check
      }
    }

    // ---- HOOK-04: Gate-phase structural validation (gates.yml) ----
    if (matchedValidator === 'validateGatesYml' && parsed.history && Array.isArray(parsed.history)) {
      var statePath = path.join(expediteDir, 'state.yml');

      try {
        var stateRaw = fs.readFileSync(statePath, 'utf8');
        var stateObj = yaml.load(stateRaw);

        if (stateObj && stateObj.phase) {
          // Determine how many entries already exist on disk (to only validate new entries)
          var currentGatesPath = path.join(expediteDir, 'gates.yml');
          var existingCount = 0;
          try {
            var currentGatesRaw = fs.readFileSync(currentGatesPath, 'utf8');
            var currentGates = yaml.load(currentGatesRaw);
            existingCount = (currentGates && Array.isArray(currentGates.history)) ? currentGates.history.length : 0;
          } catch (e) {
            existingCount = 0;
          }

          // Truncation check: proposed content must not have fewer entries than existing
          if (parsed.history.length < existingCount) {
            deny('Gate write blocked: proposed gates.yml has fewer entries (' + parsed.history.length +
              ') than existing (' + existingCount + '). Gate history is append-only.' +
              ' To bypass enforcement entirely, set EXPEDITE_HOOKS_DISABLED=true.');
            return;
          }

          // Verify existing entries are unchanged (immutability enforcement)
          for (var ei = 0; ei < existingCount; ei++) {
            if (JSON.stringify(currentGates.history[ei]) !== JSON.stringify(parsed.history[ei])) {
              deny('Gate write blocked: existing history entry at index ' + ei +
                ' was modified. Gate history is append-only and immutable.' +
                ' To fix gate history, use the recovery procedure in ref-state-recovery.md.' +
                ' To bypass enforcement entirely, set EXPEDITE_HOOKS_DISABLED=true.');
              return;
            }
          }

          // Only validate entries beyond the existing count (new entries)
          for (var gi = existingCount; gi < parsed.history.length; gi++) {
            var entry = parsed.history[gi];
            if (entry && entry.gate) {
              // OVRD-03: Override records bypass gate-phase validation (prevents deadlock)
              if (entry.outcome === 'overridden') {
                continue;
              }
              var phaseCheck = gateChecks.validateGateForPhase(entry.gate, stateObj.phase);
              if (!phaseCheck.valid) {
                var gpPattern = 'gatephase:' + entry.gate + ':' + stateObj.phase;
                var gpCount = denialTracker.recordDenial(expediteDir, gpPattern);
                var gpReason = 'Gate write blocked: ' + phaseCheck.error + '. Current phase: ' + stateObj.phase +
                  ' To bypass enforcement entirely, set EXPEDITE_HOOKS_DISABLED=true.';
                if (gpCount >= denialTracker.ESCALATION_THRESHOLD) {
                  gpReason += '\n\nThis denial has occurred ' + gpCount + ' times. ' +
                    'Consider manual intervention: edit .expedite/state.yml directly, ' +
                    'or set EXPEDITE_HOOKS_DISABLED=true to bypass all enforcement.';
                }
                deny(gpReason);
                return;
              }
            }
          }
        }
      } catch (stateErr) {
        // Can't read state.yml -- skip phase context check (fail open)
      }
    }

    // All enforcement layers passed
    process.exit(0);
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
