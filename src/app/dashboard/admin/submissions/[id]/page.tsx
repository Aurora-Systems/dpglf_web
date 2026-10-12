import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/Shell';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Alert, Badge, ButtonAnchor, ButtonLink, DescList, Panel } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { formatBytes, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { allowedTransitions } from '@/lib/workflow';
import { consentForSubmission, reviewsForSubmission } from '@/features/admin/queries';
import { EligibilityNoteForm, ReopenSubmissionForm, UnlockReviewForm } from '@/features/admin/Forms';
import { AdvanceForm, FeedbackForm } from '@/features/mentorship/Forms';
import { MINOR_BANDS } from '@/features/submissions/rules';
import {
  feedbackForSubmission,
  submissionDetail,
  submissionEvents,
  submissionVersions,
} from '@/features/submissions/queries';
import {
  ASSIGNMENT_LABELS,
  CONSENT_LABELS,
  CONSENT_METHODS,
  RECOMMENDATION_LABELS,
  ageBandLabel,
  statusLabel,
} from '../labels';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export default async function AdminSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff(`/dashboard/admin/submissions/${id}`);

  const submission = await submissionDetail(id);
  if (!submission) notFound();

  const [events, versions, reviews, threads, consent] = await Promise.all([
    submissionEvents(id),
    submissionVersions(id),
    reviewsForSubmission(id),
    feedbackForSubmission(id, true),
    submission.consent_id ? consentForSubmission(id) : Promise.resolve(null),
  ]);

  const transitions = allowedTransitions(submission.status, {
    roles: user.roles,
    isOwner: false,
  }).map((t) => ({ to: t.to, label: t.label }));

  const declarations = submission.declarations as Record<string, unknown>;
  const age = ageBandLabel(submission.age_band);
  const latest = events[0];
  const canAssign = submission.status === 'ELIGIBLE' || submission.status === 'ASSIGNED_FOR_JUDGING';
  const reopenedUntil = submission.reopened_until ? new Date(submission.reopened_until) : null;
  const stillReopened = reopenedUntil ? reopenedUntil.getTime() > new Date().getTime() : false;

  const activeReviews = reviews.filter((r) => r.status !== 'revoked' && r.status !== 'declined');
  const scored = reviews.filter((r) => r.submitted_at && r.total_score !== null);
  const average = scored.length
    ? (scored.reduce((sum, r) => sum + Number(r.total_score), 0) / scored.length).toFixed(1)
    : null;
  const maxScore = scored.find((r) => r.max_score)?.max_score;

  return (
    <>
      <PageHeader
        eyebrow="Programmes"
        back={{ href: '/dashboard/admin/submissions', label: 'All submissions' }}
        title={submission.title || 'Untitled entry'}
        lead={`${submission.competition_name} · ${submission.reference ?? 'No reference yet'}`}
      />

      {/*
        Two columns from xl: below that the dashboard menu leaves too little room
        for a readable main column beside a 21rem side column. The side column is
        split in two grid cells so that, in one column, "Status and next actions"
        comes first and the writer, consent and history panels follow the main column.
      */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:grid-rows-[auto_1fr] xl:items-start">
        <div className="min-w-0 xl:col-start-2 xl:row-start-1">
          <Panel title="Status and next actions">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={submission.status} />
            </div>
            {latest && (
              <p className="mt-2 text-[13px] text-muted">
                Since {formatDateTime(latest.created_at)}
                {latest.actor_name && `, by ${latest.actor_name}`}.
              </p>
            )}
            {reopenedUntil && (
              <div className="mt-3">
                <Alert tone={stillReopened ? 'warning' : 'info'}>
                  {stillReopened
                    ? `Open for the writer to edit until ${formatDateTime(reopenedUntil)}.`
                    : `Was reopened for editing until ${formatDateTime(reopenedUntil)}.`}
                </Alert>
              </div>
            )}

            <div className="mt-4 border-t border-line pt-4">
              <h3 className="text-sm font-semibold text-forest-900">Move this entry</h3>
              <div className="mt-3">
                <AdvanceForm submissionId={id} options={transitions} />
              </div>
            </div>

            {canAssign && (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="text-sm font-semibold text-forest-900">Judges</h3>
                <p className="mt-1 text-[13px] text-muted">
                  {activeReviews.length === 0
                    ? 'This entry is eligible and has no judges yet.'
                    : `${activeReviews.length} judge${activeReviews.length === 1 ? '' : 's'} assigned. You can add more.`}
                </p>
                <ButtonLink
                  href={`/dashboard/admin/submissions/assign?competition=${submission.competition_id}`}
                  variant="outline"
                  size="sm"
                  className="mt-3 min-h-10 sm:min-h-0"
                >
                  Assign judges
                </ButtonLink>
              </div>
            )}

            <div className="mt-5 border-t border-line pt-4">
              <h3 className="text-sm font-semibold text-forest-900">Reopen for editing</h3>
              <p className="mt-1 text-[13px] text-muted">
                Lets the writer change a closed entry, for a genuine mistake or a deadline problem that was
                not theirs.
              </p>
              <div className="mt-3">
                <ReopenSubmissionForm submissionId={id} />
              </div>
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-6 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <Panel
            title="Entry details and manuscript"
            action={
              <Link
                href={`/dashboard/submissions/${id}`}
                className="-my-2 inline-flex min-h-10 items-center text-[13px] text-gold-700 hover:underline"
              >
                Writer’s view of this entry
              </Link>
            }
          >
            <DescList
              rows={[
                [
                  'Programme',
                  <Link
                    key="p"
                    href={`/programmes/${submission.competition_slug}`}
                    className="text-gold-700 underline-offset-2 hover:underline"
                  >
                    {submission.competition_name}
                  </Link>,
                ],
                ['Language', submission.language],
                ['Genre', submission.genre ?? 'Not given'],
                ...(submission.themes?.length ? [['Themes', submission.themes.join(', ')] as [string, string]] : []),
                ['Length', submission.word_count ? `${formatNumber(submission.word_count)} words` : 'Not counted'],
                [
                  'Length allowed',
                  `${formatNumber(submission.word_min)} to ${formatNumber(submission.word_max)} words`,
                ],
                ['Submitted', submission.submitted_at ? formatDateTime(submission.submitted_at) : 'Not yet'],
                ['Programme rules', submission.rules_version],
              ]}
            />

            <Section title="Synopsis">
              <p className="leading-relaxed whitespace-pre-line text-forest-800">
                {submission.synopsis || <span className="text-muted">Not given.</span>}
              </p>
            </Section>

            {submission.cultural_context && (
              <Section title="Cultural context">
                <p className="leading-relaxed whitespace-pre-line text-forest-800">{submission.cultural_context}</p>
              </Section>
            )}

            <Section title="Manuscript">
              {versions.length === 0 ? (
                <p className="text-sm text-muted">No file uploaded.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {versions.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <Badge tone={v === versions[0] ? 'gold' : 'neutral'}>v{v.version_number}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-forest-900">
                          {v.file_name ?? 'Untitled file'}
                        </p>
                        <p className="text-xs text-muted">
                          {[
                            formatBytes(v.file_size),
                            v.word_count ? `${formatNumber(v.word_count)} words` : null,
                            formatDate(v.created_at),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {v.change_note && <p className="mt-0.5 text-[13px] text-forest-800">{v.change_note}</p>}
                      </div>
                      {v.file_id && (
                        <ButtonAnchor
                          href={`/api/files/${v.file_id}`}
                          variant="outline"
                          size="sm"
                          className="min-h-10 sm:min-h-0"
                        >
                          Download
                        </ButtonAnchor>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Declarations">
              {Object.keys(declarations).length === 0 ? (
                <p className="text-sm text-muted">Not submitted yet.</p>
              ) : (
                <details className="group rounded-lg border border-line">
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 text-sm text-forest-900 marker:content-none">
                    What the writer accepted when submitting
                    <span className="text-[13px] text-gold-700 group-open:hidden">Show</span>
                    <span className="hidden text-[13px] text-gold-700 group-open:inline">Hide</span>
                  </summary>
                  <div className="border-t border-line px-4 py-1">
                    <DescList
                      rows={Object.entries(declarations).map(([k, v]) => [
                        k.replace(/([A-Z])/g, ' $1').replace(/^./, (m) => m.toUpperCase()),
                        typeof v === 'boolean'
                          ? v
                            ? 'Yes'
                            : 'No'
                          : typeof v === 'string' && ISO_DATE.test(v)
                            ? formatDateTime(v)
                            : String(v),
                      ])}
                    />
                  </div>
                </details>
              )}
            </Section>
          </Panel>

          <Panel
            title="Judging and scores"
            description={
              submission.blind_judging
                ? 'Judges read this entry without the writer’s name.'
                : 'Scores, recommendations and any declared conflicts.'
            }
          >
            {reviews.length === 0 ? (
              <p className="text-sm text-muted">
                No judges assigned yet.
                {canAssign && (
                  <>
                    {' '}
                    <Link
                      href={`/dashboard/admin/submissions/assign?competition=${submission.competition_id}`}
                      className="text-gold-700 underline"
                    >
                      Assign judges
                    </Link>
                  </>
                )}
              </p>
            ) : (
              <>
                <dl className="grid grid-cols-3 divide-x divide-line rounded-lg bg-parchment py-3 text-center">
                  <div>
                    <dt className="text-xs text-muted">Judges</dt>
                    <dd className="font-display text-xl font-semibold text-forest-900">{activeReviews.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Scored</dt>
                    <dd className="font-display text-xl font-semibold text-forest-900">{scored.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Average</dt>
                    <dd className="font-display text-xl font-semibold text-forest-900">
                      {average ?? <span className="text-sm font-normal text-muted">None yet</span>}
                      {average && maxScore && (
                        <span className="text-sm font-normal text-muted"> / {Number(maxScore).toFixed(0)}</span>
                      )}
                    </dd>
                  </div>
                </dl>

                <ul className="mt-4 space-y-3">
                  {reviews.map((r) => (
                    <li key={r.assignment_id} className="rounded-lg border border-line p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="mr-1 font-medium text-forest-900">{r.judge_name}</p>
                        <Badge
                          tone={r.status === 'completed' ? 'good' : r.status === 'declined' ? 'bad' : 'neutral'}
                        >
                          {ASSIGNMENT_LABELS[r.status] ?? r.status}
                        </Badge>
                        {r.total_score && (
                          <Badge tone="gold">
                            {Number(r.total_score).toFixed(1)}
                            {r.max_score ? ` / ${Number(r.max_score).toFixed(0)}` : ''}
                          </Badge>
                        )}
                        {r.recommendation && (
                          <Badge>{RECOMMENDATION_LABELS[r.recommendation] ?? r.recommendation}</Badge>
                        )}
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
              </>
            )}
          </Panel>

          <Panel
            title="Notes and feedback"
            description="Internal threads are seen by staff and editors only. Everything else reaches the writer."
          >
            <EligibilityNoteForm submissionId={id} note={submission.eligibility_note} />

            <Section title={`Feedback threads${threads.length ? ` (${threads.length})` : ''}`}>
              {threads.length === 0 ? (
                <p className="text-sm text-muted">No feedback yet.</p>
              ) : (
                <ul className="space-y-5">
                  {threads.map((t) => (
                    <li key={t.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-forest-900">{t.subject || 'Feedback'}</h4>
                        {t.visibility === 'internal' ? (
                          <Badge tone="bad">Internal</Badge>
                        ) : (
                          <Badge>Seen by the writer</Badge>
                        )}
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
            </Section>

            <Section title="Start a new thread">
              <FeedbackForm submissionId={id} canPostInternal />
            </Section>
          </Panel>
        </div>

        <div className="grid min-w-0 gap-6 md:grid-cols-2 md:items-start xl:col-start-2 xl:row-start-2 xl:grid-cols-1">
          <Panel title="Writer">
            <Facts
              rows={[
                ['Name', submission.writer_name],
                [
                  'Email',
                  <a key="e" href={`mailto:${submission.writer_email}`} className="text-gold-700 hover:underline">
                    {submission.writer_email}
                  </a>,
                ],
                ['Age band', age ?? 'Not recorded'],
              ]}
            />
          </Panel>

          <Panel title="Guardian consent">
            {consent ? (
              <>
                <Badge tone={consent.status === 'granted' ? 'good' : 'bad'}>
                  {CONSENT_LABELS[consent.status] ?? consent.status}
                </Badge>
                <div className="mt-3">
                  <Facts
                    rows={[
                      ['Guardian', `${consent.guardian_name} (${consent.relationship})`],
                      [
                        'Email',
                        <a
                          key="g"
                          href={`mailto:${consent.guardian_email}`}
                          className="text-gold-700 hover:underline"
                        >
                          {consent.guardian_email}
                        </a>,
                      ],
                      ['How given', CONSENT_METHODS[consent.method] ?? consent.method],
                      ['Asked', formatDate(consent.requested_at)],
                      ...(consent.granted_at ? [['Granted', formatDate(consent.granted_at)] as [string, string]] : []),
                      ...(consent.revoked_at ? [['Withdrawn', formatDate(consent.revoked_at)] as [string, string]] : []),
                    ]}
                  />
                </div>
                {consent.evidence_file_id && (
                  <ButtonAnchor
                    href={`/api/files/${consent.evidence_file_id}`}
                    variant="outline"
                    size="sm"
                    className="mt-3 min-h-10 sm:min-h-0"
                  >
                    Download evidence
                  </ButtonAnchor>
                )}
              </>
            ) : submission.consent_status ? (
              // Linked consent that the detail query could not load: fall back to the summary.
              <p className="text-sm text-forest-800">
                {CONSENT_LABELS[submission.consent_status] ?? submission.consent_status}
                {submission.consent_guardian_email && ` · ${submission.consent_guardian_email}`}
              </p>
            ) : submission.requires_guardian_consent && submission.age_band && MINOR_BANDS.has(submission.age_band) ? (
              <Alert tone="warning">No consent is linked, although the writer is under 18.</Alert>
            ) : (
              <p className="text-sm text-muted">Not needed for this entry.</p>
            )}
          </Panel>

          <Panel title="History" className="md:col-span-2 xl:col-span-1">
            {events.length === 0 ? (
              <p className="text-sm text-muted">No changes recorded yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-4">
                {events.map((e) => (
                  <li key={e.id} className="relative text-sm">
                    <span
                      aria-hidden
                      className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-gold-500 ring-4 ring-white"
                    />
                    <p className="text-forest-900">
                      {e.from_status ? 'Moved to ' : ''}
                      <span className="font-medium">{statusLabel(e.to_status)}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(e.created_at)}
                      {e.actor_name && ` · ${e.actor_name}`}
                    </p>
                    {e.note && <p className="mt-1 text-[13px] leading-relaxed text-forest-800">{e.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

/** Label above value: the side column is too narrow for DescList's two columns. */
function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="space-y-3 text-sm">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="mt-0.5 min-w-0 text-forest-900 wrap-anywhere">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A titled block inside a panel, ruled off from what comes before it. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-line pt-4">
      <h3 className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}
