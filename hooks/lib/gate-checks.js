'use strict';

// Gate passage checking (HOOK-02) and gate-phase validation (HOOK-04).
// These functions receive already-parsed data -- they do NOT read from disk.

/**
 * Maps each gate to the lifecycle phases where it can legitimately be evaluated/written.
 */
var GATE_PHASE_MAP = {
  'G1': ['scope_in_progress', 'scope_complete'],
  'G2': ['research_in_progress', 'research_complete'],
  'G3': ['design_in_progress', 'design_complete'],
  'G4': ['plan_in_progress', 'plan_complete'],
  'G5': ['spike_in_progress', 'spike_complete'],
};

/**
 * Gate outcomes that count as "passed" (transition is allowed).
 */
var PASSING_OUTCOMES = ['go', 'go_advisory', 'overridden'];

/**
 * Check if a passing gate result exists in the gates.yml history.
 *
 * @param {string} gateId - Gate identifier (e.g., 'G1')
 * @param {object|null} gatesYmlObj - Parsed gates.yml content with history[] array
 * @returns {{ passed: boolean, status: string, outcome?: string }}
 */
function checkGatePassage(gateId, gatesYmlObj) {
  if (!gatesYmlObj || !Array.isArray(gatesYmlObj.history)) {
    return {
      passed: false,
      status: 'no gate history found in gates.yml',
    };
  }

  // Find all entries for this gate
  var matching = gatesYmlObj.history.filter(function (entry) {
    return entry.gate === gateId;
  });

  if (matching.length === 0) {
    return {
      passed: false,
      status: 'no ' + gateId + ' entry in gates.yml',
    };
  }

  // Use the last (most recent) entry
  var latest = matching[matching.length - 1];

  if (PASSING_OUTCOMES.indexOf(latest.outcome) !== -1) {
    return {
      passed: true,
      status: gateId + ' passed with outcome: ' + latest.outcome,
      outcome: latest.outcome,
    };
  }

  return {
    passed: false,
    status: gateId + ' latest result is "' + latest.outcome + '" (not a passing outcome)',
  };
}

/**
 * Check if writing a gate result for gateId is valid during currentPhase.
 *
 * @param {string} gateId - Gate identifier (e.g., 'G1')
 * @param {string} currentPhase - Current lifecycle phase string
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateGateForPhase(gateId, currentPhase) {
  var allowedPhases = GATE_PHASE_MAP[gateId];

  if (!allowedPhases) {
    return {
      valid: false,
      error: 'Unknown gate ID: ' + gateId + '. Valid gates: ' + Object.keys(GATE_PHASE_MAP).join(', '),
    };
  }

  if (allowedPhases.indexOf(currentPhase) === -1) {
    return {
      valid: false,
      error: 'Cannot write ' + gateId + ' result during ' + currentPhase +
             '. ' + gateId + ' is valid during: ' + allowedPhases.join(', '),
    };
  }

  return { valid: true, error: null };
}

module.exports = {
  checkGatePassage: checkGatePassage,
  validateGateForPhase: validateGateForPhase,
  GATE_PHASE_MAP: GATE_PHASE_MAP,
  PASSING_OUTCOMES: PASSING_OUTCOMES,
};
