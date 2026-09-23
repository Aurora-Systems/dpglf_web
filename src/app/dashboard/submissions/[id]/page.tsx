import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/Shell';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Alert, Badge, ButtonAnchor, Card, DescList, Panel } from '@/components/ui';
import { CopyButton } from '@/components/client';
import { requireUser, submissionAccess, isStaff, hasRole } from '@/lib/permissions';
import { formatBytes, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { STATUS_LABELS, STATUS_WRITER_COPY, canTransition, type SubmissionStatus } from '@/lib/workflow';
import {
  feedbackForSubmission,
  submissionDetail,
  submissionEvents,
  submissionVersions,
} from '@/features/submissions/queries';
import { RevisionUpload, WithdrawButton } from '@/features/submissions/WriterActions';

export default async function SubmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { id } = await params;
  const { submitted } = await searchParams;
  const user = await requireUser(`/dashboard/submissions/${id}`);

  const access = await submissionAccess(user, id);
  // Judges score from their own assignment page. This one carries the writer's
  // email, feedback threads, uploaders' names and original filenames.
  if (!access.view || access.judgeOnly) notFound();

  const submission = await submissionDetail(id);
  if (!submission) notFound();

  const staffView = isStaff(user) || hasRole(user, 'editor');
  const isOwner = submission.writer_id === user.userId;
  const [events, versions, threads] = await Promise.all([
    submissionEvents(id),
    submissionVersions(id),
    feedbackForSubmission(id, staffView),
  ]);

  const canRevise =
    (isOwner || staffView) && ['SHORTLISTED', 'MENTORSHIP', 'EDITORIAL'].includes(submission.status);
  const canWithdraw = isOwner && canTransition(submission.status, 'WITHDRAWN', { roles: [], isOwner: true });

  return (
    <>
      <PageHeader
        back={{ href: '/dashboard/submissions', label: 'My submissions' }}
        title={submission.title || 'Untitled entry'}
        lead={submission.competition_name}
        action={<StatusBadge status={submission.status} />}
      />

      <div className="space-y-6">
        {submitted && (
          <Alert tone="success" title="Your entry has been submitted">
            Keep your reference number. It identifies this entry in every conversation with the
            Foundation. A receipt is on its way to {submission.writer_email}.
          </Alert>
        )}

        {submission.status === 'DRAFT' && (
          <Alert tone="warning" title="This entry is still a draft">
            It has not been submitted and will not be judged.{' '}
            <Link href={`/dashboard/submissions/${id}/edit`} className="underline">
              Finish it now
            </Link>
            .
          </Alert>
        )}

        {submission.eligibility_note && (
          <Alert tone={submission.status === 'INELIGIBLE' ? 'error' : 'info'} title="Note from the Foundation">
            {submission.eligibility_note}
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-6">
            <Panel title="Where your entry is">
              <p className="text-[15px] leading-relaxed text-forest-800">
                {STATUS_WRITER_COPY[submission.status as SubmissionStatus]}
              </p>

              <ol className="mt-6 space-y-4 border-l border-line pl-5">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span
                      aria-hidden
                      className="absolute top-1.5 -left-[1.44rem] size-2 rotate-45 bg-gold-500"
                    />
                    <p className="text-sm font-medium text-forest-900">
                      {STATUS_LABELS[e.to_status as SubmissionStatus] ?? e.to_status}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(e.created_at)}
                      {e.actor_name && !staffView ? '' : e.actor_name ? ` · ${e.actor_name}` : ''}
                    </p>
                    {e.note && <p className="mt-1 text-[13px] text-muted">{e.note}</p>}
                  </li>
                ))}
                {events.length === 0 && <li className="text-sm text-muted">Nothing has happened yet.</li>}
              </ol>
            </Panel>

            <Panel title="Your story">
              <DescList
                rows={[
                  ['Synopsis', <span key="s" className="whitespace-pre-line">{submission.synopsis}</span>],
                  ['Language', submission.language],
                  ['Genre', submission.genre ?? 'Not specified'],
                  [
                    'Themes',
                    submission.themes.length > 0 ? (
                      <span key="t" className="flex flex-wrap gap-1.5">
                        {submission.themes.map((t) => (
                          <Badge key={t}>{t}</Badge>
                        ))}
                      </span>
                    ) : (
                      'None'
                    ),
                  ],
                  ...(submission.cultural_context
                    ? ([['Cultural context', submission.cultural_context]] as [string, React.ReactNode][])
                    : []),
                ]}
              />
            </Panel>

            <Panel
              title="Manuscript versions"
              description="Your original submission is version 1 and is never overwritten."
            >
              {versions.length === 0 ? (
                <p className="text-sm text-muted">No file uploaded yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {versions.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                      <Badge tone={v.version_number === 1 ? 'gold' : 'neutral'}>v{v.version_number}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-forest-900">
                          {v.file_name ?? 'File removed'}
                        </p>
                        <p className="text-xs text-muted">
                          {[
                            formatBytes(v.file_size),
                            v.word_count ? `${formatNumber(v.word_count)} words` : null,
                            formatDate(v.created_at),
                            v.created_by_name,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {v.change_note && <p className="mt-0.5 text-[13px] text-muted">{v.change_note}</p>}
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

              {canRevise && (
                <div className="mt-6 border-t border-line pt-6">
                  <h3 className="font-display text-base font-semibold text-forest-900">
                    Upload a revision
                  </h3>
                  <div className="mt-4">
                    <RevisionUpload submissionId={id} />
                  </div>
                </div>
              )}
            </Panel>

            <Panel
              title="Feedback"
              description={staffView ? 'Internal threads are visible to you.' : 'Notes from your mentor and the Foundation.'}
            >
              {threads.length === 0 ? (
                <p className="text-sm text-muted">No feedback yet.</p>
              ) : (
                <ul className="space-y-6">
                  {threads.map((t) => (
                    <li key={t.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-forest-900">
                          {t.subject || 'Feedback'}
                        </h3>
                        {t.visibility === 'internal' && <Badge tone="bad">Internal</Badge>}
                        {t.resolved_at && <Badge tone="good">Resolved</Badge>}
                      </div>
                      <ul className="mt-3 space-y-3">
                        {t.messages.map((m) => (
                          <li key={m.id} className="rounded-lg bg-parchment px-4 py-3">
                            <p className="text-xs text-muted">
                              {m.author_name ?? 'Foundation'} · {formatDateTime(m.created_at)}
                            </p>
                            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-forest-800">
                              {m.body}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <aside className="space-y-6">
            <Card className="p-5">
              <h2 className="font-display text-base font-semibold text-forest-900">Entry record</h2>
              {submission.reference && (
                <div className="mt-3 rounded-lg bg-forest-900 px-4 py-3">
                  <p className="text-[11px] tracking-wider text-gold-400 uppercase">Reference</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <code className="font-mono text-sm text-bone">{submission.reference}</code>
                    <CopyButton value={submission.reference} />
                  </div>
                </div>
              )}
              <div className="mt-4">
                <DescList
                  rows={[
                    ['Programme', submission.competition_name],
                    ['Submitted', submission.submitted_at ? formatDateTime(submission.submitted_at) : 'Not yet'],
                    ['Words', submission.word_count ? formatNumber(submission.word_count) : 'Not counted'],
                    ['Rules version', submission.rules_version],
                    ...(submission.consent_status
                      ? ([
                          [
                            'Guardian consent',
                            <Badge
                              key="c"
                              tone={submission.consent_status === 'granted' ? 'good' : 'bad'}
                            >
                              {submission.consent_status}
                            </Badge>,
                          ],
                        ] as [string, React.ReactNode][])
                      : []),
                  ]}
                />
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="font-display text-base font-semibold text-forest-900">Your rights</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                You keep copyright in this story. If it is selected for publication, the Foundation
                will agree the specific licence with you first. Publication never changes ownership
                on its own.
              </p>
              <Link href="/policies/copyright" className="mt-3 inline-block text-[13px] text-gold-700 underline">
                Copyright and IP policy
              </Link>
            </Card>

            {canWithdraw && (
              <Card className="p-5">
                <h2 className="font-display text-base font-semibold text-forest-900">Withdraw</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  You can take this entry out of the competition until judging begins. After that,
                  please contact the Foundation.
                </p>
                <div className="mt-3">
                  <WithdrawButton submissionId={id} />
                </div>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
