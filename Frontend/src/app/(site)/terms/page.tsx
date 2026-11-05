import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of use", description: "The rules for learning and teaching on EduHub." };

const UPDATED = "November 5, 2026";

export default function TermsPage() {
  return (
    <article className="lesson-prose mx-auto mt-6 max-w-[70ch] pb-10">
      <h1>Terms of use</h1>
      <p><em>Last updated {UPDATED}.</em></p>

      <h2>Using EduHub</h2>
      <p>EduHub is free. You need an account to track progress, review, comment or teach. Keep your sign-in details to yourself; you are responsible for what happens on your account.</p>

      <h2>Teaching</h2>
      <ul>
        <li>You keep the rights to the courses you write. By publishing one, you let EduHub show it to learners and keep it available while it is published.</li>
        <li>Only publish what you have the right to share. Link to videos and articles rather than copying them.</li>
        <li>Courses must be honest about what they teach. No advertising disguised as lessons, no malware in files, no collecting learners&rsquo; personal data.</li>
      </ul>

      <h2>Reviews and comments</h2>
      <p>Be useful and respectful. Spam, harassment, hate, sexual content and personal data of others aren&rsquo;t allowed. Content reported by several people is hidden until a moderator reviews it, and may be removed. Repeated breaches can lead to the account being closed.</p>

      <h2>Certificates</h2>
      <p>A certificate shows that an account completed every lesson of a course. It is not an accredited qualification.</p>

      <h2>No warranty</h2>
      <p>Courses are written by the community, and EduHub can&rsquo;t check that every lesson is correct. The service is provided as it is, and may change or stop.</p>

      <p>Questions? <Link href="/contact">Contact us</Link>. See also the <Link href="/privacy">privacy policy</Link>.</p>
    </article>
  );
}
