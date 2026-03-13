'use strict';

var validateFields = require('../validate').validateFields;

var schema = {
  required: [],
  requiredWhenPopulated: ['skill', 'step', 'label'],
  fields: {
    skill: { type: 'string', nullable: true },
    step: { type: ['number', 'string'], nullable: true },
    label: { type: 'string', nullable: true },
    substep: { type: 'string', nullable: true },
    continuation_notes: { type: 'string', nullable: true },
    inputs_hash: { type: 'string', nullable: true },
    updated_at: { type: 'string', nullable: true },
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
