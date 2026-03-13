'use strict';

var validate = require('../validate');
var validateFields = validate.validateFields;
var validateArrayItems = validate.validateArrayItems;

var VALID_GATE_IDS = ['G1', 'G2', 'G3', 'G4', 'G5'];

var VALID_GATE_OUTCOMES = [
  'go',
  'no-go',
  'go-with-advisory',
  'go_advisory',
  'overridden',
];

var schema = {
  required: ['history'],
  fields: {
    history: { type: 'array' },
  },
  itemSchema: {
    required: ['gate', 'timestamp', 'outcome'],
    fields: {
      gate: { type: 'string', enum: VALID_GATE_IDS },
      timestamp: { type: 'string' },
      outcome: { type: 'string', enum: VALID_GATE_OUTCOMES },
      evaluator: { type: 'string', nullable: true },
      override_reason: { type: 'string', nullable: true },
      must_passed: { type: 'number', nullable: true },
      must_failed: { type: 'number', nullable: true },
      should_passed: { type: 'number', nullable: true },
      should_failed: { type: 'number', nullable: true },
      notes: { type: 'string', nullable: true },
      overridden: { type: 'boolean', nullable: true },
      structural_checks: { type: 'object', nullable: true },
      semantic_evaluation: { type: 'object', nullable: true },
    },
  },
};

function validateGatesYml(obj) {
  var errors = validateFields(obj, schema, '');

  if (obj && Array.isArray(obj.history) && obj.history.length > 0) {
    errors = errors.concat(validateArrayItems(obj.history, schema.itemSchema, 'history'));

    obj.history.forEach(function (entry, index) {
      if (entry.outcome === 'overridden' && (!entry.override_reason || typeof entry.override_reason !== 'string')) {
        errors.push('history[' + index + '].override_reason is required when outcome is "overridden"');
      }
    });
  }

  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  schema: schema,
  validateGatesYml: validateGatesYml,
  VALID_GATE_IDS: VALID_GATE_IDS,
  VALID_GATE_OUTCOMES: VALID_GATE_OUTCOMES,
};
