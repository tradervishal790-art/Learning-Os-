// Mentor "New chat" storage: save, list, reopen, delete, migrate the old single chat, sign-out wipe.
import test from 'node:test';
import assert from 'node:assert/strict';

async function loadStore() {
  const { build } = await import('esbuild');
  const { join, resolve } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const stubPlugin = {
    name: 'stub-firebase',
    setup(b) {
      b.onResolve({ filter: /^\.\/firebase$/ }, () => ({ path: 'firebase-stub', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const auth = globalThis.__auth;', loader: 'js' }));
    },
  };
  const outfile = join(process.cwd(), 'node_modules', '.cache', 'los-test', `chats${process.pid}_${Math.random().toString(36).slice(2)}.mjs`);
  await build({ entryPoints: [resolve('src/mentorChatStore.ts')], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent', plugins: [stubPlugin] });
  return import(pathToFileURL(outfile).href);
}

function freshEnv(uid = 'u1') {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  };
  // Object.keys(localStorage) is used by clearAllMentorChats
  globalThis.localStorage = new Proxy(globalThis.localStorage, { ownKeys: () => [...data.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
  globalThis.__auth = { currentUser: { uid } };
  return data;
}

const msg = (id, role, content) => ({ id, role, content, timestamp: new Date().toISOString() });

test('chat is saved with a title from the first student message and reopens as the active chat', async () => {
  freshEnv();
  const s = await loadStore();
  const id = s.newMentorChatId();
  s.saveMentorChat(id, [msg('1', 'user', 'what is photosynthesis ?'), msg('2', 'mentor', 'Plants make food.')]);
  assert.deepEqual(s.listMentorChats().map((c) => c.title), ['what is photosynthesis ?']);
  const active = s.loadActiveMentorChat();
  assert.equal(active.id, id);
  assert.equal(active.messages.length, 2);
});

test('an empty chat (no student message) is never stored', async () => {
  freshEnv();
  const s = await loadStore();
  s.saveMentorChat(s.newMentorChatId(), [msg('w', 'mentor', 'hi')]);
  assert.equal(s.listMentorChats().length, 0);
  assert.equal(s.loadActiveMentorChat(), null);
});

test('two chats stay separate; newest first; reopening does not reorder; new chat clears the active one', async () => {
  freshEnv();
  const s = await loadStore();
  const a = s.newMentorChatId();
  s.saveMentorChat(a, [msg('1', 'user', 'first chat')]);
  await new Promise((r) => setTimeout(r, 5));
  const b = s.newMentorChatId();
  s.saveMentorChat(b, [msg('2', 'user', 'second chat')]);
  assert.deepEqual(s.listMentorChats().map((c) => c.title), ['second chat', 'first chat']);
  // reopen the older one: same messages saved again -> order must not change
  s.setActiveMentorChat(a);
  s.saveMentorChat(a, s.loadMentorChatById(a));
  assert.deepEqual(s.listMentorChats().map((c) => c.title), ['second chat', 'first chat']);
  assert.equal(s.loadActiveMentorChat().id, a);
  s.setActiveMentorChat(null);
  assert.equal(s.loadActiveMentorChat(), null);
  assert.equal(s.loadMentorChatById(b)[0].content, 'second chat');
});

test('delete removes one chat only; deleting the active chat clears the active pointer', async () => {
  freshEnv();
  const s = await loadStore();
  const a = s.newMentorChatId();
  const b = s.newMentorChatId();
  s.saveMentorChat(a, [msg('1', 'user', 'keep me')]);
  s.saveMentorChat(b, [msg('2', 'user', 'delete me')]);
  s.deleteMentorChat(b);
  assert.deepEqual(s.listMentorChats().map((c) => c.title), ['keep me']);
  assert.equal(s.loadActiveMentorChat(), null);
});

test('the old single-chat format is migrated into the first saved chat', async () => {
  const data = freshEnv();
  data.set('learning_os_mentor_chat_v1:u1', JSON.stringify([msg('1', 'user', 'old question'), msg('2', 'mentor', 'old answer')]));
  const s = await loadStore();
  const active = s.loadActiveMentorChat();
  assert.equal(active.messages.length, 2);
  assert.deepEqual(s.listMentorChats().map((c) => c.title), ['old question']);
});

test("one student's chats are not visible to another, and sign-out wipes everything", async () => {
  const data = freshEnv('u1');
  let s = await loadStore();
  s.saveMentorChat(s.newMentorChatId(), [msg('1', 'user', 'private to u1')]);
  globalThis.__auth.currentUser = { uid: 'u2' };
  assert.equal(s.listMentorChats().length, 0);
  globalThis.__auth.currentUser = { uid: 'u1' };
  assert.equal(s.listMentorChats().length, 1);
  data.set('learning_os_mentor_chat_v1:u9', '[]');
  s.clearAllMentorChats();
  assert.deepEqual([...data.keys()].filter((k) => k.startsWith('learning_os_mentor_chat')), []);
});

test('no signed-in user: nothing is read or written', async () => {
  const data = freshEnv();
  globalThis.__auth = { currentUser: null };
  const s = await loadStore();
  s.saveMentorChat('x', [msg('1', 'user', 'hi')]);
  assert.equal(data.size, 0);
  assert.deepEqual(s.listMentorChats(), []);
});
