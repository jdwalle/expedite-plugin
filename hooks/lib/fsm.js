'use strict';

// Finite State Machine: valid lifecycle phase transitions.
// Any transition not in this table is structurally impossible.
// Gate field: if non-null, gates.yml must contain a passing result before this transition is allowed.

var TRANSITIONS = {
  'not_started':            { to: 'scope_in_progress',    gate: null },
  'scope_in_progress':      { to: 'scope_complete',       gate: 'G1' },
  'scope_complete':         { to: 'research_in_progress', gate: null },
  'research_in_progress':   { to: 'research_complete',    gate: 'G2' },
  'research_complete':      { to: 'design_in_progress',   gate: null },
  'design_in_progress':     { to: 'design_complete',      gate: 'G3' },
  'design_complete':        { to: 'plan_in_progress',     gate: null },
  'plan_in_progress':       { to: 'plan_complete',        gate: 'G4' },
  'plan_complete':          { to: 'spike_in_progress',    gate: null },
  'spike_in_progress':      { to: 'spike_complete',       gate: 'G5' },
  'spike_complete':         { to: 'execute_in_progress',  gate: null },
  'execute_in_progress':    { to: 'execute_complete',     gate: null },
  'execute_complete':       { to: 'complete',             gate: null },
  'complete':               { to: 'archived',             gate: null },
};

/**
 * Validate whether a phase transition is allowed by the FSM.
 *
 * @param {string} fromPhase - Current lifecycle phase
 * @param {string} toPhase - Requested next phase
 * @returns {{ valid: boolean, gate: string|null, error?: string, validTransitions?: string[] }}
 */
function validateTransition(fromPhase, toPhase) {
  // Same phase (no transition) is always allowed
  if (fromPhase === toPhase) {
    return { valid: true, gate: null };
  }

  var rule = TRANSITIONS[fromPhase];
  if (!rule) {
    return {
      valid: false,
      gate: null,
      error: 'No transitions defined from "' + fromPhase + '"',
      validTransitions: [],
    };
  }

  if (rule.to !== toPhase) {
    return {
      valid: false,
      gate: null,
      error: 'Invalid phase transition: ' + fromPhase + ' cannot transition to ' + toPhase +
             '. Valid next phase: ' + rule.to + (rule.gate ? ' (requires ' + rule.gate + ' passage)' : ''),
      validTransitions: [rule.to],
    };
  }

  // Valid transition -- return gate requirement (may be null)
  return {
    valid: true,
    gate: rule.gate,
  };
}

module.exports = { TRANSITIONS: TRANSITIONS, validateTransition: validateTransition };
