import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy policy", description: "What EduHub stores about you, why, and how to get it or delete it." };

const UPDATED = "November 5, 2026";

export default function PrivacyPage() {
  return (
    <article className="lesson-prose mx-auto mt-6 max-w-[70ch] pb-10">
      <h1>Privacy policy</h1>
      <p><em>Last updated {UPDATED}.</em></p>

      <h2>What we store</h2>
      <ul>
        <li><strong>Your account:</strong> name, email address, a hash of your password (never the password itself), whether two-factor sign-in is on, and the devices you are signed in on (browser and IP address of each session).</li>
        <li><strong>What you create:</strong> courses, lesson content and files you upload, reviews, comments and reports. Uploaded images are re-encoded, which removes camera details and location.</li>
        <li><strong>Your learning:</strong> courses you enrolled in, lessons you finished, quiz results, bookmarks and private notes.</li>
        <li><strong>Technical logs:</strong> request logs (address, path, time) kept for security and troubleshooting, and error reports without personal data.</li>
      </ul>

      <h2>Why</h2>
      <p>Only to run the service: to sign you in, show your progress, show your courses to learners, keep the platform free of abuse and fix problems. We don&rsquo;t sell data, show ads or use tracking cookies. The only cookie is the session cookie that keeps you signed in.</p>

      <h2>Who sees what</h2>
      <ul>
        <li>Everyone: published and unlisted courses, your name as their author, your author profile, reviews and comments.</li>
        <li>Course authors: how many learners finished each lesson and how quizzes went, never who answered what.</li>
        <li>Only you: drafts, notes, bookmarks and your quiz answers.</li>
        <li>Moderators: content that was reported.</li>
      </ul>
      <p>Emails are sent through an email provider; videos you embed are played by YouTube or Vimeo, which apply their own policies when a video plays.</p>

      <h2>Your rights</h2>
      <p>From <Link href="/settings">Settings</Link> you can download everything we store about you, change your details, and delete your account. Deleting removes your account, courses, files, progress, reviews and comments at once; backups that contain them are overwritten within 30 days.</p>
      <p>For anything else, <Link href="/contact">contact us</Link>.</p>
    </article>
  );
}
