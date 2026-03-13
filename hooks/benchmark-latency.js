#!/usr/bin/env node
'use strict';

// ============================================================================
// Hook Latency Benchmark
// ============================================================================
// Simulates 100 PreToolUse invocations (50 non-state passthrough, 50 state
// validation) and measures p50/p99 latency for each category.
// ============================================================================

var childProcess = require('child_process');
var path = require('path');

var HOOK_SCRIPT = path.join(__dirname, 'validate-state-write.js');

var NON_STATE_PAYLOAD = JSON.stringify({
  tool_name: 'Write',
  tool_input: {
    file_path: '/tmp/test/foo.txt',
    content: 'hello world',
  },
});

var VALID_STATE_PAYLOAD = JSON.stringify({
  tool_name: 'Write',
  tool_input: {
    file_path: '/project/.expedite/state.yml',
    content: 'version: 2\nproject_name: benchmark\nphase: scope_in_progress\n',
  },
});

function measureInvocation(payload) {
  return new Promise(function (resolve) {
    var start = process.hrtime.bigint();
    var child = childProcess.spawn('node', [HOOK_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    child.stdin.write(payload);
    child.stdin.end();

    child.on('close', function () {
      var elapsed = Number(process.hrtime.bigint() - start) / 1e6; // ms
      resolve(elapsed);
    });

    child.on('error', function () {
      var elapsed = Number(process.hrtime.bigint() - start) / 1e6;
      resolve(elapsed);
    });
  });
}

function percentile(arr, p) {
  var sorted = arr.slice().sort(function (a, b) { return a - b; });
  var idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runBenchmark(label, payload, count) {
  var timings = [];
  for (var i = 0; i < count; i++) {
    var elapsed = await measureInvocation(payload);
    timings.push(elapsed);
  }
  var p50 = percentile(timings, 50);
  var p99 = percentile(timings, 99);
  console.log(label + ':');
  console.log('  Invocations: ' + count);
  console.log('  p50: ' + p50.toFixed(2) + 'ms');
  console.log('  p99: ' + p99.toFixed(2) + 'ms');
  console.log('  p99 under 300ms: ' + (p99 < 300 ? 'PASS' : 'FAIL'));
  return { label: label, p50: p50, p99: p99, pass: p99 < 300 };
}

async function main() {
  console.log('Hook Latency Benchmark');
  console.log('======================\n');

  var nonState = await runBenchmark('Non-state passthrough', NON_STATE_PAYLOAD, 50);
  console.log('');
  var stateValidation = await runBenchmark('State validation', VALID_STATE_PAYLOAD, 50);
  console.log('');

  var allPass = nonState.pass && stateValidation.pass;
  console.log('Overall: ' + (allPass ? 'PASS' : 'FAIL') + ' (p99 < 300ms requirement)');
  process.exit(allPass ? 0 : 1);
}

main();
