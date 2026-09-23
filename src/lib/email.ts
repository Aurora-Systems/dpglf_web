import { Resend } from 'resend';
import { BRAND, SITE } from './brand';

/**
 * Transactional email via Resend.
 *
 * Sends are best effort: when Resend is unconfigured (or errors) we log and
 * return instead of breaking the calling flow — a writer's submission must not
 * fail because a receipt could not go out. `notify()` records the intent in the
 * database first, so an undelivered message is visible and retryable.
 */

const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || 'DPGLF <onboarding@resend.dev>';

const g = globalThis as unknown as { _dpgResend?: Resend };
const resend = API_KEY ? (g._dpgResend ??= new Resend(API_KEY)) : null;

export function isEmailConfigured(): boolean {
  return Boolean(API_KEY);
}

export interface SendResult {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<SendResult> {
  if (!resend) {
    console.log(`[email:skipped] to=${opts.to} subject="${opts.subject}" (RESEND_API_KEY not set)`);
    return { ok: false, skipped: true };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: stripHtml(opts.html),
      replyTo: opts.replyTo,
    });
    if (error) {
      console.error(`[email:error] ${opts.to}: ${error.message}`);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    const message = (e as Error).message;
    console.error(`[email:throw] ${opts.to}: ${message}`);
    return { ok: false, error: message };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|tr|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Absolute URL — email clients cannot resolve app-relative paths. */
export function abs(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE.url}${path.startsWith('/') ? '' : '/'}${path}`;
}

// ---- branded layout -------------------------------------------------------------

const FOREST = '#0c1c16';
const GOLD = '#c9a063';
const BONE = '#f6f1e7';

function layout(body: string, preheader = ''): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(SITE.shortName)}</title></head>
<body style="margin:0;padding:0;background:${BONE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#14201b;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BONE};padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3ded1;border-radius:14px;overflow:hidden;">
    <tr><td style="background:${FOREST};padding:26px 28px;text-align:center;">
      <img src="${abs(BRAND.markSm)}" width="56" height="56" alt="" style="display:block;margin:0 auto 10px;border:0;">
      <div style="color:${BONE};font-size:15px;font-weight:600;letter-spacing:.02em;">Dr. Phillip Gwatidzo Literary Foundation</div>
      <div style="color:${GOLD};font-size:11px;letter-spacing:.16em;text-transform:uppercase;margin-top:6px;">${esc(SITE.tagline)}</div>
    </td></tr>
    <tr><td style="padding:30px 28px 8px;">${body}</td></tr>
    <tr><td style="padding:18px 28px 26px;border-top:1px solid #f0ece1;color:#5b6b63;font-size:12px;line-height:1.6;">
      You are receiving this message because of your involvement with a DPGLF programme.<br>
      <a href="${abs('/contact')}" style="color:${'#8a6a2f'};">Contact the Foundation</a> &nbsp;·&nbsp;
      <a href="${abs('/policies/privacy')}" style="color:#8a6a2f;">Privacy notice</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;font-weight:600;color:${FOREST};">${esc(text)}</h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#2b3a33;">${text}</p>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;"><tr>
    <td style="background:${FOREST};border-radius:8px;">
      <a href="${esc(href)}" style="display:inline-block;padding:12px 22px;color:${BONE};font-size:14px;font-weight:600;text-decoration:none;">${esc(label)}</a>
    </td></tr></table>`;
}

function facts(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border:1px solid #e9e4d7;border-radius:10px;overflow:hidden;">
    ${rows
      .map(
        ([k, v], i) =>
          `<tr style="background:${i % 2 ? '#ffffff' : '#faf7f0'}">
             <td style="padding:9px 14px;font-size:12.5px;color:#5b6b63;width:42%;">${esc(k)}</td>
             <td style="padding:9px 14px;font-size:13.5px;color:#14201b;font-weight:600;">${esc(v)}</td>
           </tr>`,
      )
      .join('')}
  </table>`;
}

// ---- templates -------------------------------------------------------------------
// One function per trigger in the implementation plan's notification table.

export const templates = {
  verifyEmail: (name: string, link: string) => ({
    subject: 'Confirm your DPGLF account',
    html: layout(
      h1(`Welcome${name ? `, ${esc(name)}` : ''}`) +
        p('Confirm your email address to activate your Foundation account and start a submission.') +
        button('Confirm my email', link) +
        p(
          `<span style="color:#5b6b63;font-size:13px;">This link expires in 24 hours. If you did not create an account, you can ignore this message.</span>`,
        ),
      'Confirm your email to activate your DPGLF account.',
    ),
  }),

  resetPassword: (name: string, link: string) => ({
    subject: 'Reset your DPGLF password',
    html: layout(
      h1('Reset your password') +
        p(`Hello${name ? ` ${esc(name)}` : ''}, use the button below to choose a new password.`) +
        button('Choose a new password', link) +
        p(
          `<span style="color:#5b6b63;font-size:13px;">This link expires in one hour and can be used once. If you did not request it, no action is needed.</span>`,
        ),
      'Reset your DPGLF password.',
    ),
  }),

  submissionReceipt: (o: {
    name: string;
    title: string;
    reference: string;
    competition: string;
    submittedAt: string;
    link: string;
  }) => ({
    subject: `Submission received: ${o.reference}`,
    html: layout(
      h1('Your story has been received') +
        p(
          `Thank you${o.name ? `, ${esc(o.name)}` : ''}. Your entry is now with the Foundation. Please keep the reference below. It identifies your submission in all correspondence.`,
        ) +
        facts([
          ['Reference', o.reference],
          ['Story', o.title],
          ['Programme', o.competition],
          ['Received', o.submittedAt],
        ]) +
        p('You can follow the status of your submission at any time from your dashboard.') +
        button('View my submission', o.link),
      `Submission ${o.reference} received.`,
    ),
  }),

  guardianConsent: (o: { guardian: string; writer: string; link: string; competition: string }) => ({
    subject: `Consent needed for ${o.writer}’s story entry`,
    html: layout(
      h1('A young writer has named you as their guardian') +
        p(
          `${esc(o.writer)} would like to enter <strong>${esc(o.competition)}</strong>, a programme of the Dr. Phillip Gwatidzo Literary Foundation. Because they are under eighteen, we need your consent before the entry can be considered.`,
        ) +
        p(
          'The consent page explains what we collect, how the story may be used, and how you can withdraw consent later.',
        ) +
        button('Review and give consent', o.link) +
        p(
          `<span style="color:#5b6b63;font-size:13px;">If you were not expecting this, please <a href="${abs('/contact')}" style="color:#8a6a2f;">tell us</a> and we will remove the request.</span>`,
        ),
      `${o.writer} needs guardian consent to enter ${o.competition}.`,
    ),
  }),

  deadlineReminder: (o: { name: string; competition: string; closesAt: string; link: string }) => ({
    subject: `${o.competition} closes ${o.closesAt}`,
    html: layout(
      h1('Your draft is not submitted yet') +
        p(
          `Hello${o.name ? ` ${esc(o.name)}` : ''}, you have an unfinished entry for <strong>${esc(o.competition)}</strong>. Entries close on ${esc(o.closesAt)} and drafts cannot be submitted after that.`,
        ) +
        button('Finish my submission', o.link),
      `${o.competition} closes ${o.closesAt}.`,
    ),
  }),

  judgeAssignment: (o: { name: string; count: number; dueAt: string; link: string }) => ({
    subject: `${o.count} submission${o.count === 1 ? '' : 's'} assigned for review`,
    html: layout(
      h1('New review assignment') +
        p(
          `Hello${o.name ? ` ${esc(o.name)}` : ''}, ${o.count} submission${o.count === 1 ? ' has' : 's have'} been assigned to you for scoring.`,
        ) +
        facts([
          ['Assigned', String(o.count)],
          ['Due by', o.dueAt],
        ]) +
        p(
          'Please declare a conflict of interest on any entry you recognise rather than scoring it.',
        ) +
        button('Open my review queue', o.link),
      'You have new submissions to review.',
    ),
  }),

  statusChange: (o: { name: string; title: string; reference: string; status: string; note: string; link: string }) => ({
    subject: `Update on ${o.reference}: ${o.status}`,
    html: layout(
      h1('There is an update on your submission') +
        facts([
          ['Story', o.title],
          ['Reference', o.reference],
          ['New status', o.status],
        ]) +
        (o.note ? p(esc(o.note)) : '') +
        button('View details', o.link),
      `${o.reference} is now ${o.status}.`,
    ),
  }),

  shortlistDecision: (o: { name: string; title: string; selected: boolean; note: string; link: string }) => ({
    subject: o.selected ? 'Your story has been shortlisted' : 'Outcome of your DPGLF submission',
    html: layout(
      h1(o.selected ? 'Congratulations, you have been shortlisted' : 'Thank you for your submission') +
        p(
          o.selected
            ? `Hello${o.name ? ` ${esc(o.name)}` : ''}, <strong>${esc(o.title)}</strong> has been shortlisted. The next stage is mentorship, where you will work with an established writer or editor on your story.`
            : `Hello${o.name ? ` ${esc(o.name)}` : ''}, <strong>${esc(o.title)}</strong> has not been selected this time. Judging was close and we hope you will enter again. Every entry is read in full.`,
        ) +
        (o.note ? p(esc(o.note)) : '') +
        button('View my submission', o.link),
      o.selected ? 'You have been shortlisted.' : 'Your submission outcome.',
    ),
  }),

  mentorIntroduction: (o: { recipient: string; writer: string; mentor: string; title: string; link: string }) => ({
    subject: `Mentorship pairing: ${o.writer} and ${o.mentor}`,
    html: layout(
      h1('Your mentorship has started') +
        p(
          `Hello${o.recipient ? ` ${esc(o.recipient)}` : ''}, <strong>${esc(o.writer)}</strong> has been paired with <strong>${esc(o.mentor)}</strong> to develop <em>${esc(o.title)}</em>.`,
        ) +
        p(
          'Work happens in the platform: revisions are uploaded as new versions and feedback stays on the story so nothing is lost between drafts.',
        ) +
        button('Open the mentorship', o.link),
      'Your mentorship pairing is ready.',
    ),
  }),

  revisionRequested: (o: { name: string; title: string; note: string; link: string }) => ({
    subject: `Revision requested: ${o.title}`,
    html: layout(
      h1('Your mentor has requested a revision') +
        p(`Hello${o.name ? ` ${esc(o.name)}` : ''}, there is new feedback on <strong>${esc(o.title)}</strong>.`) +
        (o.note ? p(`<em>${esc(o.note)}</em>`) : '') +
        button('Read the feedback', o.link),
      'New feedback on your story.',
    ),
  }),

  publicationApproved: (o: { name: string; title: string; link: string }) => ({
    subject: `${o.title} is approved for publication`,
    html: layout(
      h1('Approved for publication') +
        p(
          `Hello${o.name ? ` ${esc(o.name)}` : ''}, <strong>${esc(o.title)}</strong> has been approved for publication. The Foundation will be in touch about publication details and any agreements that apply.`,
        ) +
        p(
          'You keep copyright in your story. Any licence the Foundation holds is recorded separately and shared with you before publication.',
        ) +
        button('View my story', o.link),
      'Your story is approved for publication.',
    ),
  }),

  adminAlert: (o: { title: string; lines: [string, string][]; body: string; link: string }) => ({
    subject: o.title,
    html: layout(h1(o.title) + (o.body ? p(esc(o.body)) : '') + facts(o.lines) + button('Open in admin', o.link), o.title),
  }),

  contactAck: (o: { name: string; subject: string }) => ({
    subject: 'We have your message',
    html: layout(
      h1('Thank you for getting in touch') +
        p(
          `Hello${o.name ? ` ${esc(o.name)}` : ''}, we have received your message${o.subject ? ` about “${esc(o.subject)}”` : ''} and someone from the Foundation will reply.`,
        ),
      'We have received your message.',
    ),
  }),

  newsletterConfirm: (o: { link: string }) => ({
    subject: 'Confirm your DPGLF newsletter subscription',
    html: layout(
      h1('One more step') +
        p('Confirm your subscription to receive calls for submissions, anthology news and Foundation updates.') +
        button('Confirm subscription', o.link),
      'Confirm your newsletter subscription.',
    ),
  }),
};
