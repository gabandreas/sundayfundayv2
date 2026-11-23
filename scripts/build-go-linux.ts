import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');
const goDir = path.join(root, 'apps', 'go-engine');
const apiBinDir = path.join(root, 'apps', 'api', 'bin');
fs.mkdirSync(apiBinDir, { recursive: true });

execFileSync('go', ['build', '-ldflags=-s -w', '-o', path.join(goDir, 'bin', 'go-engine.exe'), './cmd/engine'], {
  cwd: goDir,
  stdio: 'inherit',
});
execFileSync('go', ['build', '-ldflags=-s -w', '-o', path.join(goDir, 'bin', 'erp-engine.exe'), './cmd/engine'], {
  cwd: goDir,
  stdio: 'inherit',
});
execFileSync('go', ['build', '-ldflags=-s -w', '-o', path.join(apiBinDir, 'go-engine-linux'), './cmd/engine'], {
  cwd: goDir,
  env: { ...process.env, GOOS: 'linux', GOARCH: 'amd64', CGO_ENABLED: '0' },
  stdio: 'inherit',
});

const linuxSize = fs.statSync(path.join(apiBinDir, 'go-engine-linux')).size;
console.log(`Built Windows binaries + Linux ELF go-engine-linux (${(linuxSize / 1024 / 1024).toFixed(2)} MB)`);
