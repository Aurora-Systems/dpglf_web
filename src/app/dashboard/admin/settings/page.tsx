import Link from 'next/link';
import { PageHeader } from '@/components/dashboard/Shell';
import { FormSection } from '@/components/form';
import { Badge, Card } from '@/components/ui';
import { requireRole } from '@/lib/permissions';
import { formatDateTime } from '@/lib/format';
import { allSettings } from '@/features/admin/queries';
import { NewSettingForm, SettingForm } from '@/features/admin/Forms';

/** Extract the editable string from a stored setting value. */
function display(value: unknown): string {
  if (value && typeof value === 'object' && 'text' in (value as Record<string, unknown>)) {
    const text = (value as Record<string, unknown>).text;
    if (typeof text === 'string') return text;
  }
  return JSON.stringify(value);
}

function Updated({ at, by }: { at: string; by: string | null }) {
  return (
    <p className="text-xs text-muted">
      Last changed {formatDateTime(at)}
      {by && ` by ${by}`}
    </p>
  );
}

export default async function AdminSettingsPage() {
  await requireRole(['super_admin'], '/dashboard/admin/settings');
  const settings = await allSettings();
  const announcement = settings.find((s) => s.key === 'site.announcement');
  const announcementText = announcement ? display(announcement.value) : '';
  // The homepage shows the banner only for non-blank text (see siteAnnouncement).
  const bannerText = (announcement?.value as { text?: unknown } | undefined)?.text;
  const showing = typeof bannerText === 'string' && bannerText.trim() !== '';
  const others = settings.filter((s) => s.key !== 'site.announcement');

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Settings"
        lead={
          <>
            Only super admins can see this page. Every change is recorded under{' '}
            <Link href="/dashboard/admin/audit" className="text-gold-700 hover:underline">
              Activity &amp; email
            </Link>
            .
          </>
        }
      />

      <Card className="space-y-8 p-5 sm:p-6">
        <FormSection
          title="Site announcement"
          description="A banner at the top of the homepage, for calls for entries, deadline reminders and results news."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={showing ? 'good' : 'neutral'}>{showing ? 'Showing on the homepage' : 'Hidden'}</Badge>
            {announcement && <Updated at={announcement.updated_at} by={announcement.updated_by_name} />}
          </div>
          <SettingForm
            settingKey="site.announcement"
            currentValue={announcementText}
            label="Announcement text"
            hint="Plain text. Clear the field and save to remove the banner."
            multiline
          />
        </FormSection>

        <FormSection
          title="Other settings"
          description="Operational values stored by key. Clear a value and save to remove that setting."
        >
          {others.length === 0 ? (
            <p className="text-sm text-muted">No other settings are stored.</p>
          ) : (
            <ul className="space-y-4">
              {others.map((s) => (
                <li key={s.key} className="rounded-lg border border-line p-4">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <code className="font-mono text-[13px] text-forest-800 wrap-anywhere">{s.key}</code>
                    <Updated at={s.updated_at} by={s.updated_by_name} />
                  </div>
                  <SettingForm settingKey={s.key} currentValue={display(s.value)} label="Value" />
                </li>
              ))}
            </ul>
          )}
        </FormSection>

        <FormSection
          title="Add a setting"
          description="For a new operational key. Saving an existing key replaces its value."
        >
          <NewSettingForm />
        </FormSection>
      </Card>
    </>
  );
}
