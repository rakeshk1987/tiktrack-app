/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: 'prod' | 'test';

  readonly VITE_FIREBASE_PROD_API_KEY?: string;
  readonly VITE_FIREBASE_PROD_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROD_PROJECT_ID?: string;
  readonly VITE_FIREBASE_PROD_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_PROD_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_PROD_APP_ID?: string;
  readonly VITE_FIREBASE_PROD_MEASUREMENT_ID?: string;

  readonly VITE_FIREBASE_TEST_API_KEY?: string;
  readonly VITE_FIREBASE_TEST_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_TEST_PROJECT_ID?: string;
  readonly VITE_FIREBASE_TEST_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_TEST_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_TEST_APP_ID?: string;
  readonly VITE_FIREBASE_TEST_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
