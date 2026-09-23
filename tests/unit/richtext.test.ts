import { describe, expect, it } from 'vitest';
import { articleToHtml, htmlToArticle, htmlToText, sanitizeRichText, textToHtml } from '@/lib/richtext';

/**
 * Authored HTML reaches the public site, so the sanitiser is a security
 * boundary: a compromised admin session must not become stored XSS.
 */
describe('sanitizeRichText', () => {
  it('strips script tags and event handlers', () => {
    const out = sanitizeRichText('<p onclick="steal()">hi</p><script>alert(1)</script>');
    expect(out).toContain('<p>hi</p>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('onclick');
  });

  it('neutralises javascript: URLs', () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain('javascript:');
  });

  it('hardens outbound links against reverse tabnabbing', () => {
    const out = sanitizeRichText('<a href="https://example.org">x</a>');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });

  it('keeps the formatting vocabulary an editor actually needs', () => {
    const input = '<h2>T</h2><blockquote>q</blockquote><ul><li>a</li></ul><strong>b</strong>';
    expect(sanitizeRichText(input)).toBe(input);
  });

  it('drops the empty paragraphs word-processor paste leaves behind', () => {
    expect(sanitizeRichText('<p>keep</p><p>  </p><p></p>')).toBe('<p>keep</p>');
  });
});

describe('manuscript text conversion', () => {
  it('turns plain text into escaped paragraph HTML', () => {
    const html = textToHtml('First paragraph.\n\nSecond <unsafe> & fine.');
    expect(html).toBe('<p>First paragraph.</p>\n<p>Second &lt;unsafe&gt; &amp; fine.</p>');
  });

  it('round-trips back to readable text', () => {
    expect(htmlToText('<p>One</p><p>Two &amp; three</p>')).toBe('One Two & three');
  });
});

describe('article bodies', () => {
  it('turns plain writing into paragraphs, escaping anything that looks like markup', () => {
    expect(articleToHtml('First paragraph.\nSame paragraph.\n\nSecond & last < 3')).toBe(
      '<p>First paragraph.<br>Same paragraph.</p>\n<p>Second &amp; last &lt; 3</p>',
    );
  });

  it('sanitises an article written in HTML instead of escaping it', () => {
    const html = articleToHtml('<h2>Results</h2><p>See <a href="https://gwatidzo.me">the list</a>.</p><script>x()</script>');
    expect(html).toContain('<h2>Results</h2>');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).not.toContain('<script');
  });

  it('round-trips plain writing through the edit form', () => {
    const text = 'Entries are open.\nClosing soon.\n\nWrite about "home" & <family>.';
    expect(htmlToArticle(articleToHtml(text))).toBe(text);
  });

  it('leaves richer HTML as HTML for editing', () => {
    const html = '<h2>Results</h2><p>Well done.</p>';
    expect(htmlToArticle(html)).toBe(html);
  });
});

describe('article bodies: edge cases', () => {
  it('keeps paragraphs when a plain article gains a link or bold word', () => {
    const html = articleToHtml('First.\n\nSecond with a <a href="https://x.org">link</a>.\n\nThird <strong>bold</strong>.');
    expect(html).toBe(
      '<p>First.</p>\n<p>Second with a <a href="https://x.org" rel="noopener noreferrer nofollow">link</a>.</p>\n<p>Third <strong>bold</strong>.</p>',
    );
  });

  it('treats prose that merely looks like markup as text, not tags', () => {
    expect(articleToHtml('if a<b then x')).toBe('<p>if a&lt;b then x</p>');
    expect(articleToHtml('Write to <a.moyo@example.org>.')).toBe('<p>Write to &lt;a.moyo@example.org&gt;.</p>');
  });

  it('recognises every allowed tag, not only a few', () => {
    expect(articleToHtml('Our 1<sup>st</sup> place winner')).toBe('<p>Our 1<sup>st</sup> place winner</p>');
  });

  it('does not turn source line-wrapping inside a paragraph into hard breaks', () => {
    const stored = '<p>The Foundation is built on a simple observation: writing should be a profession, not only\n       a hobby.</p>';
    expect(htmlToArticle(stored)).toBe(
      'The Foundation is built on a simple observation: writing should be a profession, not only a hobby.',
    );
  });
});

describe('article bodies: containers and entities', () => {
  it('keeps a blank line inside <pre> or a list as part of that element', () => {
    const html = articleToHtml('Intro.\n\n<pre>line one\n\nline three</pre>\n\n<ul><li>one</li>\n\n<li>two</li></ul>');
    expect(html).toContain('<pre>line one\n\nline three</pre>');
    expect(html).toContain('<ul><li>one</li>\n\n<li>two</li></ul>');
    expect(html).not.toMatch(/<pre>[^]*<p>/);
  });

  it('keeps non-breaking spaces when an article is reopened', () => {
    expect(htmlToArticle('<p>10\u00a0km</p>')).toBe('10\u00a0km');
  });

  it('keeps escaped tag-shaped text as HTML, so a save cannot turn it into markup', () => {
    const stored = '<p>Use the &lt;b&gt; tag for bold.</p>';
    expect(htmlToArticle(stored)).toBe(stored);
  });
});
