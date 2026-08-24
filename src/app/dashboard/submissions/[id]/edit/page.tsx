import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { Alert, Badge, Card, cx } from '@/components/ui';
import { requireUser, submissionAccess } from '@/lib/permissions';
import { deadlineLabel, formatBytes, formatNumber } from '@/lib/format';
import { submissionDetail } from '@/features/submissions/queries';
import { MINOR_BANDS, submissionBlockers } from '@/features/submissions/rules';
import {
  ConsentForm,
  ManuscriptForm,
  MetaForm,
  SubmitForm,
} from '@/features/submissions/WizardForms';

/**
 * The submission wizard.
 *
 * Every step writes to the same persisted draft, so progress survives a closed
 * laptop or a lost connection — the most common way a young writer loses an
 * entry. Steps are shown together rather than as a linear stepper so a writer
 * can see exactly what is outstanding at a glance.
 */
export default async function EditSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/submissions/${id}/edit`);

  const access = await submissionAccess(user, id);
  if (!access.view) notFound();

  const submission = await submissionDetail(id);
  if (!submission) notFound();
  // A submitted entry is read-only; send the writer to the status page instead.
  if (!access.edit) redirect(`/dashboard/submissions/${id}`);

  const blockers = submissionBlockers(submission);
  const needsConsent =
    submission.requires_guardian_consent && MINOR_BANDS.has(submission.age_band ?? '');

  const steps = [
    { n: 1, title: 'Story details', done: Boolean(submission.title && submission.synopsis.length >= 40) },
    { n: 2, title: 'Manuscript', done: Boolean(submission.file_id) },
    ...(needsConsent
      ? [{ n: 3, title: 'Guardian consent', done: submission.consent_status === 'granted' }]
      : []),
    { n: needsConsent ? 4 : 3, title: 'Declarations and submit', done: false },
  ];

  return (
    <>
      <PageHeader
        back={{ href: '/dashboard/submissions', label: 'My submissions' }}
        title={submission.title || 'Untitled entry'}
        lead={
          <>
            Entering <strong className="text-forest-800">{submission.competition_name}</strong> ·{' '}
            {deadlineLabel(submission.closes_at)}
          </>
        }
        action={<Badge tone="neutral">Draft — not submitted</Badge>}
      />

      {/* progress strip */}
      <ol className="mb-8 flex flex-wrap gap-2">
        {steps.map((s) => (
          <li
            key={s.n}
            className={cx(
              'flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px]',
              s.done ? 'border-emerald-700/30 bg-emerald-50 text-emerald-900' : 'border-line text-muted',
            )}
          >
            <span aria-hidden>{s.done ? '✓' : s.n}</span>
            {s.title}
          </li>
        ))}
      </ol>

      <div className="space-y-6">
        <Step number={1} title="Story details" done={steps[0].done}>
          <MetaForm
            submissionId={submission.id}
            defaults={{
              title: submission.title,
              synopsis: submission.synopsis,
              language: submission.language,
              genre: submission.genre,
              themes: submission.themes,
              culturalContext: submission.cultural_context,
            }}
            competitionThemes={await competitionThemes(submission.competition_id)}
          />
        </Step>

        <Step
          number={2}
          title="Manuscript"
          done={Boolean(submission.file_id)}
          meta={
            submission.file_name
              ? `${submission.file_name} · ${formatBytes(submission.file_size)}${
                  submission.word_count ? ` · ${formatNumber(submission.word_count)} words` : ''
                }`
              : undefined
          }
        >
          <ManuscriptForm
            submissionId={submission.id}
            currentName={submission.file_name}
            wordMin={submission.word_min}
            wordMax={submission.word_max}
          />
        </Step>

        {needsConsent && (
          <Step number={3} title="Guardian consent" done={submission.consent_status === 'granted'}>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              Because you are under eighteen, a parent or guardian has to give consent before your
              entry can be judged. We email them a link — you do not have to do anything else.
            </p>
            <ConsentForm
              submissionId={submission.id}
              consentStatus={submission.consent_status}
              guardianEmail={submission.consent_guardian_email}
            />
          </Step>
        )}

        <Step number={needsConsent ? 4 : 3} title="Declarations and submit" done={false}>
          <SubmitForm
            submissionId={submission.id}
            blockers={blockers}
            rulesVersion={submission.rules_version}
            competitionSlug={submission.competition_name}
          />
        </Step>

        <Alert tone="info">
          Everything on this page saves as you go. You can close it and come back until{' '}
          {deadlineLabel(submission.closes_at).toLowerCase()}.{' '}
          <Link href="/dashboard/submissions" className="underline">
            Back to my submissions
          </Link>
          .
        </Alert>
      </div>
    </>
  );
}

function Step({
  number,
  title,
  done,
  meta,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-parchment px-5 py-4">
        <span
          aria-hidden
          className={cx(
            'font-display grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold',
            done ? 'bg-emerald-700 text-white' : 'bg-forest-900 text-bone',
          )}
        >
          {done ? '✓' : number}
        </span>
        <h2 className="font-display text-lg font-semibold text-forest-900">{title}</h2>
        {meta && <span className="ml-auto text-[13px] text-muted">{meta}</span>}
      </div>
      <div className="px-5 py-6">{children}</div>
    </Card>
  );
}

async function competitionThemes(competitionId: string): Promise<string[]> {
  const { queryOne } = await import('@/lib/db');
  const row = await queryOne<{ themes: string[] }>(`SELECT themes FROM competitions WHERE id = $1`, [
    competitionId,
  ]);
  return row?.themes ?? [];
}
