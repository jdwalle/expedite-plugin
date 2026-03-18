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
    lifecycle_id: { type: 'string', nullable: true },
    project_name: { type: 'string', nullable: true },
    intent: { type: 'string', nullable: true, enum: ['product', 'engineering'] },
    description: { type: 'string', nullable: true },
    phase: { type: 'string', enum: VALID_PHASES },
    started_at: { type: 'string', nullable: true },
    phase_started_at: { type: 'string', nullable: true },
    last_modified: { type: 'string', nullable: true },
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
