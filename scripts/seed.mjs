#!/usr/bin/env node
/**
 * Seed the Foundation's launch content: the super-admin account, Tales from the
 * Baobab, a judging rubric, the partner organisations named in the business
 * plan, and a first news post.
 *
 * Idempotent — every insert is ON CONFLICT DO NOTHING or keyed on a slug, so
 * running it twice changes nothing.
 *
 *   node scripts/seed.mjs "admin@example.org" "a-strong-password"
 */
import { readFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
import { neonConfig, Pool } from '@neondatabase/serverless';

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = /^([A-Za-z_][A-Za-z_0-9]*)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* ambient env only */
  }
}
loadEnv('.env.local');

const [, , adminEmail, adminPassword] = process.argv;
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

/** Must match src/lib/crypto.ts exactly, or the seeded admin cannot sign in. */
async function hashPassword(password) {
  const iterations = 210_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  const b64 = (b) => Buffer.from(b).toString('base64');
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}

if (!neonConfig.webSocketConstructor && typeof globalThis.WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}
const pool = new Pool({ connectionString: url, max: 1 });
const q = async (text, params = []) => (await pool.query(text, params)).rows;

const POLICIES = [
  ['privacy', 'Privacy notice', 'What personal information the Foundation collects, why, and how long it is kept.'],
  ['child-safeguarding', 'Child safeguarding', 'How the Foundation protects young participants and handles concerns.'],
  ['submissions', 'Submission rules', 'What you are agreeing to when you enter a competition.'],
  ['copyright', 'Copyright and intellectual property', 'Who owns your story, and what rights the Foundation may hold.'],
  ['terms', 'Terms of use', 'The rules for using this platform.'],
];

const PARTNERS = [
  ['Emoworld Publishers', 'emoworld-publishers', 'publisher', 'Publishing partner: editorial support, contracts, distribution and author representation for selected writers.'],
  ['Bluewalk Productions', 'bluewalk-productions', 'production', 'Story development, adaptation planning and production opportunities.'],
  ['DreamHaus Productions', 'dreamhaus-productions', 'production', 'Visual storytelling and media development expertise.'],
  ['BAG Animation', 'bag-animation', 'production', 'Animation development and visual adaptation capability.'],
];

const CRITERIA = [
  ['Story and structure', 'Does it hold together, and does something happen that matters?', 10, 1.5],
  ['Voice and originality', 'Does this sound like someone, and like nobody else?', 10, 1.5],
  ['Cultural authenticity', 'Is the world of the story lived-in and true?', 10, 1.0],
  ['Craft', 'Language, dialogue, pacing and control.', 10, 1.0],
  ['Impact', 'Does it stay with you after the last line?', 10, 1.0],
];

const BAOBAB_RULES = `
<p>Tales from the Baobab is open to writers under the age of eighteen. Entries must be the writer's
own original work, written in the language of entry, and not previously published.</p>
<h3>Length and format</h3>
<p>Stories must be between 500 and 3,000 words. Upload a Word (.docx), PDF, RTF or plain text file
of no more than 10 MB. Do not put your name inside the manuscript — judging is blind.</p>
<h3>Consent</h3>
<p>A parent or guardian must give consent before an entry can be judged. The platform emails them a
link once you add their details.</p>
<h3>Rights</h3>
<p>You keep copyright in your story. If your story is selected for publication, the Foundation will
agree the specific licence with you and your guardian before anything is published.</p>
<h3>Judging</h3>
<p>Every entry is read in full and scored against a published rubric by assigned judges who do not
see your name. Decisions of the judging panel are final.</p>
`;

const BAOBAB_ELIGIBILITY = `
<p>Open to writers under eighteen from Zimbabwe, and progressively across Africa and the global
African diaspora. One entry per writer per edition.</p>
<p>Entries in Shona and Ndebele are welcome alongside English — say which language you are writing
in when you submit.</p>
`;

async function main() {
  // ---- super admin ---------------------------------------------------------
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 10) throw new Error('Choose an admin password of at least 10 characters.');
    const [existing] = await q(`SELECT id FROM users WHERE lower(email) = lower($1)`, [adminEmail]);
    let userId = existing?.id;
    if (!userId) {
      const [row] = await q(
        `INSERT INTO users (email, name, password_hash, email_verified_at)
         VALUES ($1, 'Foundation Administrator', $2, now()) RETURNING id`,
        [adminEmail, await hashPassword(adminPassword)],
      );
      userId = row.id;
      await q(
        `INSERT INTO profiles (user_id, display_name, slug) VALUES ($1, 'Foundation Administrator', $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, `admin-${userId.slice(0, 6)}`],
      );
      console.log(`Created super admin ${adminEmail}`);
    } else {
      console.log(`Super admin ${adminEmail} already exists — leaving the password alone.`);
    }
    for (const role of ['super_admin', 'admin', 'editor']) {
      await q(`INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
        userId,
        role,
      ]);
    }
  } else {
    console.log('No admin email/password given — skipping the super-admin account.');
  }

  // ---- rubric --------------------------------------------------------------
  let [rubric] = await q(`SELECT id FROM rubrics WHERE name = $1`, ['Tales from the Baobab']);
  if (!rubric) {
    [rubric] = await q(
      `INSERT INTO rubrics (name, description) VALUES ($1, $2) RETURNING id`,
      ['Tales from the Baobab', 'Default rubric for the flagship youth short story competition.'],
    );
    for (const [i, [label, description, max, weight]] of CRITERIA.entries()) {
      await q(
        `INSERT INTO rubric_criteria (rubric_id, label, description, max_score, weight, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [rubric.id, label, description, max, weight, i],
      );
    }
    console.log(`Created rubric with ${CRITERIA.length} criteria.`);
  }

  // ---- competition ---------------------------------------------------------
  const [comp] = await q(
    `INSERT INTO competitions
       (name, slug, tagline, description, rules_html, eligibility_html, themes, languages,
        countries, min_age, max_age, word_min, word_max, max_entries, status, blind_judging,
        requires_guardian_consent, is_featured, rubric_id, rules_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft',true,true,true,$15,'v1')
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
    [
      'Tales from the Baobab',
      'tales-from-the-baobab',
      'An annual Afrocentric short story competition for writers under eighteen — from Zimbabwe, across Africa and the global African diaspora.',
      'The Foundation’s flagship talent discovery programme. Tales from the Baobab looks for voices capable of contributing to Africa’s cultural and intellectual landscape, not simply technically proficient writers.',
      BAOBAB_RULES.trim(),
      BAOBAB_ELIGIBILITY.trim(),
      [
        'African history',
        'Cultural heritage',
        'Traditional knowledge',
        'Contemporary social realities',
        'Innovation and entrepreneurship',
        'Environmental stewardship',
        'Community values',
        'Future African imaginaries',
      ],
      ['English', 'Shona', 'Ndebele'],
      ['Zimbabwe'],
      null,
      17,
      500,
      3000,
      1,
      rubric.id,
    ],
  );
  console.log(comp ? 'Created Tales from the Baobab (status: draft).' : 'Tales from the Baobab already exists.');

  // ---- partners ------------------------------------------------------------
  for (const [i, [name, slug, type, description]] of PARTNERS.entries()) {
    await q(
      `INSERT INTO organisations (name, slug, type, description, partner_status, is_public, sort_order)
       VALUES ($1,$2,$3,$4,'prospect',true,$5)
       ON CONFLICT (slug) DO NOTHING`,
      [name, slug, type, description, i],
    );
  }
  console.log(`Ensured ${PARTNERS.length} partner organisations.`);

  // ---- policy shells -------------------------------------------------------
  // Left as drafts: the public pages show the interim operational description
  // until the Foundation publishes approved wording.
  for (const [slug, title, summary] of POLICIES) {
    await q(
      `INSERT INTO pages (slug, title, summary, body_html, kind, status)
       VALUES ($1,$2,$3,'','policy','draft')
       ON CONFLICT (slug) DO NOTHING`,
      [slug, title, summary],
    );
  }
  console.log(`Ensured ${POLICIES.length} policy pages (as drafts).`);

  // ---- first news post -----------------------------------------------------
  await q(
    `INSERT INTO news_posts (slug, title, excerpt, body_html, tags, status, published_at)
     VALUES ($1,$2,$3,$4,$5,'draft',NULL)
     ON CONFLICT (slug) DO NOTHING`,
    [
      'the-foundation-opens',
      'The Dr. Phillip Gwatidzo Literary Foundation opens its doors',
      'A new ecosystem for African youth storytelling — from first submission to screen.',
      `<p>The Foundation is built on a simple observation: writing should be a profession, not only
       a hobby. Musicians progress from discovery to recording contracts. Athletes progress from
       grassroots competition to professional leagues. Writers deserve the same structured
       pathway.</p>
       <p>Over the coming months we will open Tales from the Baobab, assemble the first cohort of
       mentors, and begin building the Story Archive.</p>`,
      ['announcement'],
    ],
  );

  console.log('\nSeed complete.');
}

main()
  .catch((e) => {
    console.error(`Seed failed: ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
