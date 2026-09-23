'use server';

import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { clientIp } from '@/lib/auth';
import { sha256Hex } from '@/lib/crypto';
import { query, queryOne, tx } from '@/lib/db';
import type { SubmissionStatus } from '@/lib/workflow';
import { fail, ok, str, type ActionState } from '@/lib/actions';
import { applyTransition } from '@/features/workflow/transition';

/**
 * Guardian consent.
 *
 * A young writer names a guardian during the submission wizard; the guardian
 * receives a link to this flow. The record captures who consented, to what
 * wording (`consent_version`), when and from where — the evidence a safeguarding
 * audit needs — and can be revoked at any time, which withdraws the entry from
 * consideration.
 */

export interface ConsentRequest {
  id: string;
  guardian_name: string;
  guardian_email: string;
  relationship: string;
  consent_version: string;
  status: string;
  requested_at: string;
  granted_at: string | null;
  writer_name: string;
  writer_age_band: string | null;
  submission_id: string | null;
  submission_title: string | null;
  submission_status: string | null;
  competition_name: string | null;
}

export async function consentByToken(token: string): Promise<ConsentRequest | null> {
  if (!token) return null;
  try {
    return await queryOne<ConsentRequest>(
      `SELECT gc.id, gc.guardian_name, gc.guardian_email, gc.relationship, gc.consent_version,
              gc.status, gc.requested_at, gc.granted_at,
              u.name AS writer_name, p.age_band AS writer_age_band,
              s.id AS submission_id, s.title AS submission_title, s.status AS submission_status,
              c.name AS competition_name
         FROM guardian_consents gc
         JOIN users u ON u.id = gc.user_id
         LEFT JOIN profiles p ON p.user_id = gc.user_id
         LEFT JOIN submissions s ON s.consent_id = gc.id
         LEFT JOIN competitions c ON c.id = s.competition_id
        WHERE gc.token_hash = $1`,
      [await sha256Hex(token)],
    );
  } catch (e) {
    console.error(`[consent:lookup] ${(e as Error).message}`);
    return null;
  }
}

export async function decideConsentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const token = str(form, 'token');
  const decision = str(form, 'decision');
  if (decision !== 'grant' && decision !== 'decline') return fail('Choose whether to give consent.');

  const record = await consentByToken(token);
  if (!record) return fail('This consent link is not valid. Please ask the writer to resend it.');
  if (record.status === 'granted' && decision === 'grant') {
    return ok('Consent has already been recorded. Thank you.');
  }

  const ip = await clientIp();
  if (decision === 'grant') {
    await query(
      `UPDATE guardian_consents
          SET status = 'granted', granted_at = now(), revoked_at = NULL, ip = $2
        WHERE id = $1`,
      [record.id, ip],
    );
  } else {
    const submissionId = record.submission_id;
    await tx(async (q) => {
      await q(
        `UPDATE guardian_consents
            SET status = 'revoked', revoked_at = now(), ip = $2
          WHERE id = $1`,
        [record.id, ip],
      );
      // Consent is the basis on which a minor's entry is considered. Without it
      // the entry leaves the pipeline rather than sitting in it unusable. This
      // applies at any stage short of publication, so it is a system move and
      // deliberately not limited to the stages a writer may withdraw from.
      if (!submissionId) return;
      const [current] = await q<{ status: SubmissionStatus }>(
        `SELECT status FROM submissions WHERE id = $1 FOR UPDATE`,
        [submissionId],
      );
      if (!current || current.status === 'PUBLISHED' || current.status === 'WITHDRAWN') return;
      await applyTransition(q, {
        submissionId,
        from: current.status,
        to: 'WITHDRAWN',
        actorId: null,
        note: 'Guardian consent declined or withdrawn',
      });
    });
  }

  await audit({
    actorId: null,
    action: decision === 'grant' ? 'consent.granted' : 'consent.revoked',
    entityType: 'guardian_consent',
    entityId: record.id,
    metadata: { version: record.consent_version, submissionId: record.submission_id },
  });

  revalidatePath('/consent');
  return ok(
    decision === 'grant'
      ? record.submission_status === 'WITHDRAWN'
        ? 'Thank you. Consent has been recorded. The entry was withdrawn earlier, so the writer will need to contact the Foundation to have it restored.'
        : 'Thank you. Consent has been recorded and the entry can now be considered.'
      : 'Consent has been declined. The entry has been withdrawn and will not be judged.',
  );
}
