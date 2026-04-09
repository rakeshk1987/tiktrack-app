import { describe, expect, it } from 'vitest';
import {
  getFirebaseClientConfig,
  isLocalRuntime,
  resolveFirebaseRuntimeEnv,
  resolveFirebaseRuntimeEnvWithRuntime
} from './firebaseEnvironment';

describe('resolveFirebaseRuntimeEnv', () => {
  it('maps explicit test env', () => {
    expect(resolveFirebaseRuntimeEnv('test')).toBe('test');
  });

  it('maps unknown envs to prod', () => {
    expect(resolveFirebaseRuntimeEnv('staging')).toBe('prod');
  });

  it('maps missing env to prod', () => {
    expect(resolveFirebaseRuntimeEnv(undefined)).toBe('prod');
  });
});

describe('isLocalRuntime', () => {
  it('detects local dev mode', () => {
    expect(isLocalRuntime({ dev: true })).toBe(true);
  });

  it('detects localhost hostname', () => {
    expect(isLocalRuntime({ hostname: 'localhost' })).toBe(true);
  });

  it('returns false for hosted non-local hostnames', () => {
    expect(isLocalRuntime({ dev: false, hostname: 'app.tiktrack.com' })).toBe(false);
  });
});

describe('resolveFirebaseRuntimeEnvWithRuntime', () => {
  it('forces test env for local runtime even if prod is requested', () => {
    expect(resolveFirebaseRuntimeEnvWithRuntime('prod', { dev: true, hostname: 'localhost' })).toBe(
      'test'
    );
  });

  it('uses prod on hosted runtime by default', () => {
    expect(
      resolveFirebaseRuntimeEnvWithRuntime(undefined, { dev: false, hostname: 'app.tiktrack.com' })
    ).toBe('prod');
  });

  it('allows hosted test runtime when explicitly configured', () => {
    expect(
      resolveFirebaseRuntimeEnvWithRuntime('test', { dev: false, hostname: 'qa.tiktrack.com' })
    ).toBe('test');
  });
});

describe('getFirebaseClientConfig', () => {
  it('returns prod fallback values when prod env vars are missing', () => {
    const config = getFirebaseClientConfig('prod', {});
    expect(config.projectId).toBe('tiktrack-f112b');
    expect(config.authDomain).toContain('firebaseapp.com');
  });

  it('throws when test env selected without required test keys', () => {
    expect(() => getFirebaseClientConfig('test', {})).toThrow(/Missing Firebase test config keys/);
  });

  it('builds test config from test env variables', () => {
    const config = getFirebaseClientConfig('test', {
      VITE_FIREBASE_TEST_API_KEY: 'test-key',
      VITE_FIREBASE_TEST_AUTH_DOMAIN: 'test.firebaseapp.com',
      VITE_FIREBASE_TEST_PROJECT_ID: 'test-project',
      VITE_FIREBASE_TEST_STORAGE_BUCKET: 'test.appspot.com',
      VITE_FIREBASE_TEST_MESSAGING_SENDER_ID: '123456',
      VITE_FIREBASE_TEST_APP_ID: '1:123:web:abc'
    });

    expect(config.projectId).toBe('test-project');
    expect(config.apiKey).toBe('test-key');
  });

  it('uses explicit production env values when provided', () => {
    const config = getFirebaseClientConfig('prod', {
      VITE_FIREBASE_PROD_API_KEY: 'prod-key',
      VITE_FIREBASE_PROD_AUTH_DOMAIN: 'prod.firebaseapp.com',
      VITE_FIREBASE_PROD_PROJECT_ID: 'prod-project',
      VITE_FIREBASE_PROD_STORAGE_BUCKET: 'prod.appspot.com',
      VITE_FIREBASE_PROD_MESSAGING_SENDER_ID: '999',
      VITE_FIREBASE_PROD_APP_ID: '1:999:web:prod'
    });

    expect(config.projectId).toBe('prod-project');
    expect(config.apiKey).toBe('prod-key');
  });

  it('throws when one required test env key is missing', () => {
    expect(() =>
      getFirebaseClientConfig('test', {
        VITE_FIREBASE_TEST_API_KEY: 'test-key',
        VITE_FIREBASE_TEST_AUTH_DOMAIN: 'test.firebaseapp.com',
        VITE_FIREBASE_TEST_PROJECT_ID: 'test-project',
        VITE_FIREBASE_TEST_STORAGE_BUCKET: 'test.appspot.com',
        VITE_FIREBASE_TEST_MESSAGING_SENDER_ID: '123456'
        // appId missing on purpose
      })
    ).toThrow(/appId/);
  });
});
