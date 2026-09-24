import { publicUrl } from './r2';

/**
 * The Foundation's supplied brand assets, all held in the Cloudflare R2
 * `aurorasystems` bucket under `dpglf/`. Nothing brand-related is checked into
 * the repo except the favicons, which Next.js requires as local files.
 *
 * Re-uploading with `node scripts/upload-assets.mjs` keeps these keys stable,
 * so refreshing an asset never means touching code.
 */
export const BRAND = {
  /** Circular leopard emblem, transparent outside the ring. */
  markLg: publicUrl('dpglf/brand/logo-mark-1024.png'),
  mark: publicUrl('dpglf/brand/logo-mark-512.png'),
  markSm: publicUrl('dpglf/brand/logo-mark-256.png'),
  markXs: publicUrl('dpglf/brand/logo-mark-128.png'),
  /** Full lockup: emblem plus wordmark on the forest field. */
  lockup: publicUrl('dpglf/brand/logo-lockup-1600.jpg'),
  lockupSm: publicUrl('dpglf/brand/logo-lockup-800.jpg'),
  founder: publicUrl('dpglf/brand/founder-portrait-720.jpg'),
  founderSm: publicUrl('dpglf/brand/founder-portrait-480.jpg'),
  introVideo: publicUrl('dpglf/media/intro.mp4'),
  introPoster: publicUrl('dpglf/media/intro-poster.jpg'),
} as const;

/**
 * Bodies that endorse the Foundation, shown in the site footer. `logo` stays
 * null until the official file is supplied: upload it with
 * `node scripts/upload-assets.mjs <dir>` (filenames in that script's KEYS, e.g.
 * endorsement-nacz.png) and point `logo` at its key. Until then the footer
 * shows the body's name in place of the logo.
 */
export const ENDORSEMENTS: { slug: string; name: string; logo: string | null }[] = [
  { slug: 'mosrac', name: 'Ministry of Sport, Recreation, Arts and Culture', logo: null },
  { slug: 'mopse', name: 'Ministry of Primary and Secondary Education', logo: null },
  { slug: 'nacz', name: 'National Arts Council of Zimbabwe', logo: null },
];

export const SITE = {
  name: 'Dr. Phillip Gwatidzo Literary Foundation',
  shortName: 'DPGLF',
  tagline: 'From Grassroots Narratives to Global Screens',
  description:
    'DPGLF discovers, mentors, publishes, archives and adapts authentic Afro-inspired youth stories, building Africa’s leading youth storytelling and intellectual property ecosystem.',
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  inbox: process.env.FOUNDATION_INBOX ?? 'hello@dpglf.org',
} as const;

/** The six ecosystem stages. The whole product is organised around these. */
export const STAGES = [
  {
    key: 'discover',
    number: '01',
    name: 'Discover',
    headline: 'Identifying Africa’s next generation of storytellers',
    blurb:
      'Annual competitions, school outreach and open digital submissions surface young writers who would otherwise stay invisible.',
    detail:
      'Tales from the Baobab is the Foundation’s flagship discovery programme: an Afrocentric short story competition for writers under eighteen, opening in Zimbabwe and widening across Africa and the diaspora.',
  },
  {
    key: 'develop',
    number: '02',
    name: 'Develop',
    headline: 'Transforming talent into excellence',
    blurb:
      'Selected writers are paired with established authors, editors and industry professionals for a structured mentorship cycle.',
    detail:
      'Mentorship covers story structure, character, dialogue, editing, research, cultural authenticity and intellectual property awareness, building authors and not just better single stories.',
  },
  {
    key: 'publish',
    number: '03',
    name: 'Publish',
    headline: 'Creating professional opportunities through publishing',
    blurb:
      'Editorial support, professional design and real publishing routes, in partnership with Emoworld Publishers.',
    detail:
      'Perspectives, the annual anthology, promotes roughly twenty writers at once (emerging voices alongside established African authors), so a first publication arrives years earlier than the traditional route allows.',
  },
  {
    key: 'archive',
    number: '04',
    name: 'Archive',
    headline: 'Preserving Africa’s contemporary storytelling heritage',
    blurb:
      'A permanent, searchable repository of youth narratives, with the cultural and language metadata that makes them findable.',
    detail:
      'The Story Archive is a cultural preservation platform, a research resource, a talent discovery tool and a structured catalogue of adaptation-ready intellectual property.',
  },
  {
    key: 'adapt',
    number: '05',
    name: 'Adapt',
    headline: 'From Page to Pixel',
    blurb:
      'A structured pathway for evaluating stories for animation, television, film, audio drama and educational media.',
    detail:
      'Working with production partners including Bluewalk Productions, DreamHaus Productions and BAG Animation, selected stories are assessed for adaptation readiness and developed toward screen.',
  },
  {
    key: 'commercialize',
    number: '06',
    name: 'Commercialize',
    headline: 'Turning stories into sustainable value',
    blurb:
      'Licensing, adaptation rights, educational licensing and royalties, with authors retaining ownership and sharing in revenue.',
    detail:
      'Rights are recorded, professionally managed and strategically licensed so that value created by African stories returns to African creators.',
  },
] as const;

export type Stage = (typeof STAGES)[number];
