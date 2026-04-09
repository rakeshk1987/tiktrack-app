export type FirebaseRuntimeEnv = 'prod' | 'test';

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

type EnvReader = Record<string, string | boolean | undefined>;
interface RuntimeContext {
  dev?: boolean;
  hostname?: string;
}

const PROD_FALLBACK_CONFIG: FirebaseClientConfig = {
  apiKey: 'AIzaSyAMkCRflfXDe6QAPBivES4l5zLGA1kYpMA',
  authDomain: 'tiktrack-f112b.firebaseapp.com',
  projectId: 'tiktrack-f112b',
  storageBucket: 'tiktrack-f112b.firebasestorage.app',
  messagingSenderId: '695287186816',
  appId: '1:695287186816:web:82e79e0db74998810fed65',
  measurementId: 'G-JT0DD20RYK'
};

function getString(reader: EnvReader, key: string): string | undefined {
  const value = reader[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function resolveFirebaseRuntimeEnv(rawValue: string | undefined): FirebaseRuntimeEnv {
  return rawValue?.toLowerCase() === 'test' ? 'test' : 'prod';
}

export function isLocalRuntime(context: RuntimeContext): boolean {
  const hostname = (context.hostname || '').toLowerCase();
  return (
    Boolean(context.dev) ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local')
  );
}

export function resolveFirebaseRuntimeEnvWithRuntime(
  rawValue: string | undefined,
  context: RuntimeContext
): FirebaseRuntimeEnv {
  if (isLocalRuntime(context)) {
    return 'test';
  }
  return resolveFirebaseRuntimeEnv(rawValue);
}

function assertRequired(config: FirebaseClientConfig, env: FirebaseRuntimeEnv) {
  const requiredKeys: Array<keyof FirebaseClientConfig> = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  const missing = requiredKeys.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase ${env} config keys: ${missing.join(', ')}. Check your .env settings.`
    );
  }
}

export function getFirebaseClientConfig(
  env: FirebaseRuntimeEnv,
  reader: EnvReader
): FirebaseClientConfig {
  if (env === 'prod') {
    const config: FirebaseClientConfig = {
      apiKey: getString(reader, 'VITE_FIREBASE_PROD_API_KEY') ?? PROD_FALLBACK_CONFIG.apiKey,
      authDomain:
        getString(reader, 'VITE_FIREBASE_PROD_AUTH_DOMAIN') ?? PROD_FALLBACK_CONFIG.authDomain,
      projectId: getString(reader, 'VITE_FIREBASE_PROD_PROJECT_ID') ?? PROD_FALLBACK_CONFIG.projectId,
      storageBucket:
        getString(reader, 'VITE_FIREBASE_PROD_STORAGE_BUCKET') ?? PROD_FALLBACK_CONFIG.storageBucket,
      messagingSenderId:
        getString(reader, 'VITE_FIREBASE_PROD_MESSAGING_SENDER_ID') ??
        PROD_FALLBACK_CONFIG.messagingSenderId,
      appId: getString(reader, 'VITE_FIREBASE_PROD_APP_ID') ?? PROD_FALLBACK_CONFIG.appId,
      measurementId:
        getString(reader, 'VITE_FIREBASE_PROD_MEASUREMENT_ID') ?? PROD_FALLBACK_CONFIG.measurementId
    };
    assertRequired(config, env);
    return config;
  }

  const config: FirebaseClientConfig = {
    apiKey: getString(reader, 'VITE_FIREBASE_TEST_API_KEY') ?? '',
    authDomain: getString(reader, 'VITE_FIREBASE_TEST_AUTH_DOMAIN') ?? '',
    projectId: getString(reader, 'VITE_FIREBASE_TEST_PROJECT_ID') ?? '',
    storageBucket: getString(reader, 'VITE_FIREBASE_TEST_STORAGE_BUCKET') ?? '',
    messagingSenderId: getString(reader, 'VITE_FIREBASE_TEST_MESSAGING_SENDER_ID') ?? '',
    appId: getString(reader, 'VITE_FIREBASE_TEST_APP_ID') ?? '',
    measurementId: getString(reader, 'VITE_FIREBASE_TEST_MEASUREMENT_ID')
  };

  assertRequired(config, env);
  return config;
}
