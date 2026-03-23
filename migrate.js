const { spawn } = require('child_process');

const proc = spawn('npm', ['run', 'db:push'], {
  cwd: process.cwd(),
  stdio: 'pipe'
});

let output = '';
proc.stdout.on('data', (data) => {
  output += data.toString();
  process.stdout.write(data);
  // If we see the interactive prompt, send the first option (just press enter)
  if (output.includes('Is audio_sessions table created')) {
    proc.stdin.write('\n');
  }
});

proc.stderr.on('data', (data) => {
  process.stderr.write(data);
});

proc.on('close', (code) => {
  process.exit(code);
});
