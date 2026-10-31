import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers.mjs';

const logic = await loadTs('src/missionControlLogic.ts');

test('next best step opens profile setup when no learning profile exists', () => {
  assert.equal(logic.getNextBestStepAction({ hasLearningProfile: false, revisionDue: 4, revisionOverdue: 2 }), 'profile');
});

test('next best step prioritizes overdue or due revision after profile setup', () => {
  assert.equal(logic.getNextBestStepAction({ hasLearningProfile: true, revisionDue: 0, revisionOverdue: 2 }), 'revision');
  assert.equal(logic.getNextBestStepAction({ hasLearningProfile: true, revisionDue: 3, revisionOverdue: 0 }), 'revision');
});

test('next best step points to the roadmap when no revision is due', () => {
  assert.equal(logic.getNextBestStepAction({ hasLearningProfile: true, revisionDue: 0, revisionOverdue: 0 }), 'roadmap');
});
