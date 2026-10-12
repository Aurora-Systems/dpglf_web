import Link from 'next/link';
import { SectionTabs } from '@/components/client';
import { PageHeader } from '@/components/dashboard/Shell';
import { Field, Select } from '@/components/form';
import { Panel, buttonClass } from '@/components/ui';
import { requireStaff } from '@/lib/permissions';
import { adminCompetitions, adminSubmissionCounts, adminSubmissions } from '@/features/admin/queries';
import { availableJudges } from '@/features/judging/queries';
import { AssignJudgesForm } from '@/features/admin/Forms';
import { submissionTabs } from '../tabs';

export default async function AssignJudgesPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  await requireStaff('/dashboard/admin/submissions/assign');
  const sp = await searchParams;

  // Only entries that have cleared eligibility can be sent to judges; those
  // already with judges are listed too, so more can be added.
  const [waiting, withJudges, judges, competitions, counts] = await Promise.all([
    adminSubmissions({ status: 'ELIGIBLE', competitionId: sp.competition }),
    adminSubmissions({ status: 'ASSIGNED_FOR_JUDGING', competitionId: sp.competition }),
    availableJudges(),
    adminCompetitions(),
    adminSubmissionCounts({ competitionId: sp.competition }),
  ]);

  // When nothing is ready, point at the entries still waiting for an eligibility decision.
  const toCheck = (['SUBMITTED', 'ELIGIBILITY_REVIEW'] as const)
    .map((status) => ({ status, n: counts[status]?.n ?? 0 }))
    .filter((s) => s.n > 0);
  const toCheckTotal = toCheck.reduce((sum, s) => sum + s.n, 0);
  const checkParams = new URLSearchParams({ status: toCheck[0]?.status ?? 'SUBMITTED' });
  if (sp.competition) checkParams.set('competition', sp.competition);
  const empty =
    toCheckTotal > 0 ? (
      <>
        Nothing is ready for judging yet.{' '}
        {toCheckTotal === 1 ? '1 entry is' : `${toCheckTotal} entries are`} still waiting for an eligibility
        check.{' '}
        <Link
          href={`/dashboard/admin/submissions?${checkParams}`}
          className="font-medium text-gold-700 underline underline-offset-2"
        >
          Check {toCheckTotal === 1 ? 'it' : 'them'}
        </Link>
      </>
    ) : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Programmes"
        title="Assign judges"
        lead="Send entries that have passed the eligibility check to one or more judges, and add judges to entries already being read."
      />
      <SectionTabs label="Submissions" tabs={submissionTabs(counts.ELIGIBLE?.total)} />

      <div className="space-y-6">
        {competitions.length > 1 && (
          <form
            action="/dashboard/admin/submissions/assign"
            className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-5"
          >
            <Field label="Competition" htmlFor="competition" className="min-w-0 flex-1 sm:max-w-sm">
              <Select id="competition" name="competition" defaultValue={sp.competition ?? ''}>
                <option value="">All competitions</option>
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <button type="submit" className={buttonClass('outline', 'md', 'min-h-11')}>
              Show entries
            </button>
            {sp.competition && (
              <Link
                href="/dashboard/admin/submissions/assign"
                className="inline-flex min-h-11 items-center px-1 text-sm text-gold-700 hover:underline"
              >
                Clear
              </Link>
            )}
          </form>
        )}

        <Panel
          title="New assignment"
          description="Choose the entries, then the judges who should read them. Every judge you tick is paired with every entry you tick."
        >
          <AssignJudgesForm
            waiting={waiting}
            withJudges={withJudges}
            judges={judges}
            competitionId={sp.competition}
            empty={empty}
          />
        </Panel>
      </div>
    </>
  );
}
