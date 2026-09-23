'use server';

import { query, queryOne } from '@/lib/db';
import { clientIp } from '@/lib/auth';
import { SITE } from '@/lib/brand';
import { randomToken, sha256Hex } from '@/lib/crypto';
import { templates, abs } from '@/lib/email';
import { notify } from '@/lib/notify';
import { rateLimitIp } from '@/lib/ratelimit';
import { contactSchema, inquirySchema, newsletterSchema } from '@/lib/validation';
import { fail, invalid, ok, str, type ActionState } from '@/lib/actions';

/** Public-facing forms: newsletter, contact and partner/producer inquiries. */

export async function subscribeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  // A filled honeypot is a bot; answer as if it worked so it stops retrying.
  if (str(form, 'website')) return ok('Thank you. Please check your inbox to confirm.');

  const limit = await rateLimitIp('newsletter');
  if (!limit.ok) return fail('Too many attempts. Please try again later.');

  const parsed = newsletterSchema.safeParse({
    email: str(form, 'email'),
    name: str(form, 'name'),
  });
  if (!parsed.success) return invalid(parsed.error);

  const token = randomToken(24);
  const row = await queryOne<{ id: string; status: string }>(
    `INSERT INTO newsletter_subscribers (email, name, source, token_hash)
     VALUES ($1, $2, 'site', $3)
     ON CONFLICT (lower(email)) DO UPDATE
        SET name = COALESCE(NULLIF(EXCLUDED.name, ''), newsletter_subscribers.name),
            token_hash = EXCLUDED.token_hash,
            status = CASE WHEN newsletter_subscribers.status = 'unsubscribed'
                          THEN 'pending' ELSE newsletter_subscribers.status END,
            unsubscribed_at = NULL
     RETURNING id, status`,
    [parsed.data.email, parsed.data.name ?? '', await sha256Hex(token)],
  );

  // Double opt-in: nobody joins a send list without confirming.
  if (row && row.status !== 'confirmed') {
    const t = templates.newsletterConfirm({ link: abs(`/newsletter/confirm?token=${token}`) });
    await notify({
      toEmail: parsed.data.email,
      type: 'newsletter_confirm',
      subject: t.subject,
      html: t.html,
      dedupeKey: `newsletter_confirm:${row.id}:${token.slice(0, 8)}`,
    });
  }

  return ok('Thank you. Please check your inbox to confirm your subscription.');
}

export async function contactAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (str(form, 'website')) return ok('Thank you. Your message has been sent.');

  const limit = await rateLimitIp('contact');
  if (!limit.ok) return fail('Too many messages from this connection. Please try again later.');

  const parsed = contactSchema.safeParse({
    name: str(form, 'name'),
    email: str(form, 'email'),
    organisation: str(form, 'organisation'),
    topic: str(form, 'topic') || 'general',
    subject: str(form, 'subject'),
    message: str(form, 'message'),
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const row = await queryOne<{ id: string }>(
    `INSERT INTO contact_messages (name, email, organisation, topic, subject, message, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [d.name, d.email, d.organisation ?? '', d.topic, d.subject ?? '', d.message, await clientIp()],
  );

  const alert = templates.adminAlert({
    title: `Contact form: ${d.topic}`,
    body: d.message,
    lines: [
      ['From', `${d.name} <${d.email}>`],
      ['Organisation', d.organisation || 'Not given'],
      ['Subject', d.subject || 'Not given'],
    ],
    link: abs('/dashboard/admin/messages'),
  });
  await notify({
    toEmail: SITE.inbox,
    type: 'contact_received',
    subject: alert.subject,
    html: alert.html,
    dedupeKey: `contact:${row?.id}`,
    replyTo: d.email,
  });

  const ack = templates.contactAck({ name: d.name, subject: d.subject ?? '' });
  await notify({
    toEmail: d.email,
    type: 'contact_ack',
    subject: ack.subject,
    html: ack.html,
    dedupeKey: `contact_ack:${row?.id}`,
  });

  return ok('Thank you. Your message is with the Foundation and someone will reply.');
}

export async function inquiryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (str(form, 'website')) return ok('Thank you. Your enquiry has been received.');

  const limit = await rateLimitIp('inquiry');
  if (!limit.ok) return fail('Too many enquiries from this connection. Please try again later.');

  const parsed = inquirySchema.safeParse({
    storyId: str(form, 'storyId'),
    requesterName: str(form, 'requesterName'),
    requesterEmail: str(form, 'requesterEmail'),
    requesterRole: str(form, 'requesterRole'),
    organisation: str(form, 'organisation'),
    format: str(form, 'format') || 'other',
    message: str(form, 'message'),
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  // Match a known partner organisation by name so the IP team sees the history.
  const org = d.organisation
    ? await queryOne<{ id: string }>(`SELECT id FROM organisations WHERE lower(name) = lower($1)`, [
        d.organisation,
      ])
    : null;

  const row = await queryOne<{ id: string }>(
    `INSERT INTO adaptation_inquiries
       (story_id, organisation_id, requester_name, requester_email, requester_role, format, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      d.storyId || null,
      org?.id ?? null,
      d.requesterName,
      d.requesterEmail,
      d.requesterRole ?? '',
      d.format,
      d.message,
    ],
  );

  const story = d.storyId
    ? await queryOne<{ title: string }>(`SELECT title FROM stories WHERE id = $1`, [d.storyId])
    : null;

  const alert = templates.adminAlert({
    title: 'New rights / adaptation enquiry',
    body: d.message,
    lines: [
      ['Story', story?.title ?? 'General enquiry'],
      ['From', `${d.requesterName} <${d.requesterEmail}>`],
      ['Organisation', d.organisation || 'Not given'],
      ['Format', d.format],
    ],
    link: abs('/dashboard/admin/inquiries'),
  });
  await notify({
    toEmail: SITE.inbox,
    type: 'inquiry_received',
    subject: alert.subject,
    html: alert.html,
    dedupeKey: `inquiry:${row?.id}`,
    replyTo: d.requesterEmail,
  });

  return ok('Thank you. The Foundation’s IP team will be in touch.');
}

/** Confirms a double opt-in newsletter subscription from the emailed link. */
export async function confirmNewsletter(token: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE newsletter_subscribers
        SET status = 'confirmed', confirmed_at = now(), token_hash = NULL
      WHERE token_hash = $1 AND status <> 'unsubscribed'
      RETURNING id`,
    [await sha256Hex(token)],
  );
  return rows.length > 0;
}
