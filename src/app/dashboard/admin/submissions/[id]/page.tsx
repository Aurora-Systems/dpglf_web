import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/Shell';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Badge, ButtonAnchor, Card, DescList, Panel } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatBytes, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { allowedTransitions } from '@/lib/workflow';
import { reviewsForSubmission } from '@/features/admin/queries';
import { EligibilityNoteForm, ReopenSubmissionForm, UnlockReviewForm } from '@/features/admin/Forms';
import { AdvanceForm, FeedbackForm } from '@/features/mentorship/Forms';
import {
  feedbackForSubmission,
  submissionDetail,
  submissionEvents,
  submissionVersions,
} from '@/features/submissions/queries';

export default async function AdminSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff(`/dashboard/admin/submissions/${id}`);

  const submission = await submissionDetail(id);
  if (!submission) notFound();

  const [events, versions, reviews, threads] = await Promise.all([
    submissionEvents(id),
    submissionVersions(id),
    reviewsForSubmission(id),
    feedbackForSubmission(id, true),
  ]);

  const transitions = allowedTransitions(submission.status, {
    roles: user.roles,
    isOwner: false,
  }).map((t) => ({ to: t.to, label: t.label }));

  const declarations = submission.declarations as Record<string, unknown>;

  return (
    <>
      <PageHeader
        back={{ href: '/dashboard/admin/submissions', label: 'All submissions' }}
        title={submission.title || 'Untitled entry'}
        lead={
          <>
            {submission.competition_name} · {submission.reference ?? 'no reference yet'}
          </>
        }
        action={<StatusBadge status={submission.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Entry">
            <DescList
              rows={[
                ['Writer', `${submission.writer_name} <${submission.writer_email}>`],
                ['Age band', submission.age_band?.replace(/_/g, '–') ?? 'Not recorded'],
                ['Language', submission.language],
                ['Genre', submission.genre ?? 'Not specified'],
                ['Words', submission.word_count ? formatNumber(submission.word_count) : 'Not counted'],
                [
                  'Length allowed',
                  `${formatNumber(submission.word_min)}–${formatNumber(submission.word_max)}`,
                ],
                ['Submitted', submission.submitted_at ? formatDateTime(submission.submitted_at) : 'Not yet'],
                ['Rules accepted', submission.rules_version],
                [
                  'Guardian consent',
                  submission.consent_status ? (
                    <Badge key="c" tone={submission.consent_status === 'granted' ? 'good' : 'bad'}>
                      {submission.consent_status} · {submission.consent_guardian_email}
                    </Badge>
                  ) : (
                    'Not required'
                  ),
                ],
              ]}
            />
            <div className="mt-4 border-t border-line pt-4">
              <p className="eyebrow text-muted">Synopsis</p>
              <p className="mt-2 leading-relaxed whitespace-pre-line text-forest-800">
                {submission.synopsis}
              </p>
            </div>
            {submission.cultural_context && (
              <div className="mt-4">
                <p className="eyebrow text-muted">Cultural context</p>
                <p className="mt-2 leading-relaxed text-forest-800">{submission.cultural_context}</p>
              </div>
            )}
          </Panel>

          <Panel title="Declarations" description="What the writer accepted at submission.">
            {Object.keys(declarations).length === 0 ? (
              <p className="text-sm text-muted">Not submitted yet.</p>
            ) : (
              <DescList
                rows={Object.entries(declarations).map(([k, v]) => [
                  k.replace(/([A-Z])/g, ' $1').replace(/^./, (m) => m.toUpperCase()),
                  typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v),
                ])}
              />
            )}
          </Panel>

          <Panel title="Manuscript versions">
            {versions.length === 0 ? (
              <p className="text-sm text-muted">No file uploaded.</p>
            ) : (
              <ul className="divide-y divide-line">
                {versions.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Badge tone={v.version_number === 1 ? 'gold' : 'neutral'}>v{v.version_number}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-forest-900">{v.file_name ?? 'Untitled file'}</p>
                      <p className="text-xs text-muted">
                        {[formatBytes(v.file_size), v.word_count ? `${formatNumber(v.word_count)} words` : null, formatDate(v.created_at)]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {v.file_id && (
                      <ButtonAnchor href={`/api/files/${v.file_id}`} variant="outline" size="sm">
                        Download
                      </ButtonAnchor>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Judging" description="Scores, recommendations and any declared conflicts.">
            {reviews.length === 0 ? (
              <p className="text-sm text-muted">No judges assigned yet.</p>
            ) : (
              <ul className="space-y-4">
                {reviews.map((r) => (
                  <li key={r.assignment_id} className="rounded-lg border border-line p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-medium text-forest-900">{r.judge_name}</p>
                      <Badge tone={r.status === 'completed' ? 'good' : r.status === 'declined' ? 'bad' : 'neutral'}>
                        {r.status}
                      </Badge>
                      {r.total_score && (
                        <Badge tone="gold">
                          {Number(r.total_score).toFixed(1)}
                          {r.max_score ? ` / ${Number(r.max_score).toFixed(0)}` : ''}
                        </Badge>
                      )}
                      {r.recommendation && <Badge>{r.recommendation}</Badge>}
                      {r.locked_at && r.review_id && r.status !== 'revoked' && r.status !== 'declined' && (
                        <span className="ml-auto">
                          <UnlockReviewForm reviewId={r.review_id} />
                        </span>
                      )}
                    </div>
                    {r.conflict_flag && (
                      <p className="mt-2 text-[13px] text-clay">Conflict declared: {r.conflict_note}</p>
                    )}
                    {r.comments && (
                      <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-forest-800">
                        {r.comments}
                      </p>
                    )}
                    {r.internal_notes && (
                      <p className="mt-2 rounded bg-parchment px-3 py-2 text-[13px] text-muted">
                        Internal: {r.internal_notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Feedback" description="Internal threads are visible to you and not to the writer.">
            {threads.length > 0 && (
              <ul className="mb-6 space-y-5">
                {threads.map((t) => (
                  <li key={t.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-forest-900">{t.subject || 'Feedback'}</h3>
                      {t.visibility === 'internal' && <Badge tone="bad">Internal</Badge>}
                    </div>
                    <ul className="mt-2 space-y-2">
                      {t.messages.map((m) => (
                        <li key={m.id} className="rounded-lg bg-parchment px-4 py-3">
                          <p className="text-xs text-muted">
                            {m.author_name ?? 'Foundation'} · {formatDateTime(m.created_at)}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-forest-800">
                            {m.body}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-line pt-5">
              <FeedbackForm submissionId={id} canPostInternal />
            </div>
          </Panel>

          <Panel title="History">
            <ol className="space-y-3">
              {events.map((e) => (
                <li key={e.id} className="text-sm">
                  <span className="text-forest-900">
                    {e.from_status ? `${e.from_status} → ` : ''}
                    {e.to_status}
                  </span>
                  <span className="ml-2 text-xs text-muted">
                    {formatDateTime(e.created_at)}
                    {e.actor_name && ` · ${e.actor_name}`}
                  </span>
                  {e.note && <p className="mt-0.5 text-[13px] text-muted">{e.note}</p>}
                </li>
              ))}
              {events.length === 0 && <li className="text-sm text-muted">No events yet.</li>}
            </ol>
          </Panel>
        </div>

        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-forest-900">Move this entry</h2>
            <div className="mt-4">
              <AdvanceForm submissionId={id} options={transitions} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-forest-900">Eligibility note</h2>
            <div className="mt-4">
              <EligibilityNoteForm submissionId={id} note={submission.eligibility_note} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-forest-900">Reopen for editing</h2>
            <p className="mt-1.5 text-[13px] text-muted">
              Lets the writer change a closed entry, for a genuine mistake or a deadline problem
              that was not theirs.
            </p>
            <div className="mt-4">
              <ReopenSubmissionForm submissionId={id} />
            </div>
            {submission.reopened_until && (
              <p className="mt-2 text-xs text-gold-700">
                Currently open until {formatDateTime(submission.reopened_until)}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-forest-900">Links</h2>
            <ul className="mt-2 space-y-1.5 text-[13px]">
              <li>
                <Link href={`/dashboard/submissions/${id}`} className="text-gold-700 underline">
                  Writer’s view of this entry
                </Link>
              </li>
              <li>
                <Link href={`/programmes/${submission.competition_slug}`} className="text-gold-700 underline">
                  Programme page
                </Link>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
