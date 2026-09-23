import { PageHeader } from '@/components/dashboard/Shell';
import { Panel } from '@/components/ui';
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

export default async function AdminSettingsPage() {
  await requireRole(['super_admin'], '/dashboard/admin/settings');
  const settings = await allSettings();
  const announcement = settings.find((s) => s.key === 'site.announcement');
  const others = settings.filter((s) => s.key !== 'site.announcement');

  return (
    <>
      <PageHeader
        title="Settings"
        lead="Operational configuration. Restricted to super admins; every change is audited."
      />

      <div className="space-y-6">
        <Panel
          title="Site announcement"
          description="Shown as a banner at the top of the marketing homepage. Use it for calls for submissions, deadline reminders and results news. Leave empty to hide it."
        >
          <SettingForm
            settingKey="site.announcement"
            currentValue={announcement ? display(announcement.value) : ''}
            label="Announcement text"
            hint="Plain text. Clearing the field removes the banner."
            multiline
          />
        </Panel>

        <Panel
          title="Other settings"
          description="Generic key/value store for operational configuration. Values are stored as JSON."
        >
          {others.length > 0 && (
            <ul className="mb-6 divide-y divide-line">
              {others.map((s) => (
                <li key={s.key} className="py-4">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <code className="font-mono text-[13px] text-forest-800">{s.key}</code>
                    <span className="text-xs text-muted">
                      {formatDateTime(s.updated_at)}
                      {s.updated_by_name && ` · ${s.updated_by_name}`}
                    </span>
                  </div>
                  <SettingForm settingKey={s.key} currentValue={display(s.value)} label="Value" />
                </li>
              ))}
            </ul>
          )}
          <div className={others.length > 0 ? 'border-t border-line pt-5' : ''}>
            <NewSettingForm />
          </div>
        </Panel>
      </div>
    </>
  );
}
