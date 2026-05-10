#!/usr/bin/env node
/**
 * WebADB Bridge - WebSocket 到 ADB 的代理服务器
 * 
 * 用法：
 *   node bridge.js [--port 15555]
 * 
 * 功能：
 *   - 接收浏览器的 WebSocket 连接
 *   - 转发 ADB 命令到本地 adb 进程
 *   - 支持无线配对和连接
 * 
 * 依赖：
 *   npm install ws
 */

const { spawn, exec } = require('child_process');
const http = require('http');
const url = require('url');

// ---- 配置 ----
const DEFAULT_PORT = 15555;
const port = parseInt(process.argv.find(a => a.startsWith('--port'))?.split('=')[1] || DEFAULT_PORT);

// ---- 简易 WebSocket 实现（零依赖）----
class SimpleWebSocketServer {
  constructor(server) {
    this.clients = new Set();
    this.handlers = {};

    server.on('upgrade', (req, socket, head) => {
      if (req.url === '/adb') {
        this.handleUpgrade(req, socket, head);
      }
    });
  }

  handleUpgrade(req, socket, head) {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }

    const acceptKey = this.generateAcceptKey(key);

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
      '\r\n'
    );

    const client = { socket, alive: true };
    this.clients.add(client);

    socket.on('data', (data) => {
      try {
        const message = this.decodeFrame(data);
        if (message && this.handlers.message) {
          this.handlers.message(client, message);
        }
      } catch (e) {
        // ignore parse errors
      }
    });

    socket.on('close', () => {
      client.alive = false;
      this.clients.delete(client);
      if (this.handlers.close) this.handlers.close(client);
    });

    socket.on('error', () => {
      client.alive = false;
      this.clients.delete(client);
    });

    if (this.handlers.connection) this.handlers.connection(client);
  }

  generateAcceptKey(key) {
    const crypto = require('crypto');
    return crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-5AB5DC11C5AF').digest('base64');
  }

  decodeFrame(buffer) {
    if (buffer.length < 2) return null;

    const firstByte = buffer[0];
    const secondByte = buffer[1];
    const opcode = firstByte & 0x0F;
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7F;
    let offset = 2;

    if (payloadLength === 126) {
      payloadLength = buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLength === 127) {
      payloadLength = Number(buffer.readBigUInt64BE(2));
      offset = 10;
    }

    if (isMasked) {
      const maskKey = buffer.slice(offset, offset + 4);
      offset += 4;
      const payload = buffer.slice(offset, offset + payloadLength);
      for (let i = 0; i < payload.length; i++) {
        payload[i] = payload[i] ^ maskKey[i % 4];
      }
      return payload.toString('utf8');
    }

    return buffer.slice(offset, offset + payloadLength).toString('utf8');
  }

  send(client, data) {
    if (!client.alive) return;
    try {
      const payload = Buffer.from(data);
      const mask = 0x80; // server frames are not masked
      let header;

      if (payload.length < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x81; // text frame
        header[1] = payload.length;
      } else if (payload.length < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(payload.length, 2);
      } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(payload.length), 2);
      }

      client.socket.write(Buffer.concat([header, payload]));
    } catch (e) {
      // client disconnected
    }
  }

  broadcast(data) {
    this.clients.forEach(client => this.send(client, data));
  }

  on(event, handler) {
    this.handlers[event] = handler;
  }
}

// ---- ADB 命令执行 ----
function runAdb(args, callback) {
  const proc = spawn('adb', args, { timeout: 30000 });
  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', (data) => { stdout += data.toString(); });
  proc.stderr.on('data', (data) => { stderr += data.toString(); });

  proc.on('close', (code) => {
    callback(code, stdout, stderr);
  });
}

// ---- 主服务 ----
const server = http.createServer((req, res) => {
  // CORS headers for API endpoints
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const parsed = url.parse(req.url, true);

  // Health check
  if (parsed.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: '1.0.0', clients: wss.clients.size }));
    return;
  }

  // List devices
  if (parsed.pathname === '/devices') {
    runAdb(['devices', '-l'], (code, stdout) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: code === 0, output: stdout }));
    });
    return;
  }

  // Default page
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>WebADB Bridge</title>
<style>
  body { font-family: monospace; background: #1a1a2e; color: #e0e0e0; padding: 40px; text-align: center; }
  h1 { color: #6c63ff; }
  .status { color: #2ed573; font-size: 18px; margin: 20px 0; }
  .info { color: #888; font-size: 14px; line-height: 2; }
  code { background: #0f0f1a; padding: 4px 8px; border-radius: 4px; }
</style></head><body>
  <h1>WebADB Bridge</h1>
  <div class="status">Running on port ${port}</div>
  <div class="info">
    WebSocket endpoint: <code>ws://localhost:${port}/adb</code><br>
    Health check: <code>http://localhost:${port}/health</code><br>
    Device list: <code>http://localhost:${port}/devices</code><br><br>
    Connected clients: ${wss ? wss.clients.size : 0}
  </div>
</body></html>`);
});

const wss = new SimpleWebSocketServer(server);

// ---- WebSocket 消息处理 ----
wss.on('connection', (client) => {
  console.log(`[+] 新客户端连接 (共 ${wss.clients.size} 个)`);

  // Send welcome message
  wss.send(client, JSON.stringify({
    type: 'welcome',
    message: 'WebADB Bridge 已连接',
    version: '1.0.0'
  }));

  // Send current device list
  runAdb(['devices', '-l'], (code, stdout) => {
    if (code === 0 && stdout) {
      const devices = parseAdbDevices(stdout);
      wss.send(client, JSON.stringify({
        type: 'device_list',
        devices: devices
      }));
    }
  });
});

wss.on('message', (client, rawMessage) => {
  let data;
  try {
    data = JSON.parse(rawMessage);
  } catch {
    wss.send(client, JSON.stringify({ type: 'error', message: '无效的 JSON 消息' }));
    return;
  }

  console.log(`[>] ${data.action}`, data);

  switch (data.action) {
    case 'pair':
      handlePair(client, data);
      break;

    case 'connect':
      handleConnect(client, data);
      break;

    case 'disconnect':
      handleDisconnect(client, data);
      break;

    case 'shell':
      handleShell(client, data);
      break;

    case 'devices':
      handleDevices(client);
      break;

    default:
      wss.send(client, JSON.stringify({ type: 'error', message: `未知操作: ${data.action}` }));
  }
});

wss.on('close', (client) => {
  console.log(`[-] 客户端断开 (剩余 ${wss.clients.size} 个)`);
});

// ---- 命令处理器 ----

function handlePair(client, data) {
  const { ip, port, code } = data;
  if (!ip || !port || !code) {
    wss.send(client, JSON.stringify({
      type: 'pair_result', success: false, error: '缺少必要参数'
    }));
    return;
  }

  console.log(`[*] 配对 ${ip}:${port} 配对码: ${code}`);

  // adb pair <ip>:<port> → 输入配对码
  const pairAddr = `${ip}:${port}`;
  const proc = spawn('adb', ['pair', pairAddr]);

  let responded = false;

  // Wait for password prompt, then send pairing code
  proc.stdout.on('data', (d) => {
    const text = d.toString();
    if (text.includes('Enter pairing code') || text.includes('?') || true) {
      proc.stdin.write(code + '\n');
    }
  });

  proc.stderr.on('data', (d) => {
    const text = d.toString();
    if (text.includes('Successfully paired') || text.includes('成功')) {
      if (!responded) {
        responded = true;
        wss.send(client, JSON.stringify({
          type: 'pair_result', success: true, ip, port
        }));
      }
    }
  });

  proc.on('close', (code) => {
    if (!responded) {
      responded = true;
      if (code === 0) {
        wss.send(client, JSON.stringify({
          type: 'pair_result', success: true, ip, port
        }));
      } else {
        wss.send(client, JSON.stringify({
          type: 'pair_result', success: false, ip, port,
          error: '配对失败，请检查配对码和端口是否正确'
        }));
      }
    }
  });

  // Timeout
  setTimeout(() => {
    if (!responded) {
      responded = true;
      proc.kill();
      wss.send(client, JSON.stringify({
        type: 'pair_result', success: false, ip, port,
        error: '配对超时'
      }));
    }
  }, 15000);
}

function handleConnect(client, data) {
  const { ip, port } = data;
  if (!ip || !port) {
    wss.send(client, JSON.stringify({
      type: 'connect_result', success: false, error: '缺少 IP 或端口'
    }));
    return;
  }

  const addr = `${ip}:${port}`;
  console.log(`[*] 连接 ${addr}`);

  runAdb(['connect', addr], (code, stdout, stderr) => {
    const success = stdout.includes('connected') || stdout.includes('already connected');
    wss.send(client, JSON.stringify({
      type: 'connect_result', success, ip, port,
      error: success ? undefined : (stderr || stdout || '连接失败')
    }));
  });
}

function handleDisconnect(client, data) {
  const { ip, port } = data;
  const addr = `${ip}:${port}`;

  runAdb(['disconnect', addr], (code, stdout) => {
    wss.send(client, JSON.stringify({
      type: 'disconnect_result', success: code === 0, ip, port
    }));
  });
}

function handleShell(client, data) {
  const { command } = data;
  if (!command) {
    wss.send(client, JSON.stringify({ type: 'error', message: '缺少命令' }));
    return;
  }

  console.log(`[>] shell: ${command}`);

  const proc = spawn('adb', ['shell', command], { timeout: 30000 });
  let output = '';

  proc.stdout.on('data', (d) => { output += d.toString(); });
  proc.stderr.on('data', (d) => { output += d.toString(); });

  proc.on('close', () => {
    wss.send(client, JSON.stringify({
      type: 'shell_output', command, output
    }));
  });

  // Timeout
  setTimeout(() => {
    if (output) {
      proc.kill();
    }
  }, 25000);
}

function handleDevices(client) {
  runAdb(['devices', '-l'], (code, stdout) => {
    const devices = parseAdbDevices(stdout);
    wss.send(client, JSON.stringify({
      type: 'device_list', devices
    }));
  });
}

function parseAdbDevices(output) {
  const devices = [];
  const lines = output.split('\n').filter(l => l.trim() && !l.startsWith('List'));

  lines.forEach(line => {
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const addr = parts[0];
      const status = parts[1];
      const name = parts.find(p => p.startsWith('model:'))?.replace('model:', '') || 'Unknown';

      if (addr.includes('.') || addr.includes(':')) {
        devices.push({ ip: addr.split(':')[0], port: addr.split(':')[1] || '5555', name, status });
      }
    }
  });

  return devices;
}

// ---- 启动 ----
server.listen(port, () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║     WebADB Bridge v1.0.0             ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  WebSocket: ws://localhost:${port}/adb`);
  console.log(`║  HTTP:      http://localhost:${port}`);
  console.log('╠══════════════════════════════════════╣');
  console.log('║  前端连接地址:                       ║');
  console.log(`║  ws://localhost:${port}/adb`);
  console.log('╠══════════════════════════════════════╣');
  console.log('║  支持的操作:                         ║');
  console.log('║  - pair: 无线配对                    ║');
  console.log('║  - connect: 连接设备                 ║');
  console.log('║  - disconnect: 断开设备              ║');
  console.log('║  - shell: 执行命令                   ║');
  console.log('║  - devices: 列出设备                  ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('等待浏览器连接...');
});
