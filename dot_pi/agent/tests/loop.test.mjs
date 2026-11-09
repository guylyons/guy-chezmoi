import assert from 'node:assert/strict';
import { test } from 'node:test';
import loop, { parseArgs, parseDuration, formatDuration } from '../extensions/loop.ts';

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const handlers = new Map(), sent = [], notes = [], statuses = [];
  let command, tool, active = ['read', 'bash'], idle = true;
  loop({
    on: (e, h) => handlers.set(e, h),
    registerCommand: (_n, c) => { command = c; },
    registerTool: d => { tool = d; },
    getActiveTools: () => active,
    setActiveTools: a => { active = a; },
    sendUserMessage: (m, o) => { sent.push([m, o]); idle = false; },
  });
  const ctx = {
    hasUI: true,
    isIdle: () => idle,
    ui: { notify: (m, l) => notes.push([m, l]), setStatus: (k, v) => statuses.push(v) },
  };
  const settle = () => { idle = true; handlers.get('agent_settled')({}, ctx); };
  return {
    run: args => command.handler(args, ctx), settle, sent, notes, statuses, tool,
    active: () => active, emit: e => handlers.get(e)({}, ctx), busy: () => { idle = false; },
  };
}

test('parses intervals in front, "every …" behind, or none', () => {
  assert.deepEqual(parseArgs('5m /review'), { interval: 300e3, prompt: '/review' });
  assert.deepEqual(parseArgs('check the deploy every 2 hours'), { interval: 7200e3, prompt: 'check the deploy' });
  assert.deepEqual(parseArgs('watch CI until green'), { interval: null, prompt: 'watch CI until green' });
  assert.deepEqual(parseArgs('1s ping'), { interval: 10e3, prompt: 'ping' });
  assert.equal(parseDuration('90s'), 90e3);
  assert.equal(parseDuration('later'), null);
  assert.equal(formatDuration(300e3), '5m');
  assert.equal(formatDuration(7200e3), '2h');
});

test('fixed interval: runs now, then on schedule, waiting while busy', t => {
  const l = setup(t);
  l.run('5m /review');
  assert.deepEqual(l.sent, [['/review', { expandPromptTemplates: true }]]);
  l.settle();
  t.mock.timers.tick(300e3);
  assert.equal(l.sent.length, 2);
  // Due while still busy: sent once Pi settles.
  t.mock.timers.tick(300e3);
  assert.equal(l.sent.length, 2);
  l.settle();
  assert.equal(l.sent.length, 3);
  l.settle();
  l.run('stop');
  t.mock.timers.tick(3600e3);
  assert.equal(l.sent.length, 3);
  assert.equal(l.statuses.at(-1), undefined);
});

test('self-paced: the tool schedules the next run; no call ends the loop', async t => {
  const l = setup(t);
  l.run('watch CI');
  assert.ok(l.active().includes('loop_schedule'));
  await l.tool.execute('1', { delaySeconds: 5 });
  l.settle();
  t.mock.timers.tick(59e3);
  assert.equal(l.sent.length, 1);
  t.mock.timers.tick(1e3); // clamped to 60s
  assert.equal(l.sent.length, 2);
  l.settle(); // no schedule call
  assert.ok(!l.active().includes('loop_schedule'));
  assert.match(l.notes.at(-1)[0], /didn't schedule/);
  t.mock.timers.tick(3600e3);
  assert.equal(l.sent.length, 2);
});

test('self-paced stop, and a session change ends any loop', async t => {
  const l = setup(t);
  l.run('watch CI');
  await l.tool.execute('1', { stop: true, reason: 'CI is green' });
  l.settle();
  assert.match(l.notes.at(-1)[0], /CI is green/);
  l.run('1m ping');
  l.settle();
  l.emit('session_start');
  t.mock.timers.tick(600e3);
  assert.equal(l.sent.length, 2);
});

test('a user turn between runs is not counted as a loop run', async t => {
  const l = setup(t);
  l.run('watch CI');
  await l.tool.execute('1', { delaySeconds: 120 });
  l.settle();
  l.busy(); l.settle(); // the user's own message settles
  t.mock.timers.tick(120e3);
  assert.equal(l.sent.length, 2);
});

test('expires after seven days', t => {
  const l = setup(t);
  l.run('1d ping');
  for (let i = 0; i < 8; i++) { l.settle(); t.mock.timers.tick(86400e3); }
  assert.equal(l.sent.length, 7);
  assert.match(l.notes.at(-1)[0], /7 days/);
});
