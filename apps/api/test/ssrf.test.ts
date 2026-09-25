import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnalysisError } from '../src/crawler/errors.js';
import { FetchFailure, SafeFetcher } from '../src/crawler/fetcher.js';
import { assertPublicUrl, isBlockedIp, safeLookup } from '../src/crawler/ssrf.js';

describe('isBlockedIp', () => {
  it.each([
    '127.0.0.1',
    '127.8.8.8',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '100.64.0.1', // CGNAT
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    '::ffff:127.0.0.1', // IPv4-mapped loopback
    '::ffff:7f00:1', // same, hex form
    '::ffff:169.254.169.254',
    '64:ff9b::a9fe:a9fe', // NAT64-embedded metadata IP
    'not-an-ip',
  ])('blocks %s', (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(['8.8.8.8', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111'])('allows public %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });
});

describe('assertPublicUrl', () => {
  it.each([
    'http://localhost/',
    'http://LOCALHOST./',
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://2130706433/', // decimal IP → URL parser turns it into 127.0.0.1
    'http://0x7f.0.0.1/',
    'http://metadata.google.internal/',
    'http://printer.local/',
    'http://intranet/',
    'https://biz.com:8443/',
    'http://biz.com:22/',
    'ftp://biz.com/',
    'https://user:pw@biz.com/',
  ])('rejects %s', (url) => {
    expect(() => assertPublicUrl(new URL(url))).toThrow(AnalysisError);
  });

  it.each(['https://biz.com/', 'http://www.biz.co.uk/about', 'https://biz.com:443/', 'https://xn--caf-dma.fr/'])('accepts %s', (url) => {
    expect(() => assertPublicUrl(new URL(url))).not.toThrow();
  });
});

describe('safeLookup (connect-time DNS check)', () => {
  it('refuses hostnames that resolve to private addresses', async () => {
    const err = await new Promise<NodeJS.ErrnoException | null>((resolve) => safeLookup('localhost', { all: true }, (e) => resolve(e)));
    expect(err?.code).toBe('EBLOCKEDADDRESS');
  });
});

describe('SafeFetcher', () => {
  let server: http.Server;
  let port: number;
  beforeAll(async () => {
    server = http.createServer((_req, res) => res.end('<html>secret internal page</html>'));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('never reaches a service on the loopback interface', async () => {
    const fetcher = new SafeFetcher({ timeoutMs: 2000, maxBytes: 10_000, retries: 0 });
    for (const url of [`http://127.0.0.1:${port}/`, `http://localhost:${port}/`, 'http://localhost/']) {
      await expect(fetcher.fetch(url)).rejects.toMatchObject({ kind: 'unsafe' });
    }
  });

  it('reports unsafe failures as FetchFailure', async () => {
    const fetcher = new SafeFetcher({ timeoutMs: 2000, maxBytes: 10_000, retries: 0 });
    await expect(fetcher.fetch('http://169.254.169.254/latest/meta-data/')).rejects.toBeInstanceOf(FetchFailure);
  });
});
