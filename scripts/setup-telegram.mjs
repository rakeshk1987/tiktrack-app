#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

function readDefaultProject() {
  try {
    const rc = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8'));
    return rc.projects?.default || '';
  } catch {
    return '';
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}.`);
    process.exit(1);
  }
  return value;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${redactArgs(args).join(' ')} exited with ${code}`));
    });
  });
}

function redactArgs(args) {
  return args.map((arg) => {
    if (arg.startsWith('telegram.bot_token=')) return 'telegram.bot_token=<redacted>';
    if (arg.startsWith('telegram.webhook_secret=')) return 'telegram.webhook_secret=<redacted>';
    return arg;
  });
}

async function setWebhook(token, webhookUrl, secret) {
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    throw new Error(`Telegram setWebhook failed: ${JSON.stringify(body)}`);
  }
}

async function setMenuButton(token, miniAppUrl) {
  const response = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: 'TikTrack',
        web_app: { url: miniAppUrl },
      },
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    throw new Error(`Telegram setChatMenuButton failed: ${JSON.stringify(body)}`);
  }
}

async function setBotCommands(token) {
  const response = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Open TikTrack parent menu' },
        { command: 'menu', description: 'Show child and schedule actions' },
        { command: 'link', description: 'Link Telegram to TikTrack with a code' },
      ],
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    throw new Error(`Telegram setMyCommands failed: ${JSON.stringify(body)}`);
  }
}

const project = process.env.FIREBASE_PROJECT?.trim() || readDefaultProject();
if (!project) {
  console.error('Missing FIREBASE_PROJECT and no default project found in .firebaserc.');
  process.exit(1);
}

const botToken = requireEnv('TELEGRAM_BOT_TOKEN');
const webhookSecret = requireEnv('TELEGRAM_WEBHOOK_SECRET');
const miniAppUrl = requireEnv('TELEGRAM_MINI_APP_URL');
const miniAppOrigin = process.env.TELEGRAM_MINI_APP_ORIGIN?.trim() || new URL(miniAppUrl).origin;
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL?.trim() || `https://us-central1-${project}.cloudfunctions.net/telegramWebhook`;
const shouldDeploy = process.argv.includes('--deploy');

console.log(`Project: ${project}`);
console.log(`Mini App: ${miniAppUrl}`);
console.log(`Webhook: ${webhookUrl}`);

await run('npx', [
  'firebase-tools',
  'functions:config:set',
  `telegram.bot_token=${botToken}`,
  `telegram.webhook_secret=${webhookSecret}`,
  `telegram.mini_app_url=${miniAppUrl}`,
  `telegram.mini_app_origin=${miniAppOrigin}`,
  '--project',
  project,
]);

if (shouldDeploy) {
  await run('npm', ['run', 'build']);
  await run('npm', ['run', 'build'], { cwd: 'functions' });
  await run('npx', ['firebase-tools', 'deploy', '--only', 'functions,hosting,firestore:rules', '--project', project]);
}

await setWebhook(botToken, webhookUrl, webhookSecret);
await setMenuButton(botToken, miniAppUrl);
await setBotCommands(botToken);
console.log('Telegram config, webhook, Mini App menu button, and bot commands are ready.');
