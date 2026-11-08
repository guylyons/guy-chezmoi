import assert from 'node:assert/strict';
import { test } from 'node:test';
import spinner from '../extensions/titlebar-spinner.ts';

function setup(t, mode = 'tui') {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const handlers = new Map(), titles = [];
  let name;
  spinner({ on: (event, handler) => handlers.set(event, handler), getSessionName: () => name });
  const ctx = { mode, cwd: '/work/fred', ui: { setTitle: title => titles.push(title) } };
  const emit = event => handlers.get(event)?.({}, ctx);
  return { emit, titles, ctx, rename: value => { name = value; emit('session_info_changed'); } };
}

test('animates during work, restores idle title and stops ticking', t => {
  const { emit, titles } = setup(t);
  emit('session_start');
  assert.equal(titles.at(-1), 'π - fred');
  emit('agent_start');
  assert.equal(titles.at(-1), '⠋ π - fred');
  t.mock.timers.tick(100);
  assert.equal(titles.at(-1), '⠙ π - fred');
  emit('agent_settled');
  assert.equal(titles.at(-1), 'π - fred');
  const n = titles.length;
  t.mock.timers.tick(1000);
  assert.equal(titles.length, n);
});

test('continues through agent_end and repeated starts without duplicate timers', t => {
  const { emit, titles } = setup(t);
  emit('agent_start'); emit('agent_end'); emit('agent_start');
  t.mock.timers.tick(100);
  assert.deepEqual(titles, ['⠋ π - fred', '⠙ π - fred']);
  emit('session_shutdown');
});

test('shutdown/reload cleans up and a new run restarts from first frame', t => {
  const { emit, titles } = setup(t);
  emit('agent_start'); emit('session_shutdown'); emit('session_shutdown');
  const n = titles.length;
  t.mock.timers.tick(1000);
  assert.equal(titles.length, n);
  emit('session_start'); emit('agent_start');
  assert.equal(titles.at(-1), '⠋ π - fred');
  emit('agent_settled');
});

test('preserves renamed sessions and strips control characters', t => {
  const { emit, titles, rename } = setup(t);
  rename('Review');
  assert.equal(titles.at(-1), 'π - Review - fred');
  emit('agent_start'); rename('Review\x07\x1b');
  assert.equal(titles.at(-1), '⠋ π - Review - fred');
  emit('agent_settled');
  assert.equal(titles.at(-1), 'π - Review - fred');
});

for (const mode of ['print', 'json', 'rpc']) {
  test(`does not change titles in ${mode} mode`, t => {
    const { emit, titles } = setup(t, mode);
    for (const event of ['session_start', 'agent_start', 'session_info_changed', 'agent_settled', 'session_shutdown']) emit(event);
    t.mock.timers.tick(1000);
    assert.deepEqual(titles, []);
  });
}
