/**
 * Minimal robots.txt support: groups for our bot name or "*", Allow/Disallow
 * with longest-match precedence and "*" / "$" wildcards, plus Sitemap lines.
 */
export interface Robots {
  isAllowed(pathWithQuery: string): boolean;
  sitemaps: string[];
}

interface Rule {
  allow: boolean;
  pattern: string;
}

const BOT_TOKEN = 'reelwisebot';

function toRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

export function parseRobots(text: string): Robots {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  const sitemaps: string[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      // An empty Disallow means "allow everything".
      if (value) current.rules.push({ allow: key === 'allow', pattern: value });
    }
  }

  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && BOT_TOKEN.includes(a.replace(/\/.*$/, ''))));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  const rules = chosen.flatMap((g) => g.rules).map((r) => ({ ...r, re: toRegex(r.pattern) }));

  return {
    sitemaps,
    isAllowed(path: string) {
      let best: (Rule & { re: RegExp }) | null = null;
      for (const rule of rules) {
        if (!rule.re.test(path)) continue;
        if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) {
          best = rule;
        }
      }
      return best ? best.allow : true;
    },
  };
}

export const allowAll: Robots = { isAllowed: () => true, sitemaps: [] };
