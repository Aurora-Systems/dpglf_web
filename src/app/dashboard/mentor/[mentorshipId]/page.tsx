import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/Shell';
import { Badge, ButtonAnchor, Card, DescList, Panel, cx } from '@/components/ui';
import { requireUser, submissionAccess, isStaff } from '@/lib/permissions';
import { formatBytes, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { allowedTransitions } from '@/lib/workflow';
import { mentorship, milestones } from '@/features/mentorship/queries';
import {
  AddMilestoneForm,
  AdvanceForm,
  EndMentorshipForm,
  FeedbackForm,
  MilestoneControls,
} from '@/features/mentorship/Forms';
import {
  feedbackForSubmission,
  submissionDetail,
  submissionVersions,
} from '@/features/submissions/queries';

export default async function MentorshipPage({
  params,
}: {
  params: Promise<{ mentorshipId: string }>;
}) {
  const { mentorshipId } = await params;
  const user = await requireUser(`/dashboard/mentor/${mentorshipId}`);

  const m = await mentorship(mentorshipId);
  if (!m) notFound();
  // Mentors reach this through their own pairing; staff can open any of them.
  if (m.mentor_id !== user.userId && !isStaff(user)) notFound();

  const submissionId = m.submission_id;
  const [steps, submission, versions, threads] = await Promise.all([
    milestones(mentorshipId),
    submissionId ? submissionDetail(submissionId) : Promise.resolve(null),
    submissionId ? submissionVersions(submissionId) : Promise.resolve([]),
    submissionId ? feedbackForSubmission(submissionId, isStaff(user)) : Promise.resolve([]),
  ]);

  const access = submissionId ? await submissionAccess(user, submissionId) : null;
  const transitions = submission
    ? allowedTransitions(submission.status, {
        roles: user.roles,
        isOwner: false,
      }).map((t) => ({ to: t.to, label: t.label }))
    : [];

  return (
    <>
      <PageHeader
        back={{ href: '/dashboard/mentor', label: 'My mentees' }}
        title={m.writer_name}
        lead={
          <>
            {m.title || 'Untitled story'}
            {m.competition_name && ` · ${m.competition_name}`}
          </>
        }
        action={
          <div className="flex items-center gap-3">
            <Badge tone={m.status === 'active' ? 'good' : 'neutral'}>{m.status}</Badge>
            {submission && transitions.length > 0 && (
              <a href="#actions" className="py-2 text-sm text-gold-700 underline lg:hidden">
                Move this story on ↓
              </a>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        <div className="min-w-0 space-y-6">
          {m.goal && (
            <Card className="bg-parchment p-5">
              <p className="eyebrow text-gold-700">Goal</p>
              <p className="mt-2 leading-relaxed text-forest-800">{m.goal}</p>
            </Card>
          )}

          <Panel
            title="Manuscript versions"
            description="Every draft is kept. The original submission is version 1."
          >
            {versions.length === 0 ? (
              <p className="text-sm text-muted">No files yet.</p>
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
                    {v.file_id && access?.readManuscript && (
                      <ButtonAnchor href={`/api/files/${v.file_id}`} variant="outline" size="sm">
                        Download
                      </ButtonAnchor>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Feedback" description="The writer sees everything here unless it is marked internal.">
            {threads.length > 0 && (
              <ul className="mb-6 space-y-6">
                {threads.map((t) => (
                  <li key={t.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-semibold text-forest-900">
                        {t.subject || 'Feedback'}
                      </h3>
                      {t.visibility === 'internal' && <Badge tone="bad">Internal</Badge>}
                    </div>
                    <ul className="mt-3 space-y-3">
                      {t.messages.map((msg) => (
                        <li key={msg.id} className="rounded-lg bg-parchment px-4 py-3">
                          <p className="text-xs text-muted">
                            {msg.author_name ?? 'Foundation'} · {formatDateTime(msg.created_at)}
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-forest-800">
                            {msg.body}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}

            {submissionId && (
              <div className={cx(threads.length > 0 && 'border-t border-line pt-6')}>
                <FeedbackForm
                  submissionId={submissionId}
                  canPostInternal={isStaff(user)}
                />
              </div>
            )}
          </Panel>

          <Panel title="Milestones" description="A documented development cycle, not just a chat.">
            {steps.length === 0 ? (
              <p className="text-sm text-muted">No milestones yet.</p>
            ) : (
              <ol className="divide-y divide-line">
                {steps.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p
                        className={cx(
                          'text-sm font-medium',
                          s.status === 'completed' ? 'text-muted line-through' : 'text-forest-900',
                        )}
                      >
                        {s.title}
                      </p>
                      {s.description && <p className="mt-0.5 text-[13px] text-muted">{s.description}</p>}
                      {s.due_at && <p className="mt-0.5 text-xs text-muted">Due {formatDate(s.due_at)}</p>}
                    </div>
                    <MilestoneControls milestoneId={s.id} status={s.status} />
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-6 border-t border-line pt-5">
              <AddMilestoneForm mentorshipId={mentorshipId} />
            </div>
          </Panel>
        </div>

        <aside id="actions" className="scroll-mt-20 space-y-5">
          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-forest-900">Mentorship</h2>
            <DescList
              rows={[
                ['Writer', m.writer_name],
                ['Mentor', m.mentor_name],
                ['Started', formatDate(m.started_at)],
                ['Milestones', `${m.total_milestones - m.open_milestones} of ${m.total_milestones} done`],
                ...(submission
                  ? ([['Entry status', submission.status.replace(/_/g, ' ').toLowerCase()]] as [
                      string,
                      React.ReactNode,
                    ][])
                  : []),
              ]}
            />
            {submissionId && (
              <Link
                href={`/dashboard/submissions/${submissionId}`}
                className="mt-3 inline-block text-[13px] text-gold-700 underline"
              >
                Open the full entry
              </Link>
            )}
          </Card>

          {submission && transitions.length > 0 && (
            <Card className="p-5">
              <h2 className="font-display text-base font-semibold text-forest-900">Move this story on</h2>
              <p className="mt-1.5 text-[13px] text-muted">
                When the writer is ready, hand the story to editorial.
              </p>
              <div className="mt-4">
                <AdvanceForm submissionId={submission.id} options={transitions} />
              </div>
            </Card>
          )}

          {m.status === 'active' && (
            <Card className="p-5">
              <h2 className="font-display text-base font-semibold text-forest-900">Finish up</h2>
              <p className="mt-1.5 text-[13px] text-muted">
                Marking a mentorship complete keeps the record and the feedback intact.
              </p>
              <div className="mt-4">
                <EndMentorshipForm mentorshipId={mentorshipId} />
              </div>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
