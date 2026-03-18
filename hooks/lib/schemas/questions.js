'use strict';

var validate = require('../validate');
var validateFields = validate.validateFields;
var validateArrayItems = validate.validateArrayItems;

var VALID_QUESTION_STATUSES = [
  'pending',
  'covered',
  'partial',
  'not_covered',
  'unavailable_source',
];

var VALID_QUESTION_PRIORITIES = ['P0', 'P1', 'P2'];

var schema = {
  required: ['questions'],
  fields: {
    research_round: { type: 'number' },
    questions: { type: 'array' },
  },
  itemSchema: {
    required: ['id', 'text', 'priority', 'decision_area', 'evidence_requirements', 'status', 'source'],
    fields: {
      id: { type: 'string' },
      text: { type: 'string' },
      priority: { type: 'string', enum: VALID_QUESTION_PRIORITIES },
      decision_area: { type: 'string' },
      source_hints: { type: 'array' },
      evidence_requirements: { type: 'string' },
      status: { type: 'string', enum: VALID_QUESTION_STATUSES },
      source: { type: 'string' },
      gap_details: { type: 'string' },
      evidence_files: { type: 'array' },
    },
  },
};

function validateQuestionsYml(obj) {
  var errors = validateFields(obj, schema, '');

  if (obj && Array.isArray(obj.questions) && obj.questions.length > 0) {
    errors = errors.concat(validateArrayItems(obj.questions, schema.itemSchema, 'questions'));
  }

  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  schema: schema,
  validateQuestionsYml: validateQuestionsYml,
  VALID_QUESTION_STATUSES: VALID_QUESTION_STATUSES,
  VALID_QUESTION_PRIORITIES: VALID_QUESTION_PRIORITIES,
};
