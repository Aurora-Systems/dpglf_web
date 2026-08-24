import { z } from 'zod';
import { ROLES } from './roles';

/**
 * Input schemas. Every server action and route handler parses its input here
 * before touching the database — the client-side `required` attributes are a
 * convenience, never the check.
 */

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
const name = z.string().trim().min(1, 'Required').max(120);
const optionalText = (max: number) => z.string().trim().max(max).optional().default('');

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200, 'That password is too long');

export const signupSchema = z.object({
  name,
  email,
  password: passwordSchema,
  // Drives whether guardian consent is required before an entry can be judged.
  ageBand: z.enum(['under_13', '13_15', '16_17', '18_24', '25_plus']),
  country: z.string().trim().max(80).optional().default(''),
  acceptTerms: z.literal(true, { message: 'You must accept the terms to continue' }),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password').max(200),
  next: z.string().max(300).optional(),
});

export const requestResetSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});

export const profileSchema = z.object({
  displayName: name,
  penName: optionalText(120),
  bio: optionalText(2000),
  country: optionalText(80),
  city: optionalText(80),
  school: optionalText(160),
  languages: z.string().trim().max(200).optional().default(''),
  website: z.union([z.string().trim().url('Enter a full URL including https://'), z.literal('')]).optional(),
  achievements: optionalText(2000),
  isPublic: z.coerce.boolean().optional().default(false),
});

// ---- submissions -------------------------------------------------------------

export const submissionMetaSchema = z.object({
  title: z.string().trim().min(2, 'Give your story a title').max(180),
  synopsis: z
    .string()
    .trim()
    .min(40, 'Write at least a couple of sentences')
    .max(1500, 'Keep the synopsis under 1500 characters'),
  language: z.string().trim().min(1).max(60),
  genre: z.string().trim().max(60).optional().default(''),
  themes: z.array(z.string().trim().max(60)).max(6).optional().default([]),
  culturalContext: optionalText(1000),
});

export const declarationsSchema = z.object({
  original: z.literal(true, { message: 'You must confirm the story is your own work' }),
  ownsCopyright: z.literal(true, { message: 'You must confirm you own the copyright' }),
  permissions: z.literal(true, { message: 'You must confirm any permissions needed are in place' }),
  acceptsRules: z.literal(true, { message: 'You must accept the competition rules' }),
});

export const guardianConsentSchema = z.object({
  guardianName: name,
  guardianEmail: email,
  guardianPhone: z.string().trim().max(40).optional().default(''),
  relationship: z.string().trim().min(2, 'Required').max(60),
});

// ---- judging -------------------------------------------------------------------

export const reviewScoreSchema = z.object({
  criterionId: z.string().uuid(),
  score: z.coerce.number().min(0).max(100),
  comment: z.string().trim().max(1000).optional().default(''),
});

export const reviewSchema = z.object({
  assignmentId: z.string().uuid(),
  scores: z.array(reviewScoreSchema).min(1, 'Score every criterion'),
  comments: z.string().trim().max(4000).optional().default(''),
  internalNotes: z.string().trim().max(4000).optional().default(''),
  recommendation: z.enum(['shortlist', 'maybe', 'reject']),
  final: z.coerce.boolean().optional().default(false),
});

export const conflictSchema = z.object({
  assignmentId: z.string().uuid(),
  note: z.string().trim().min(5, 'Tell us briefly why').max(600),
});

// ---- mentorship / editorial -------------------------------------------------------

export const feedbackSchema = z.object({
  threadId: z.string().uuid().optional(),
  submissionId: z.string().uuid().optional(),
  subject: z.string().trim().max(160).optional().default(''),
  body: z.string().trim().min(2, 'Write a message').max(6000),
  visibility: z.enum(['writer', 'internal']).default('writer'),
});

export const milestoneSchema = z.object({
  mentorshipId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: optionalText(1000),
  dueAt: z.string().trim().max(40).optional().default(''),
});

// ---- competitions / admin ----------------------------------------------------------

export const competitionSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'Lower-case letters, numbers and hyphens only')
    .min(2)
    .max(80),
  tagline: optionalText(200),
  description: optionalText(4000),
  rulesHtml: z.string().max(40_000).optional().default(''),
  eligibilityHtml: z.string().max(40_000).optional().default(''),
  themes: z.string().trim().max(600).optional().default(''),
  countries: z.string().trim().max(600).optional().default(''),
  minAge: z.coerce.number().int().min(0).max(120).optional(),
  maxAge: z.coerce.number().int().min(0).max(120).optional(),
  wordMin: z.coerce.number().int().min(0).max(200_000),
  wordMax: z.coerce.number().int().min(1).max(200_000),
  maxEntries: z.coerce.number().int().min(1).max(20),
  opensAt: z.string().trim().max(40).optional().default(''),
  closesAt: z.string().trim().max(40).optional().default(''),
  resultsAt: z.string().trim().max(40).optional().default(''),
  blindJudging: z.coerce.boolean().optional().default(false),
  allowScoreRevision: z.coerce.boolean().optional().default(false),
  requiresGuardianConsent: z.coerce.boolean().optional().default(false),
  status: z.enum(['draft', 'open', 'closed', 'judging', 'completed', 'archived']),
  rubricId: z.string().uuid().optional().or(z.literal('')),
});

export const roleUpdateSchema = z.object({
  userId: z.string().uuid(),
  roles: z.array(z.enum(ROLES)).max(ROLES.length),
});

export const archiveMetaSchema = z.object({
  storyId: z.string().uuid(),
  country: optionalText(80),
  region: optionalText(80),
  language: optionalText(60),
  genre: optionalText(60),
  themes: z.string().trim().max(400).optional().default(''),
  keywords: z.string().trim().max(600).optional().default(''),
  ageBand: optionalText(30),
  culturalContext: optionalText(1500),
  edition: optionalText(80),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  visibility: z.enum(['private', 'internal', 'partner', 'public_excerpt', 'public_full']),
  featured: z.coerce.boolean().optional().default(false),
  adaptationReady: z.coerce.boolean().optional().default(false),
  adaptationNotes: optionalText(2000),
});

export const rightsSchema = z.object({
  storyId: z.string().uuid(),
  ownerName: optionalText(160),
  ownershipNote: optionalText(400),
  licenceType: z.enum(['none', 'anthology', 'non_exclusive', 'exclusive', 'option', 'educational']),
  territory: optionalText(160),
  termStart: z.string().trim().max(40).optional().default(''),
  termEnd: z.string().trim().max(40).optional().default(''),
  restrictions: optionalText(2000),
  status: z.enum(['draft', 'active', 'expired', 'terminated']),
  notes: optionalText(2000),
});

// ---- public forms ---------------------------------------------------------------

export const contactSchema = z.object({
  name,
  email,
  organisation: optionalText(160),
  topic: z.enum(['general', 'partnership', 'media', 'schools', 'submissions', 'rights', 'support']),
  subject: optionalText(200),
  message: z.string().trim().min(20, 'Please give us a little more detail').max(4000),
  // Honeypot: bots fill hidden fields, people do not.
  website: z.string().max(0).optional(),
});

export const newsletterSchema = z.object({
  email,
  name: z.string().trim().max(120).optional().default(''),
  website: z.string().max(0).optional(),
});

export const inquirySchema = z.object({
  storyId: z.string().uuid().optional().or(z.literal('')),
  requesterName: name,
  requesterEmail: email,
  requesterRole: optionalText(120),
  organisation: optionalText(160),
  format: z.enum(['animation', 'film', 'television', 'audio', 'educational', 'publishing', 'other']),
  message: z.string().trim().min(20, 'Please describe your interest').max(3000),
  website: z.string().max(0).optional(),
});

/** Turn a ZodError into `{ field: message }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Split a comma/newline separated input into a clean list. */
export function toList(value: string, max = 20): string[] {
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}
