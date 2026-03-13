'use strict';

// Shared session summary generation for Stop and PreCompact hooks.
// Reads state from .expedite/ files and writes session-summary.md.

var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');

var SKILL_STEP_TOTALS = {
  scope: 10, research: 18, design: 10, plan: 9, spike: 9, execute: 7
};

var NEXT_SKILL = {
  scope_complete: 'research',
  research_complete: 'design',
  design_complete: 'plan',
  plan_complete: 'spike',
  spike_complete: 'execute',
  execute_complete: null
};

/**
 * Write session-summary.md to the given .expedite/ directory.
 * @param {string} expediteDir - Absolute path to .expedite/ directory
 * @returns {boolean} true if summary written, false if skipped
 */
function writeSummary(expediteDir) {
  // Read state.yml (required -- return false if missing or unparseable)
  var stateRaw;
  try {
    stateRaw = fs.readFileSync(path.join(expediteDir, 'state.yml'), 'utf8');
  } catch (e) {
    return false;
  }

  var state;
  try {
    state = yaml.load(stateRaw);
  } catch (e) {
    return false;
  }

  if (!state || !state.phase) {
    return false;
  }

  // Read checkpoint.yml (optional -- use null defaults if missing)
  var checkpoint = null;
  try {
    var cpRaw = fs.readFileSync(path.join(expediteDir, 'checkpoint.yml'), 'utf8');
    checkpoint = yaml.load(cpRaw);
  } catch (e) {
    // No checkpoint -- use null defaults
  }

  // Build session summary markdown
  var lines = [];
  lines.push('# Session Summary');

  // Phase
  lines.push('- Phase: ' + state.phase);

  // Skill and Step
  var cpIsNull = !checkpoint || (checkpoint.skill === null && checkpoint.step === null);
  if (cpIsNull) {
    lines.push('- Skill: No active skill step');
  } else {
    var skill = checkpoint.skill || 'unknown';
    var step = checkpoint.step;
    var total = SKILL_STEP_TOTALS[skill] || '?';
    lines.push('- Skill: ' + skill + ', Step ' + step + ' of ' + total);
  }

  // Last action
  if (cpIsNull) {
    lines.push('- Last action: No checkpoint recorded');
  } else {
    var lastAction = checkpoint.label || 'Unknown';
    if (checkpoint.continuation_notes) {
      lastAction += ' -- ' + checkpoint.continuation_notes;
    }
    lines.push('- Last action: ' + lastAction);
  }

  // Next action
  if (cpIsNull) {
    lines.push('- Next action: Resume with /expedite:status to check position');
  } else {
    var phase = state.phase;
    var nextSkill = NEXT_SKILL[phase];
    if (phase.endsWith('_complete') && nextSkill !== undefined) {
      if (nextSkill === null) {
        lines.push('- Next action: Lifecycle complete');
      } else {
        lines.push('- Next action: Next: /expedite:' + nextSkill);
      }
    } else if (phase.endsWith('_in_progress') && typeof checkpoint.step === 'number') {
      lines.push('- Next action: Continue ' + checkpoint.skill + ' from step ' + checkpoint.step + ': ' + (checkpoint.label || ''));
    } else {
      lines.push('- Next action: Resume with /expedite:status to check position');
    }
  }

  // Critical state (optional)
  var criticalLines = [];

  // Check questions.yml
  try {
    var qRaw = fs.readFileSync(path.join(expediteDir, 'questions.yml'), 'utf8');
    var questions = yaml.load(qRaw);
    if (questions && Array.isArray(questions.questions)) {
      var totalQ = questions.questions.length;
      var answeredQ = 0;
      for (var i = 0; i < questions.questions.length; i++) {
        if (questions.questions[i].answer) {
          answeredQ++;
        }
      }
      criticalLines.push('questions.yml has ' + totalQ + ' questions, ' + answeredQ + ' answered');
    }
  } catch (e) {
    // No questions file -- skip
  }

  // Check tasks.yml
  try {
    var tRaw = fs.readFileSync(path.join(expediteDir, 'tasks.yml'), 'utf8');
    var tasks = yaml.load(tRaw);
    if (tasks && Array.isArray(tasks.tasks)) {
      var totalT = tasks.tasks.length;
      var completedT = 0;
      for (var j = 0; j < tasks.tasks.length; j++) {
        if (tasks.tasks[j].status === 'complete' || tasks.tasks[j].status === 'done') {
          completedT++;
        }
      }
      criticalLines.push('tasks.yml has ' + completedT + '/' + totalT + ' tasks complete');
    }
  } catch (e) {
    // No tasks file -- skip
  }

  if (criticalLines.length > 0) {
    lines.push('- Critical state: ' + criticalLines.join('; '));
  }

  // Write session-summary.md
  var summaryPath = path.join(expediteDir, 'session-summary.md');
  fs.writeFileSync(summaryPath, lines.join('\n') + '\n', 'utf8');
  return true;
}

module.exports = {
  SKILL_STEP_TOTALS: SKILL_STEP_TOTALS,
  NEXT_SKILL: NEXT_SKILL,
  writeSummary: writeSummary
};
