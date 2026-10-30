// The in-app confirm / prompt / notice boxes that replace window.confirm / prompt / alert.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

test('in-app dialogs: confirm / prompt / notice resolve from the buttons, Enter and Esc; queued in order', async () => {
  const React = (await import('react')).default;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { AppDialogHost, askConfirm, askText, showNotice, LanguageProvider } = await loadTs('tests/dialogsEntry.ts');
  // the browser's own boxes must NOT be used while the host is mounted
  window.confirm = () => { throw new Error('native confirm used'); };
  window.prompt = () => { throw new Error('native prompt used'); };
  window.alert = () => { throw new Error('native alert used'); };

  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(AppDialogHost))));
  const btn = (label) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent === label);
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 10)));

  // confirm -> OK
  let result;
  askConfirm('Delete this?', { danger: true }).then((v) => { result = v; });
  await settle();
  assert.ok(document.body.textContent.includes('Delete this?'));
  await act(async () => btn('OK').click());
  await settle();
  assert.equal(result, true);
  assert.equal(document.body.textContent.includes('Delete this?'), false, 'closes after answering');

  // confirm -> Cancel
  askConfirm('Sure?').then((v) => { result = v; });
  await settle();
  await act(async () => btn('Cancel').click());
  await settle();
  assert.equal(result, false);

  // prompt: typed text + Enter; then cancelled with Esc
  let typed;
  askText('Folder name', 'Old').then((v) => { typed = v; });
  await settle();
  const input = document.querySelector('input');
  assert.equal(input.value, 'Old', 'starts with the suggested text');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(input, 'Physics'); input.dispatchEvent(new window.Event('input', { bubbles: true })); });
  await act(async () => input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  await settle();
  assert.equal(typed, 'Physics');

  askText('Rename', 'x').then((v) => { typed = v; });
  await settle();
  await act(async () => document.querySelector('[role="dialog"]').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await settle();
  assert.equal(typed, null, 'Esc = cancelled');

  // two questions at once are shown one after the other
  const order = [];
  askConfirm('First?').then((v) => order.push(['first', v]));
  askConfirm('Second?').then((v) => order.push(['second', v]));
  await settle();
  assert.ok(document.body.textContent.includes('First?') && !document.body.textContent.includes('Second?'));
  await act(async () => btn('OK').click());
  await settle();
  assert.ok(document.body.textContent.includes('Second?'));
  await act(async () => btn('Cancel').click());
  await settle();
  assert.deepEqual(order, [['first', true], ['second', false]]);

  // notice
  let noticed = false;
  showNotice('Storage is full.').then(() => { noticed = true; });
  await settle();
  await act(async () => btn('OK').click());
  await settle();
  assert.equal(noticed, true);

  await act(async () => root.unmount());
});
