import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

const ALLOWED_TAGS = [
  'p', 'br', 'em', 'i', 'strong', 'b', 'u', 's', 'del', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'span', 'a', 'q', 'table',
  'thead', 'tbody', 'tr', 'th', 'td', 'img',
];

/** Wraps "spoken lines" so themes can colour dialogue apart from narration. */
function markSpeech(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest('code, pre, q')) continue;
    if (/["“«].+?["”»]/s.test(node.data)) targets.push(node);
  }
  for (const node of targets) {
    const fragment = document.createDocumentFragment();
    const pattern = /(["“«][^"“”«»]+["”»])/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(node.data))) {
      if (match.index > lastIndex) {
        fragment.append(document.createTextNode(node.data.slice(lastIndex, match.index)));
      }
      const quote = document.createElement('span');
      quote.className = 'speech';
      quote.textContent = match[1];
      fragment.append(quote);
      lastIndex = match.index + match[1].length;
    }
    if (lastIndex < node.data.length) fragment.append(document.createTextNode(node.data.slice(lastIndex)));
    node.replaceWith(fragment);
  }
}

const cache = new Map<string, string>();

export function renderMarkdown(source: string): string {
  if (!source) return '';
  const cached = cache.get(source);
  if (cached !== undefined) return cached;

  const html = marked.parse(source, { async: false }) as string;
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'class', 'src', 'alt'],
    ALLOW_DATA_ATTR: false,
  });

  const holder = document.createElement('div');
  holder.innerHTML = clean;
  markSpeech(holder);
  holder.querySelectorAll('a').forEach((anchor) => {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noreferrer noopener');
  });

  const result = holder.innerHTML;
  if (cache.size > 400) cache.clear();
  cache.set(source, result);
  return result;
}
