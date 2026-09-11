import test from 'node:test';
import assert from 'node:assert/strict';
import { selectResponsiveLayout } from '../responsive-layout.js';

test('selectResponsiveLayout uses the widget border-box dimensions', () => {
  assert.equal(selectResponsiveLayout(640, 128), 'wide');
  assert.equal(selectResponsiveLayout(560, 128), 'wide');
  assert.equal(selectResponsiveLayout(360, 180), 'stacked');
  assert.equal(selectResponsiveLayout(260, 82), 'compact');
});
