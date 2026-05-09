import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';

const ports = [9099, 8080, 9199];
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const npxCommand = isWindows ? 'npx.cmd' : 'npx';
const localFirebaseCli = isWindows
  ? path.join(process.cwd(), 'node_modules', '.bin', 'firebase.cmd')
  : path.join(process.cwd(), 'node_modules', '.bin', 'firebase');

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function areEmulatorsReady() {
  const results = await Promise.all(ports.map((port) => canConnect(port)));
  return results.every(Boolean);
}

async function waitForEmulators(timeoutMs = 180000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await areEmulatorsReady()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

function spawnProcess(command, args, env = process.env) {
  return spawn(command, args, {
    env,
    stdio: 'inherit',
    shell: false
  });
}

let emulatorProcess = null;
let devProcess = null;
let shuttingDown = false;
let emulatorsWereBootedByThisScript = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  devProcess?.kill('SIGTERM');
  emulatorProcess?.kill('SIGTERM');
  process.exitCode = exitCode;
  setTimeout(() => process.exit(exitCode), 1000).unref();
}

process.once('SIGINT', () => shutdown(130));
process.once('SIGTERM', () => shutdown(143));

let shouldStartVite = true;

if (!(await areEmulatorsReady())) {
  console.log('Starting Firebase emulators...');
  emulatorsWereBootedByThisScript = true;
  const firebaseArgs = [
    'emulators:start',
    '--only',
    'auth,firestore,storage',
    '--import',
    '.firebase-data',
    '--export-on-exit'
  ];

  if (fs.existsSync(localFirebaseCli)) {
    emulatorProcess = spawnProcess(localFirebaseCli, firebaseArgs);
  } else {
    emulatorProcess = spawnProcess(npxCommand, ['firebase-tools', ...firebaseArgs]);
  }

  emulatorProcess.once('exit', (code) => {
    if (shuttingDown) {
      return;
    }

    const reason = code ?? 'signal';
    if (!devProcess) {
      console.error(`Firebase emulators exited before Vite started (${reason}).`);
    } else {
      console.error(`Firebase emulators exited while Vite was running (${reason}).`);
    }
    shutdown(code ?? 1);
  });

  if (!(await waitForEmulators())) {
    console.error('Firebase emulators did not become reachable on 127.0.0.1 ports 9099, 8080, and 9199.');
    shouldStartVite = false;
    shutdown(1);
  }
}

if (shouldStartVite) {
  if (emulatorsWereBootedByThisScript) {
    // Ports can open slightly before all emulator internals are fully ready.
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  console.log('Starting Vite with Firebase emulator mode enabled...');
  devProcess = spawnProcess(npmCommand, ['run', 'dev', '--', '--host', '0.0.0.0'], {
    ...process.env,
    VITE_USE_FIREBASE_EMULATORS: 'true'
  });

  devProcess.once('exit', (code) => shutdown(code ?? 0));
}
