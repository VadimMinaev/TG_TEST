const { spawn } = require('child_process');
const path = require('path');

const appPath = path.join(__dirname, 'server', 'app.js');
const child = spawn('node', [appPath], {
  cwd: __dirname,
  stdio: 'inherit'
});

process.on('SIGINT', () => {
  child.kill();
  process.exit(0);
});
