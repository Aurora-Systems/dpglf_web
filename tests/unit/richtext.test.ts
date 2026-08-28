import { describe, expect, it } from 'vitest';
import { htmlToText, sanitizeRichText, textToHtml } from '@/lib/richtext';

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
