'use strict';

// Barrel re-export: all 5 domain validators from a single require().
// Consumers (validate-state-write.js, tests) can keep doing:
//   const s = require('./lib/state-schema');
//   s.validateStateYml(parsed);

var state = require('./schemas/state');
var checkpoint = require('./schemas/checkpoint');
var questions = require('./schemas/questions');
var gates = require('./schemas/gates');
var tasks = require('./schemas/tasks');

module.exports = {
  validateStateYml: state.validateStateYml,
  validateCheckpointYml: checkpoint.validateCheckpointYml,
  validateQuestionsYml: questions.validateQuestionsYml,
  validateGatesYml: gates.validateGatesYml,
  validateTasksYml: tasks.validateTasksYml,
  schemas: {
    stateYml: state.schema,
    checkpointYml: checkpoint.schema,
    questionsYml: questions.schema,
    gatesYml: gates.schema,
    tasksYml: tasks.schema,
  },
};
