import dns from 'node:dns';
import net from 'node:net';

import { AnalysisError } from './errors.js';

/**
 * SSRF protection.
 *
 * Two layers:
 * 1. `assertPublicUrl` — static checks before any request: http(s) only,
 *    default ports only, no IP literals, no localhost / internal names.
 * 2. `safeLookup` — plugged into the socket connector, so the IP address we
 *    actually connect to is checked *at connect time*. That blocks DNS names
 *    that resolve to private ranges and DNS-rebinding tricks. Redirect targets
 *    go through both layers again.
 */

const blocked = new net.BlockList();
// IPv4
for (const [addr, prefix] of [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local incl. cloud metadata 169.254.169.254
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.88.99.0', 24], // 6to4 relay
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
] as const) {
  blocked.addSubnet(addr, prefix, 'ipv4');
}
// IPv6
for (const [addr, prefix] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['64:ff9b::', 96], // NAT64 (embeds IPv4 — checked separately too)
  ['100::', 64], // discard
  ['2001:db8::', 32], // documentation
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
  ['fec0::', 10], // deprecated site-local
] as const) {
  blocked.addSubnet(addr, prefix, 'ipv6');
}

/** Extract an embedded IPv4 from ::ffff:a.b.c.d, ::a.b.c.d or 64:ff9b::a.b.c.d forms. */
function embeddedIpv4(ip: string): string | null {
  const dotted = ip.match(/^(?:::ffff:|::|64:ff9b::)(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (dotted) return dotted[1];
  const hex = ip.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hex) {
    const hi = Number.parseInt(hex[1], 16);
    const lo = Number.parseInt(hex[2], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return null;
}

export function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return blocked.check(ip, 'ipv4');
  if (family === 6) {
    const v4 = embeddedIpv4(ip.toLowerCase());
    if (v4) return isBlockedIp(v4);
    return blocked.check(ip, 'ipv6');
  }
  return true; // not an IP at all → refuse
}

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet', '.lan', '.home', '.corp', '.localdomain', '.home.arpa'];

/** Static URL checks. Throws `unsafe_url`. */
export function assertPublicUrl(url: URL): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AnalysisError('unsafe_url', 'Only http and https websites can be analyzed.');
  }
  if (url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443'))) {
    throw new AnalysisError('unsafe_url', 'Websites on non-standard ports can’t be analyzed.');
  }
  if (url.username || url.password) throw new AnalysisError('unsafe_url', 'URLs with credentials aren’t allowed.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('[') || net.isIP(host)) {
    throw new AnalysisError('unsafe_url', 'Please use the website’s domain name, not an IP address.');
  }
  if (host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s)) || !host.includes('.')) {
    throw new AnalysisError('unsafe_url', 'That address isn’t a public website.');
  }
  if (!/^([a-z0-9-]+\.)+[a-z][a-z0-9-]*[a-z0-9]$/.test(host) && !/^([a-z0-9-]+\.)+xn--[a-z0-9-]+$/.test(host)) {
    throw new AnalysisError('unsafe_url', 'That address isn’t a public website.');
  }
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

/**
 * Drop-in replacement for dns.lookup used by the HTTP connector. Resolves all
 * addresses and refuses the connection if ANY of them is private/reserved.
 */
export function safeLookup(hostname: string, options: dns.LookupOptions | undefined, callback: LookupCallback): void {
  const opts = options ?? {};
  dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => isBlockedIp(a.address));
    if (!list.length || bad) {
      const e = new Error(`Blocked address for ${hostname}`) as NodeJS.ErrnoException;
      e.code = 'EBLOCKEDADDRESS';
      return callback(e, '');
    }
    if (opts.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}
