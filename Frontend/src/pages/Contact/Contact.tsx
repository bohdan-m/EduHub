import { useState } from "react";
import DescriptionPage from "../../components/Description/DescriptionPage";
import styles from "./Contact.module.css";

const IconEmail = () => (
  <span className={styles.infoIcon} aria-hidden>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

const IconPhone = () => (
  <span className={styles.infoIcon} aria-hidden>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

const IconLocation = () => (
  <span className={styles.infoIcon} aria-hidden>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 13a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

const CONTACT_EMAIL = "bohdanmatvieiev1@gmail.com";
const CONTACT_PHONE = "+91 00000 00000";
const CONTACT_LOCATION = "The Czech Republic";

function Contact() {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => setSubmitting(false), 800);
  };

  return (
    <div className={styles.wrapper}>
      <DescriptionPage
        header="Contact Us"
        description="Welcome to EduHub's Contact page, where you can get in touch with our team for support, feedback, or partnership inquiries. Whether you have questions about courses, platform features, or technical details, we are here to help. Reach out to us and let us know how we can support your experience with EduHub."
      />
      <div className={styles.content}>
        <section className={styles.formSection} aria-labelledby="contact-form-title">
          <h2 id="contact-form-title" className={styles.formTitle}>
            Send us a Message
          </h2>
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="contact-first-name">
                  First Name
                </label>
                <input
                  id="contact-first-name"
                  name="firstName"
                  type="text"
                  className={styles.input}
                  placeholder="Enter First Name"
                  autoComplete="given-name"
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="contact-last-name">
                  Last Name
                </label>
                <input
                  id="contact-last-name"
                  name="lastName"
                  type="text"
                  className={styles.input}
                  placeholder="Enter Last Name"
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="contact-email">
                  Email
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  className={styles.input}
                  placeholder="Enter your Email"
                  autoComplete="email"
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="contact-phone">
                  Phone
                </label>
                <input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  className={styles.input}
                  placeholder="Enter Phone Number"
                  autoComplete="tel"
                />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="contact-subject">
                Subject
              </label>
              <input
                id="contact-subject"
                name="subject"
                type="text"
                className={styles.input}
                placeholder="Enter your Subject"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="contact-message">
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                className={styles.textarea}
                placeholder="Enter your Message here..."
                rows={5}
                required
              />
            </div>
            <div className={styles.submitWrap}>
              <button type="submit" className={styles.submit} disabled={submitting}>
                {submitting ? "Sending…" : "Send Your Message"}
              </button>
            </div>
          </form>
        </section>

        <aside className={styles.infoSection} aria-label="Contact information">
          <div className={styles.infoCard}>
            <IconEmail />
            <p className={styles.infoText}>{CONTACT_EMAIL}</p>
          </div>
          <div className={styles.infoCard}>
            <IconPhone />
            <p className={styles.infoText}>{CONTACT_PHONE}</p>
          </div>
          <div className={styles.infoCard}>
            <IconLocation />
            <p className={styles.infoText}>{CONTACT_LOCATION}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Contact;
