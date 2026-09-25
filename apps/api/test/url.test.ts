import { describe, expect, it } from 'vitest';

import { AnalysisError } from '../src/crawler/errors.js';
import { canonicalKey, isSameSite, looksLikeHtmlPage, normalizeInputUrl, resolveLink } from '../src/crawler/url.js';

describe('normalizeInputUrl', () => {
  it.each([
    ['mybiz.com', 'https://mybiz.com/'],
    ['  www.MyBiz.com/About  ', 'https://www.mybiz.com/About'],
    ['http://mybiz.com', 'http://mybiz.com/'],
    ['HTTPS://MYBIZ.COM/#top', 'https://mybiz.com/'],
    ['mybiz.co.uk/services?x=1', 'https://mybiz.co.uk/services?x=1'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeInputUrl(input).toString()).toBe(expected);
  });

  it.each(['', '   ', 'not a url', 'ftp://mybiz.com', 'javascript:alert(1)', 'https://user:pass@mybiz.com', 'file:///etc/passwd'])('rejects %j', (input) => {
    expect(() => normalizeInputUrl(input)).toThrow(AnalysisError);
  });
});

describe('canonicalKey (duplicate detection)', () => {
  it('treats www/non-www, http/https, trailing slashes, index files, fragments and tracking params as the same page', () => {
    const variants = [
      'https://www.biz.com/about',
      'http://biz.com/about/',
      'https://biz.com/about?utm_source=nav&utm_medium=x',
      'https://biz.com/about#team',
      'https://biz.com/about?fbclid=abc',
    ];
    expect(new Set(variants.map(canonicalKey)).size).toBe(1);
    expect(canonicalKey('https://biz.com/index.html')).toBe(canonicalKey('https://www.biz.com/'));
  });

  it('keeps meaningful query params and sorts them', () => {
    expect(canonicalKey('https://biz.com/menu?b=2&a=1')).toBe('biz.com/menu?a=1&b=2');
    expect(canonicalKey('https://biz.com/menu?a=1')).not.toBe(canonicalKey('https://biz.com/menu'));
  });
});

describe('resolveLink / isSameSite', () => {
  it('resolves relative links and drops non-http schemes', () => {
    expect(resolveLink('../services/', 'https://biz.com/about/team')?.toString()).toBe('https://biz.com/services/');
    expect(resolveLink('/contact?utm_campaign=x#form', 'https://biz.com/')?.toString()).toBe('https://biz.com/contact');
    for (const href of ['mailto:a@b.com', 'tel:+1555', 'javascript:void(0)', '#top', '', 'data:text/html,hi']) {
      expect(resolveLink(href, 'https://biz.com/')).toBeNull();
    }
  });

  it('matches only the same site (www-insensitive)', () => {
    expect(isSameSite('https://www.biz.com/a', 'http://biz.com/b')).toBe(true);
    expect(isSameSite('https://shop.biz.com', 'https://biz.com')).toBe(false);
    expect(isSameSite('https://facebook.com/biz', 'https://biz.com')).toBe(false);
  });

  it('skips obvious non-HTML files', () => {
    expect(looksLikeHtmlPage(new URL('https://biz.com/menu.pdf'))).toBe(false);
    expect(looksLikeHtmlPage(new URL('https://biz.com/logo.PNG'))).toBe(false);
    expect(looksLikeHtmlPage(new URL('https://biz.com/services'))).toBe(true);
  });
});
