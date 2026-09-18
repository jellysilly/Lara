export interface FetchedSource {
  title: string;
  text: string;
  url: string;
}

const MAX_LENGTH = 24000;

function tidy(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, MAX_LENGTH);
}

/** Strips reference markers and the tail sections nobody needs in a card. */
function cleanWikiText(text: string): string {
  const cutoff = text.search(
    /\n==+\s*(References|External links|See also|Further reading|Notes|Bibliography|Примечания|Ссылки|См\. также|Литература|Источники)\s*==+/i,
  );
  const body = cutoff > 0 ? text.slice(0, cutoff) : text;
  return tidy(body.replace(/\[\d+\]/g, '').replace(/^==+\s*(.+?)\s*==+$/gm, '\n$1\n'));
}

async function mediaWiki(origin: string, apiPath: string, title: string): Promise<FetchedSource | null> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    exsectionformat: 'plain',
    redirects: '1',
    format: 'json',
    origin: '*',
    titles: title,
  });
  const response = await fetch(`${origin}${apiPath}?${params}`);
  if (!response.ok) return null;
  const data = await response.json();
  const pages = data?.query?.pages ?? {};
  const page = Object.values(pages)[0] as { title?: string; extract?: string } | undefined;
  if (!page?.extract) return null;
  return { title: page.title ?? title, text: cleanWikiText(page.extract), url: `${origin}/wiki/${title}` };
}

function extractFromHtml(html: string, url: string): FetchedSource {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, nav, header, footer, aside, noscript, form, .reference, .navbox').forEach((node) =>
    node.remove(),
  );
  const main =
    doc.querySelector('#mw-content-text') ??
    doc.querySelector('article') ??
    doc.querySelector('main') ??
    doc.body;
  const title = doc.querySelector('h1')?.textContent?.trim() || doc.title || url;
  return { title, text: tidy(main?.textContent ?? ''), url };
}

/**
 * Pulls readable text out of a link. MediaWiki sites (Wikipedia, Fandom and
 * friends) answer CORS requests directly; anything else needs the optional
 * proxy from settings.
 */
export async function fetchSource(rawUrl: string, corsProxy = ''): Promise<FetchedSource> {
  const url = new URL(rawUrl.trim());
  const wikiMatch = url.pathname.match(/\/wiki\/(.+)$/);

  if (wikiMatch) {
    const title = decodeURIComponent(wikiMatch[1]).replace(/_/g, ' ');
    for (const apiPath of ['/w/api.php', '/api.php']) {
      try {
        const result = await mediaWiki(url.origin, apiPath, title);
        if (result) return result;
      } catch {
        /* fall through to the next candidate */
      }
    }
  }

  const attempts = [rawUrl, corsProxy ? `${corsProxy}${encodeURIComponent(rawUrl)}` : ''].filter(Boolean);
  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt, { headers: { Accept: 'text/html,application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      const source = extractFromHtml(body, rawUrl);
      if (source.text.length > 80) return source;
      throw new Error('The page had no readable text');
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not fetch that page');
}
