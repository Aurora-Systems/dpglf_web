import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/dashboard/Shell';
import { Alert, Badge, ButtonAnchor, Card, DescList, Panel } from '@/components/ui';
import { requireRole } from '@/lib/permissions';
import { formatDate, formatNumber } from '@/lib/format';
import {
  assignmentForJudge,
  existingReview,
  rubricCriteria,
} from '@/features/judging/queries';
import { ConflictForm, ReviewForm } from '@/features/judging/ReviewForm';
import { queryOne } from '@/lib/db';

export default async function JudgeAssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const user = await requireRole(['judge', 'admin', 'super_admin'], `/dashboard/judge/${assignmentId}`);

  const assignment = await assignmentForJudge(assignmentId, user.userId);
  if (!assignment) notFound();

  const [criteria, review, competition] = await Promise.all([
    rubricCriteria(assignment.rubric_id),
    existingReview(assignmentId),
    queryOne<{ allow_score_revision: boolean }>(
      `SELECT c.allow_score_revision FROM competitions c
         JOIN submissions s ON s.competition_id = c.id
        WHERE s.id = $1`,
      [assignment.submission_id],
    ),
  ]);

  const blind = assignment.blind_judging;
  const displayTitle = blind ? (assignment.anon_label ?? 'Entry') : assignment.title;

  return (
    <>
      <PageHeader
        back={{ href: '/dashboard/judge', label: 'Judging queue' }}
        title={displayTitle}
        lead={assignment.competition_name}
        action={
          assignment.status === 'completed' ? <Badge tone="good">Scored</Badge> : <Badge>To score</Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        <div className="min-w-0 space-y-6">
          {blind && (
            <Alert tone="info" title="Blind review">
              The writer’s identity is hidden for this competition. If you recognise the entry
              anyway, declare a conflict rather than scoring it.
            </Alert>
          )}

          <Panel title="The entry">
            <DescList
              rows={[
                ...(blind ? [] : ([['Title', assignment.title]] as [string, React.ReactNode][])),
                ['Language', assignment.language],
                ['Genre', assignment.genre ?? 'Not specified'],
                ['Length', assignment.word_count ? `${formatNumber(assignment.word_count)} words` : 'Not counted'],
                [
                  'Themes',
                  assignment.themes.length > 0 ? (
                    <span key="t" className="flex flex-wrap gap-1.5">
                      {assignment.themes.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </span>
                  ) : (
                    'None'
                  ),
                ],
              ]}
            />
            <div className="mt-4 border-t border-line pt-4">
              <p className="eyebrow text-muted">Synopsis</p>
              <p className="mt-2 leading-relaxed whitespace-pre-line text-forest-800">
                {assignment.synopsis}
              </p>
            </div>
            {assignment.file_id && (
              <ButtonAnchor href={`/api/files/${assignment.file_id}`} className="mt-5">
                Download the manuscript
              </ButtonAnchor>
            )}
          </Panel>

          <Panel title="Your score" description="Save as you go; submitting locks your score.">
            <ReviewForm
              assignmentId={assignmentId}
              criteria={criteria}
              existing={review}
              locked={Boolean(review?.locked_at)}
              allowRevision={Boolean(competition?.allow_score_revision)}
            />
          </Panel>
        </div>

        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-forest-900">Assignment</h2>
            <DescList
              rows={[
                ['Assigned', formatDate(assignment.assigned_at)],
                ['Due', assignment.due_at ? formatDate(assignment.due_at) : 'No fixed date'],
                ['Status', assignment.status.replace('_', ' ')],
                ...(review?.submitted_at
                  ? ([['Scored', formatDate(review.submitted_at)]] as [string, React.ReactNode][])
                  : []),
              ]}
            />
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-forest-900">Judging fairly</h2>
            <ul className="mt-2 space-y-2 text-[13px] leading-relaxed text-muted">
              <li>Score against the rubric, not against the rest of the field.</li>
              <li>Comment on the writing, not the writer.</li>
              <li>These are young writers. Be honest, and be kind.</li>
              <li>Declare a conflict rather than scoring an entry you recognise.</li>
            </ul>
          </Card>

          {assignment.status !== 'completed' && (
            <div>
              <ConflictForm assignmentId={assignmentId} />
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
