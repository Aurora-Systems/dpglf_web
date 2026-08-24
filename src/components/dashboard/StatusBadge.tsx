import { Badge } from '../ui';
import { STATUS_LABELS, STATUS_TONE, type SubmissionStatus } from '@/lib/workflow';

export function StatusBadge({ status }: { status: string }) {
  const key = status as SubmissionStatus;
  return <Badge tone={STATUS_TONE[key] ?? 'neutral'}>{STATUS_LABELS[key] ?? status}</Badge>;
}
