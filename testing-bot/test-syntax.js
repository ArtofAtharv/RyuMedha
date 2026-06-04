const fs = require('fs');
const { execSync } = require('child_process');
try {
  execSync('node --check server.js');
  console.log('server.js syntax OK');
} catch (e) {
  console.error('Syntax error in server.js');
  process.exit(1);
}
