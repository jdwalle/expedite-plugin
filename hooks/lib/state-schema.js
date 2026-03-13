'use strict';

// ============================================================================
// Expedite State File Schemas and Validators
// ============================================================================
// Validates parsed YAML objects for the 5-file state split.
// Each validator returns { valid: boolean, errors: string[] }.
// No dependencies -- receives already-parsed objects.
// ============================================================================

// --- Schema Definitions ---

const VALID_PHASES = [
  'scope_in_progress',
  'scope_complete',
  'research_in_progress',
  'research_complete',
  'design_in_progress',
  'design_complete',
  'plan_in_progress',
  'plan_complete',
  'execute_in_progress',
  'complete',
  'archived',
];

const VALID_QUESTION_STATUSES = [
  'pending',
  'covered',
  'partial',
  'not_covered',
  'unavailable_source',
];

const VALID_QUESTION_PRIORITIES = ['P0', 'P1', 'P2'];

const VALID_GATE_IDS = ['G1', 'G2', 'G3', 'G4', 'G5'];

const VALID_GATE_OUTCOMES = [
  'go',
  'no-go',
  'go-with-advisory',
  'go_advisory',
  'overridden',
];

const VALID_TASK_STATUSES = [
  'pending',
  'in_progress',
  'complete',
  'blocked',
  'skipped',
  'failed',
  'partial',
];

const schemas = {
  stateYml: {
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
    },
  },
  checkpointYml: {
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
  },
  questionsYml: {
    required: ['questions'],
    fields: {
      research_round: { type: 'number', nullable: true },
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
        gap_details: { type: 'string', nullable: true },
        evidence_files: { type: 'array' },
      },
    },
  },
  gatesYml: {
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
  },
  tasksYml: {
    required: ['tasks'],
    fields: {
      current_wave: { type: 'number', nullable: true },
      current_task: { type: 'string', nullable: true },
      tasks: { type: 'array' },
    },
    itemSchema: {
      required: ['id', 'title', 'status'],
      fields: {
        id: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'string', enum: VALID_TASK_STATUSES },
        wave: { type: 'number', nullable: true },
        assigned_agent: { type: 'string', nullable: true },
      },
    },
  },
};

// --- Validation Helpers ---

function checkType(value, expectedType) {
  if (Array.isArray(expectedType)) {
    return expectedType.some(function (t) { return checkType(value, t); });
  }
  if (expectedType === 'array') return Array.isArray(value);
  if (expectedType === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value);
  return typeof value === expectedType;
}

function validateFields(obj, schema, prefix) {
  var errors = [];
  if (!obj || typeof obj !== 'object') {
    errors.push((prefix ? prefix + ': ' : '') + 'expected an object, got ' + typeof obj);
    return errors;
  }

  // Check required fields
  if (schema.required) {
    schema.required.forEach(function (field) {
      if (obj[field] === undefined || obj[field] === null) {
        errors.push((prefix ? prefix + '.' : '') + field + ' is required');
      }
    });
  }

  // Check requiredWhenPopulated: if any of these fields are non-null, all must be non-null
  if (schema.requiredWhenPopulated) {
    var hasAnyPopulated = schema.requiredWhenPopulated.some(function (field) {
      return obj[field] !== undefined && obj[field] !== null;
    });
    if (hasAnyPopulated) {
      schema.requiredWhenPopulated.forEach(function (field) {
        if (obj[field] === undefined || obj[field] === null) {
          errors.push((prefix ? prefix + '.' : '') + field + ' is required when checkpoint is populated');
        }
      });
    }
  }

  // Check field types and enums
  if (schema.fields) {
    Object.keys(schema.fields).forEach(function (field) {
      var spec = schema.fields[field];
      var value = obj[field];

      if (value === undefined || value === null) {
        // null/undefined is ok if nullable or not required
        return;
      }

      // Type check
      if (spec.type && !checkType(value, spec.type)) {
        errors.push(
          (prefix ? prefix + '.' : '') + field +
          ' must be type ' + (Array.isArray(spec.type) ? spec.type.join('|') : spec.type) +
          ', got ' + typeof value
        );
        return;
      }

      // Enum check
      if (spec.enum && spec.enum.indexOf(value) === -1) {
        errors.push(
          (prefix ? prefix + '.' : '') + field +
          ' must be one of [' + spec.enum.join(', ') + '], got "' + value + '"'
        );
      }
    });
  }

  return errors;
}

function validateArrayItems(arr, itemSchema, arrayName) {
  var errors = [];
  if (!Array.isArray(arr)) return errors;

  arr.forEach(function (item, index) {
    var itemErrors = validateFields(item, { required: itemSchema.required, fields: itemSchema.fields }, arrayName + '[' + index + ']');
    errors = errors.concat(itemErrors);
  });

  return errors;
}

// --- Validator Functions ---

function validateStateYml(obj) {
  var errors = validateFields(obj, schemas.stateYml, '');

  // Additional validation: step must be positive integer for checkpoint context
  if (obj && obj.version !== undefined && obj.version !== null && typeof obj.version !== 'number') {
    errors.push('version must be a number');
  }

  return { valid: errors.length === 0, errors: errors };
}

function validateCheckpointYml(obj) {
  var errors = validateFields(obj, schemas.checkpointYml, '');

  // Additional validation: step must be positive integer or "complete"
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

function validateQuestionsYml(obj) {
  var errors = validateFields(obj, schemas.questionsYml, '');

  // Validate individual question items
  if (obj && Array.isArray(obj.questions) && obj.questions.length > 0) {
    errors = errors.concat(validateArrayItems(obj.questions, schemas.questionsYml.itemSchema, 'questions'));
  }

  return { valid: errors.length === 0, errors: errors };
}

function validateGatesYml(obj) {
  var errors = validateFields(obj, schemas.gatesYml, '');

  // Validate individual gate entries
  if (obj && Array.isArray(obj.history) && obj.history.length > 0) {
    errors = errors.concat(validateArrayItems(obj.history, schemas.gatesYml.itemSchema, 'history'));

    // Check override_reason requirement
    obj.history.forEach(function (entry, index) {
      if (entry.outcome === 'overridden' && (!entry.override_reason || typeof entry.override_reason !== 'string')) {
        errors.push('history[' + index + '].override_reason is required when outcome is "overridden"');
      }
    });
  }

  return { valid: errors.length === 0, errors: errors };
}

function validateTasksYml(obj) {
  var errors = validateFields(obj, schemas.tasksYml, '');

  // Validate individual task entries
  if (obj && Array.isArray(obj.tasks) && obj.tasks.length > 0) {
    errors = errors.concat(validateArrayItems(obj.tasks, schemas.tasksYml.itemSchema, 'tasks'));
  }

  return { valid: errors.length === 0, errors: errors };
}

// --- Exports ---

module.exports = {
  validateStateYml: validateStateYml,
  validateCheckpointYml: validateCheckpointYml,
  validateQuestionsYml: validateQuestionsYml,
  validateGatesYml: validateGatesYml,
  validateTasksYml: validateTasksYml,
  schemas: schemas,
};
