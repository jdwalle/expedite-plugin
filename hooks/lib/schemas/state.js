'use strict';

var validateFields = require('../validate').validateFields;

var VALID_PHASES = [
  'not_started',
  'scope_in_progress',
  'scope_complete',
  'research_in_progress',
  'research_complete',
  'design_in_progress',
  'design_complete',
  'plan_in_progress',
  'plan_complete',
  'spike_in_progress',
  'spike_complete',
  'execute_in_progress',
  'execute_complete',
  'complete',
  'archived',
];

var schema = {
  required: ['version', 'phase'],
  fields: {
    version: { type: 'number' },
    lifecycle_id: { type: 'string' },
    project_name: { type: 'string' },
    intent: { type: 'string', enum: ['product', 'engineering'] },
    description: { type: 'string' },
    phase: { type: 'string', enum: VALID_PHASES },
    started_at: { type: 'string' },
    phase_started_at: { type: 'string' },
    last_modified: { type: 'string' },
  },
};

function validateStateYml(obj) {
  var errors = validateFields(obj, schema, '');

  if (obj && obj.version !== undefined && obj.version !== null && typeof obj.version !== 'number') {
    errors.push('version must be a number');
  }

  return { valid: errors.length === 0, errors: errors };
}

module.exports = { schema: schema, validateStateYml: validateStateYml, VALID_PHASES: VALID_PHASES };
