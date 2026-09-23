import sanitizeHtml from 'sanitize-html';

/**
 * All authored HTML — news posts, policy pages, competition rules, story text
 * converted from a manuscript — passes through here before it is stored and
 * again is only ever rendered from a sanitised column. Admins are trusted, but
 * a compromised admin session should not become stored XSS on the public site.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote', 'hr',
  'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'figure', 'figcaption', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'pre', 'sup', 'sub', 'span',
];

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      span: ['class'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan', 'scope'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      // Outbound links open safely; rel closes the reverse-tabnabbing hole.
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: 'noopener noreferrer nofollow' },
      }),
    },
    // Word and Google Docs paste leaves runs of empty paragraphs behind.
    exclusiveFilter: (frame) =>
      frame.tag === 'p' && !frame.text.trim() && !frame.mediaChildren.length,
  });
}

/** Convert a manuscript's plain text into simple paragraph HTML. */
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Strip tags for excerpts, search snippets, meta descriptions and the Emoworld
 * payload. Block boundaries become spaces (otherwise the last word of one
 * paragraph fuses with the first of the next) and entities are decoded, since
 * the result is treated as plain text everywhere it is used.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/blockquote|\/tr|\/div|\/figcaption)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A complete tag from the allow-list, e.g. `<sup>`, `</a>`, `<a href="…">`. Only
 * that counts as the author writing HTML on purpose; prose such as `if a<b` or
 * `<a.moyo@example.org>` stays plain text and is escaped, not eaten.
 */
const AUTHORED_HTML = new RegExp(`<\\/?(?:${ALLOWED_TAGS.join('|')})(?:\\s[^<>]*)?\\/?>`, 'i');

/** A block that already carries its own block-level markup. */
const BLOCK_START = /^<\/?(?:p|h[2-4]|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|figure|figcaption|hr|pre)\b/i;

/** Elements a blank line can fall inside without ending them. */
const CONTAINERS = ['pre', 'blockquote', 'ul', 'ol', 'li', 'table', 'figure'];

function leavesContainerOpen(html: string): boolean {
  return CONTAINERS.some(
    (tag) =>
      (html.match(new RegExp(`<${tag}\\b`, 'gi'))?.length ?? 0) >
      (html.match(new RegExp(`</${tag}\\s*>`, 'gi'))?.length ?? 0),
  );
}

/**
 * An article body as typed into the admin form. Plain writing is the default (a
 * blank line starts a new paragraph); anyone who wants headings, links or lists
 * can use basic HTML instead. Either way the stored result is sanitised, and
 * blank lines keep meaning "new paragraph" even in a body with a stray link or
 * <strong> in it.
 */
export function articleToHtml(input: string): string {
  if (!AUTHORED_HTML.test(input)) return textToHtml(input);
  // A blank line inside an open <pre>, list or quote does not end it: keep
  // joining chunks until the element closes, then decide how to wrap.
  const blocks: string[] = [];
  for (const chunk of input.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const last = blocks.length - 1;
    if (last >= 0 && leavesContainerOpen(blocks[last])) blocks[last] += `\n\n${chunk}`;
    else blocks.push(chunk);
  }
  const html = blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => (BLOCK_START.test(block) ? block : `<p>${block.replace(/\n/g, '<br>')}</p>`))
    .join('\n');
  return sanitizeRichText(html);
}

/**
 * The reverse, for the edit form. A body that is nothing but paragraphs and line
 * breaks (the shape `articleToHtml` gives plain writing) goes back to plain
 * text, so an article written without HTML is edited without it. A body with
 * any richer markup is returned as HTML, untouched.
 */
export function htmlToArticle(html: string): string {
  if (/<(?!\/?p>|br\s*\/?>)/i.test(html)) return html;
  const text = html
    .split(/<\/p>/i)
    .map((block) =>
      block
        .replace(/<p>/gi, '')
        // Raw newlines inside a paragraph render as spaces; only <br> is a break.
        // HTML whitespace only: a non-breaking space (U+00A0) is kept.
        .replace(/[ \t\n\r\f]+/g, ' ')
        .replace(/[ \t\n\r\f]*<br\s*\/?>[ \t\n\r\f]*/gi, '\n')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#0?39;|&apos;/gi, "'")
        // Last, so an escaped "&lt;" written by the author is not decoded twice.
        .replace(/&amp;/gi, '&')
        .trim(),
    )
    .filter(Boolean)
    .join('\n\n');
  // Escaped text that decodes into something tag-shaped (an article about
  // "<b>" tags, say) would be read back as real markup on the next save; such
  // a body is edited as HTML instead.
  return AUTHORED_HTML.test(text) ? html : text;
}
