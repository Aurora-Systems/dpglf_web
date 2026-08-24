/**
 * Policy placeholders.
 *
 * The business plan deliberately does not define legal wording — the Foundation
 * (with its own legal advice) supplies and approves that. Until each policy is
 * authored in the admin console, these pages state plainly what the platform
 * actually does, so nobody is asked to consent to something undocumented. The
 * copy below is operational fact about the software, not legal advice.
 */

export interface PolicyStub {
  slug: string;
  title: string;
  summary: string;
  /** Operational description shown until the approved policy is published. */
  interim: string[];
}

export const POLICY_STUBS: PolicyStub[] = [
  {
    slug: 'privacy',
    title: 'Privacy notice',
    summary: 'What personal information the Foundation collects, why, and how long it is kept.',
    interim: [
      'Accounts store a name, email address and password hash. Passwords are never stored in readable form.',
      'Writer profiles store the details you choose to publish, plus an age band. An exact date of birth is only requested where a programme’s rules require provable eligibility.',
      'Manuscripts are stored privately in Cloudflare R2 object storage. They are not public, and access is granted only to you, your assigned mentor or editor, assigned judges and Foundation staff.',
      'Email is sent through Resend for account verification, submission receipts, assignment notices and status updates. Every message the platform intends to send is recorded so delivery failures are visible.',
      'Sign-in, contact and submission endpoints are rate limited, and IP addresses are recorded against contact messages and consent records for abuse prevention and safeguarding.',
      'Administrative actions, judging changes, publication decisions and rights changes are written to an audit log.',
      'You may ask the Foundation to correct or delete your personal information at any time by contacting us. Withdrawing consent removes an entry from consideration.',
    ],
  },
  {
    slug: 'child-safeguarding',
    title: 'Child safeguarding',
    summary: 'How the Foundation protects young participants and handles concerns.',
    interim: [
      'Programmes for writers under eighteen require a parent or guardian to give consent before an entry can be judged.',
      'Consent is requested by email to the guardian named by the writer, and is recorded with the version of the consent wording that was shown, the time it was given and the address it came from.',
      'A guardian can withdraw consent at any time. Withdrawal removes the entry from consideration.',
      'We ask for the minimum information needed to establish eligibility. Where an age band is sufficient, we do not store a date of birth.',
      'Mentors and judges see only the work assigned to them. Judges in a blind round do not see the writer’s identity at all.',
      'A young person’s public author profile is opt-in and separate from their account record.',
      'Concerns about the welfare of a young person should be raised through the contact form and are escalated immediately.',
    ],
  },
  {
    slug: 'submissions',
    title: 'Submission rules',
    summary: 'What you are agreeing to when you enter a competition.',
    interim: [
      'Your story must be your own original work. You must own the copyright in it, and have permission for anything in it that is not yours.',
      'Accepted formats are .docx, PDF, RTF and plain text, up to 10 MB. Word limits are set per competition and are checked from the text of your file.',
      'A submission cannot be edited after the competition deadline unless a programme administrator reopens it for you.',
      'Each submission receives a permanent reference number. Quote it in any correspondence about your entry.',
      'The original file you submit is never overwritten. Revisions made during mentorship are stored as new versions alongside it.',
      'You may withdraw an entry before a decision is made by contacting the Foundation.',
      'The rules version you accepted is recorded with your submission, so it is always clear which terms applied to your entry.',
    ],
  },
  {
    slug: 'copyright',
    title: 'Copyright and intellectual property',
    summary: 'Who owns your story, and what rights the Foundation may hold.',
    interim: [
      'You retain copyright in your story. Entering a competition does not transfer ownership.',
      'Where the Foundation publishes a story — for example in a Perspectives anthology — the licence that permits that publication is recorded separately and shared with you before publication.',
      'Rights status never changes simply because a story has been published. Publication and licensing are tracked as distinct records.',
      'Adaptation interest from publishers or producers arrives as an enquiry. Nothing is licensed or optioned without a separate agreement.',
      'Authors whose work enters an adaptation or licensing agreement receive royalties and revenue participation on terms set out in that agreement.',
      'The specific terms offered to authors are being finalised by the Foundation and will be published here in full before any licensing takes place.',
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of use',
    summary: 'The rules for using this platform.',
    interim: [
      'Accounts are personal. Do not share your sign-in details, and tell us if you think your account has been used by someone else.',
      'Do not upload material that is unlawful, that you do not have the right to share, or that is designed to harm the platform or its users.',
      'Roles such as mentor, judge, editor and administrator are granted by the Foundation. Attempting to access material outside your role is a breach of these terms.',
      'The Foundation may suspend an account that breaches these terms, and will tell the account holder why.',
      'Service availability is best effort. Competition deadlines are the Foundation’s decision; if the platform is unavailable near a deadline, tell us and we will extend where it is fair to do so.',
    ],
  },
];

export function policyStub(slug: string): PolicyStub | undefined {
  return POLICY_STUBS.find((p) => p.slug === slug);
}
