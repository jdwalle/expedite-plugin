'use strict';

var validate = require('../validate');
var validateFields = validate.validateFields;
var validateArrayItems = validate.validateArrayItems;

var VALID_TASK_STATUSES = [
  'pending',
  'in_progress',
  'complete',
  'blocked',
  'skipped',
  'failed',
  'partial',
];

var schema = {
  required: ['tasks'],
  fields: {
    current_wave: { type: 'number' },
    current_task: { type: 'string' },
    tasks: { type: 'array' },
  },
  itemSchema: {
    required: ['id', 'title', 'status'],
    fields: {
      id: { type: 'string' },
      title: { type: 'string' },
      status: { type: 'string', enum: VALID_TASK_STATUSES },
      wave: { type: 'number' },
      assigned_agent: { type: 'string' },
    },
  },
};

function validateTasksYml(obj) {
  var errors = validateFields(obj, schema, '');

  if (obj && Array.isArray(obj.tasks) && obj.tasks.length > 0) {
    errors = errors.concat(validateArrayItems(obj.tasks, schema.itemSchema, 'tasks'));
  }

  return { valid: errors.length === 0, errors: errors };
}

module.exports = { schema: schema, validateTasksYml: validateTasksYml, VALID_TASK_STATUSES: VALID_TASK_STATUSES };
