import { describe, it, expect } from 'vitest';

/**
 * DEMO FAILING TEST
 * 
 * This test is intentionally designed to fail to demonstrate that:
 * 1. CI pipeline catches failing tests
 * 2. PRs cannot be merged when tests fail
 * 3. Required checks block merges
 * 
 * To enable this test and see CI failure:
 * - Uncomment the test below
 * 
 * To disable and allow CI to pass:
 * - Keep the test commented out (default state)
 */

describe('Demo Failing Test', () => {
  /*
  it('should deliberately fail to demonstrate CI gates', () => {
    expect(true).toBe(false); // This will fail
  });
  */

  it('should pass when demo failing test is disabled', () => {
    expect(true).toBe(true);
  });
});
