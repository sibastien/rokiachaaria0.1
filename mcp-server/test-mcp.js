const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.resolve(__dirname, 'index.js');
const proc = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let buffer = '';

proc.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id === 1) {
        // Now send tools/list
        const listReq = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {}
        };
        proc.stdin.write(JSON.stringify(listReq) + '\n');
      } else if (msg.id === 2) {
        console.log('TOOLS COUNT:', msg.result.tools.length);
        console.log('TOOLS NAMES:', msg.result.tools.map(t => t.name));
        console.log('PUBLISH_ARTICLE SCHEMA PROPERTIES:', Object.keys(msg.result.tools.find(t => t.name === 'publish_article').inputSchema.properties));
        proc.kill();
        process.exit(0);
      }
    } catch (e) {
    }
  }
});

// Send Initialize request
proc.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' }
  }
}) + '\n');
