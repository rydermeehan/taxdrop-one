import { describe, it, expect } from 'vitest';
import { isBlockedIp, assertPublicUrl, UNSUPPORTED_SCHEME } from './seo-analyze.js';

describe('isBlockedIp — SSRF address classification', () => {
  it('blocks the cloud metadata address and link-local range', () => {
    expect(isBlockedIp('169.254.169.254')).toBe(true);
    expect(isBlockedIp('169.254.0.1')).toBe(true);
  });

  it('blocks loopback (v4 + v6) and unspecified', () => {
    expect(isBlockedIp('127.0.0.1')).toBe(true);
    expect(isBlockedIp('127.255.255.255')).toBe(true);
    expect(isBlockedIp('::1')).toBe(true);
    expect(isBlockedIp('::')).toBe(true);
  });

  it('blocks RFC-1918 private ranges', () => {
    expect(isBlockedIp('10.0.0.5')).toBe(true);
    expect(isBlockedIp('172.16.0.1')).toBe(true);
    expect(isBlockedIp('172.31.255.255')).toBe(true);
    expect(isBlockedIp('192.168.1.1')).toBe(true);
  });

  it('blocks CGNAT, IPv4-mapped v6, unique-local + link-local v6', () => {
    expect(isBlockedIp('100.64.0.1')).toBe(true);
    expect(isBlockedIp('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedIp('::ffff:10.0.0.1')).toBe(true);
    expect(isBlockedIp('fc00::1')).toBe(true);
    expect(isBlockedIp('fd12:3456::1')).toBe(true);
    expect(isBlockedIp('fe80::1')).toBe(true);
  });

  it('allows genuine public addresses', () => {
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedIp('1.1.1.1')).toBe(false);
    expect(isBlockedIp('93.184.216.34')).toBe(false); // example.com
    expect(isBlockedIp('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
    expect(isBlockedIp('::ffff:8.8.8.8')).toBe(false);
  });

  it('blocks unparseable input', () => {
    expect(isBlockedIp('not-an-ip')).toBe(true);
  });
});

describe('assertPublicUrl', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow(UNSUPPORTED_SCHEME);
    await expect(assertPublicUrl('gopher://127.0.0.1/')).rejects.toThrow(UNSUPPORTED_SCHEME);
  });

  it('rejects an IP-literal host in a blocked range without a DNS lookup', async () => {
    await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow('blocked_host');
    await expect(assertPublicUrl('http://127.0.0.1:8080/')).rejects.toThrow('blocked_host');
    await expect(assertPublicUrl('http://[::1]/')).rejects.toThrow('blocked_host');
  });
});
