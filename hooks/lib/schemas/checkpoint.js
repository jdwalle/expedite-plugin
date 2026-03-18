'use strict';

var validateFields = require('../validate').validateFields;

var schema = {
  required: [],
  requiredWhenPopulated: ['skill', 'step', 'label'],
  fields: {
    skill: { type: 'string' },
    step: { type: ['number', 'string'] },
    label: { type: 'string' },
    substep: { type: 'string' },
    continuation_notes: { type: 'string' },
    inputs_hash: { type: 'string' },
    updated_at: { type: 'string' },
  },
};

function validateCheckpointYml(obj) {
  var errors = validateFields(obj, schema, '');

  if (obj && obj.step !== undefined && obj.step !== null) {
    if (typeof obj.step === 'number' && (obj.step < 1 || !Number.isInteger(obj.step))) {
      errors.push('step must be a positive integer or "complete"');
    }
    if (typeof obj.step === 'string' && obj.step !== 'complete') {
      errors.push('step must be a positive integer or "complete", got "' + obj.step + '"');
    }
  }

  return { valid: errors.length === 0, errors: errors };
}

module.exports = { schema: schema, validateCheckpointYml: validateCheckpointYml };
