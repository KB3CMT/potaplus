import dgram from 'dgram';
import http from 'http';
import net from 'net';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proxyPl = path.join(root, 'ham-apps-proxy/src/ham-apps-proxy.pl');
const fail = [];
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) fail.push(`${name}: got ${g} expected ${w}`);
}
function ok(name, cond, detail) {
  if (!cond) fail.push(`${name}: ${detail || 'failed'}`);
}

function listenUdp() {
  return new Promise((resolve) => {
    const sock = dgram.createSocket('udp4');
    const msgs = [];
    sock.on('message', (msg) => msgs.push(Buffer.from(msg)));
    sock.bind(0, '127.0.0.1', () => {
      resolve({ port: sock.address().port, msgs, close: () => sock.close() });
    });
  });
}

function listenTcp() {
  return new Promise((resolve) => {
    const chunks = [];
    const server = net.createServer((c) => {
      c.on('data', (d) => chunks.push(Buffer.from(d)));
      c.write('OK\n');
      c.end();
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ port: server.address().port, chunks, close: () => server.close() });
    });
  });
}

function get(urlPath, port) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      host: '127.0.0.1',
      port,
      path: urlPath,
      timeout: 5000,
    }, (res) => {
      const headers = res.headers;
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

function optionsReq(urlPath, port) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: urlPath,
      method: 'OPTIONS',
      timeout: 5000,
    }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function startProxy(listenPort) {
  return new Promise((resolve, reject) => {
    const child = spawn('perl', [proxyPl, '--listen', '127.0.0.1', String(listenPort)], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('proxy start timeout: ' + out));
      }
    }, 8000);
    const onData = (buf) => {
      out += buf.toString();
      if (!settled && /listening on http:\/\/127\.0\.0\.1:/.test(out)) {
        settled = true;
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve(child);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', () => {});
    child.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
    child.on('exit', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`proxy exited ${code}: ${out}`));
      }
    });
  });
}

const proxyPort = 18073 + Math.floor(Math.random() * 1000);
const udp = await listenUdp();
const tcp = await listenTcp();
let child;
try {
  child = await startProxy(proxyPort);

  const ver = await get('/version', proxyPort);
  eq('version status', ver.status, 200);
  const verJson = JSON.parse(ver.body);
  eq('version success', verJson.success, 1);
  eq('version data string', verJson.data, '{"version":"1.09.00"}');
  ok('version cors', ver.headers['access-control-allow-origin'] === '*', ver.headers['access-control-allow-origin']);

  const caps = await get('/capabilities', proxyPort);
  eq('capabilities status', caps.status, 200);
  const capsJson = JSON.parse(caps.body);
  eq('capabilities success', capsJson.success, 1);
  eq('capabilities version', capsJson.data.version, '1.09.00');
  eq('capabilities udp_skip_read', capsJson.data.udp_skip_read, 1);
  ok('capabilities backends', Array.isArray(capsJson.data.backends) && capsJson.data.backends.length >= 8);

  const pre = await optionsReq('/log4om/log', proxyPort);
  ok('options cors', pre.headers['access-control-allow-origin'] === '*');
  ok('options 204 or 200', pre.status === 204 || pre.status === 200, pre.status);

  const missing = await get('/no-such-backend', proxyPort);
  eq('404 status', missing.status, 404);
  ok('404 cors', missing.headers['access-control-allow-origin'] === '*', JSON.stringify(missing.headers));

  const t0 = Date.now();
  const log4 = await get(`/log4om/log?CALL=K1ABC&MODE=CW&FREQ=14.074&__host=127.0.0.1&__port=${udp.port}`, proxyPort);
  const udpMs = Date.now() - t0;
  eq('log4om status', log4.status, 200);
  eq('log4om success', JSON.parse(log4.body).success, 1);
  ok('log4om no udp stall', udpMs < 800, `took ${udpMs}ms`);
  ok('log4om datagram', udp.msgs.length >= 1, `msgs=${udp.msgs.length}`);
  const l4payload = udp.msgs[0] ? udp.msgs[0].toString() : '';
  ok('log4om adif command', l4payload.includes('<command:3>log') || l4payload.includes('<command:3>LOG') || /<command:\d+>log/i.test(l4payload), l4payload);

  const t1 = Date.now();
  const pst = await get(`/pst?QRA=FM18av&__host=127.0.0.1&__port=${udp.port}`, proxyPort);
  const pstMs = Date.now() - t1;
  eq('pst status', pst.status, 200);
  ok('pst no udp stall', pstMs < 800, `took ${pstMs}ms`);
  ok('pst datagram', udp.msgs.length >= 2, `msgs=${udp.msgs.length}`);

  const dxk = await get(`/dxlab/dxkeeper/log?CALL=K1ABC&MODE=CW&FREQ=14.074&__host=127.0.0.1&__port=${tcp.port}`, proxyPort);
  eq('dxkeeper status', dxk.status, 200);
  eq('dxkeeper success', JSON.parse(dxk.body).success, 1);
  const dxkPayload = Buffer.concat(tcp.chunks).toString();
  ok('dxkeeper adif', /<command:\d+>log/i.test(dxkPayload), dxkPayload);

  const cmd = await get(`/dxlab/commander/CmdSetFreqMode?xcvrfreq=14074&xcvrmode=USB&preservesplitanddual=N&__host=127.0.0.1&__port=${tcp.port}`, proxyPort);
  eq('commander status', cmd.status, 200);

  const l32 = await get(`/logger32/log?CALL=K1ABC&MODE=CW&__host=127.0.0.1&__port=${tcp.port}`, proxyPort);
  eq('logger32 status', l32.status, 200);

  const aclog = await get(`/aclog/updateandlog?CALL=K1ABC&MODE=CW&FREQ=14.074&__host=127.0.0.1&__port=${tcp.port}`, proxyPort);
  eq('aclog official status', aclog.status, 200);

  const wd4 = await get(`/aclog/?01:<CMD><ACTION><VALUE>CLEAR</VALUE></CMD>&__host=127.0.0.1&__port=${tcp.port}`, proxyPort);
  eq('aclog wd4dan status', wd4.status, 200);

  const ping = await get(`/dxlab/dxkeeper/ping?__host=127.0.0.1&__port=${tcp.port}`, proxyPort);
  eq('tcp ping running', JSON.parse(ping.body).success, 1);

  const pingMiss = await get('/dxlab/dxkeeper/ping?__host=127.0.0.1&__port=1', proxyPort);
  eq('tcp ping down', JSON.parse(pingMiss.body).success, 0);

  const omni = await get('/omnirig/qsy?freq=7200000&mode=LSB', proxyPort);
  eq('omnirig linux status', omni.status, 500);
  ok('omnirig linux error', /Win32|Windows/i.test(JSON.parse(omni.body).data || JSON.parse(omni.body).error || ''), omni.body);

} finally {
  if (child && !child.killed) {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 200));
    try { child.kill('SIGKILL'); } catch (e) {}
  }
  udp.close();
  tcp.close();
}

if (fail.length) {
  console.error(fail.join('\n'));
  process.exit(1);
}
console.log('proxy-contract-test OK');
