import { spawn } from 'child_process';

const proc = spawn('npm', ['run', 'db:push'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'inherit', 'inherit']
});

setTimeout(() => {
  proc.stdin.write('\n');
}, 15000);

proc.on('close', (code) => {
  process.exit(code);
});
