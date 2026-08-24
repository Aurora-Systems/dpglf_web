import { query } from './db';
import { clientIp } from './auth';

/**
 * Append-only record of consequential actions: admin changes, judging edits,
 * publication decisions and anything touching rights. Never written from a page
 * render — only from the action that actually changed something.
 */
export async function audit(input: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_events (actor_id, action, entity_type, entity_id, metadata, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.actorId,
        input.action,
        input.entityType,
        input.entityId ?? null,
        JSON.stringify(input.metadata ?? {}),
        await clientIp(),
      ],
    );
  } catch (e) {
    // An audit failure must not roll back the user's action, but it must be loud.
    console.error(`[audit:failed] ${input.action} ${input.entityType}: ${(e as Error).message}`);
  }
}
