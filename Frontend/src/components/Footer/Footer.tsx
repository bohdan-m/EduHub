import { useNavigate } from "react-router";
import { useUserStore } from "../../store/store";
import styles from "./Footer.module.css";

const LINKEDIN_URL = "https://www.linkedin.com/in/bohdan-matvieiev-061827392/";
const GITHUB_URL = "https://github.com/bohdan-m";
const UPWORK_URL = "https://www.upwork.com/freelancers/~019dfaddf625a49656";

function Footer() {
  const navigate = useNavigate();
  const isAuthenticated = useUserStore((state) => state.isAuthenticated());

  return (
    <footer className={styles.footer}>
      <div className={styles.wrapper}>
        <section className={styles.cta}>
          {isAuthenticated ? (
            <>
              <h3 className={styles.ctaTitle}>Keep learning</h3>
              <p className={styles.ctaText}>
                Explore new courses and continue your journey with EduHub.
              </p>
              <button
                type="button"
                className={styles.ctaButton}
                onClick={() => navigate("/home")}
              >
                Browse Courses
              </button>
            </>
          ) : (
            <>
              <h3 className={styles.ctaTitle}>Ready to start learning?</h3>
              <p className={styles.ctaText}>
                Join EduHub and access courses designed to help you grow.
              </p>
              <button
                type="button"
                className={styles.ctaButton}
                onClick={() => navigate("/register")}
              >
                Get Started
              </button>
            </>
          )}
        </section>

        <div className={styles.divider} />

        <section className={styles.social}>
          <span className={styles.socialLabel}>Connect with the creator</span>
          <div className={styles.socialLinks}>
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
              aria-label="LinkedIn profile"
            >
              <LinkedInIcon />
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
              aria-label="GitHub profile"
            >
              <GitHubIcon />
            </a>
            <a
              href={UPWORK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
              aria-label="Upwork profile"
            >
              <UpworkIcon />
            </a>
          </div>
        </section>

        <div className={styles.copyright}>
          <p>© {new Date().getFullYear()} EduHub. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function LinkedInIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={styles.icon}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={styles.icon}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      />
    </svg>
  );
}

function UpworkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      className={styles.icon}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M357.2,296.9c-17,0-33-7.2-47.4-18.9l3.5-16.6l0.1-.6c3.2-17.6,13.1-47.2,43.8-47.2c23,0,41.7,18.7,41.7,41.7S380.2,296.9,357.2,296.9L357.2,296.9z M357.2,171.4c-39.2,0-69.5,25.4-81.9,67.3c-18.8-28.3-33.1-62.2-41.4-90.8h-42.2v109.7c0,21.7-17.6,39.3-39.3,39.3s-39.3-17.6-39.3-39.3V147.8H71v109.7c0,44.9,36.5,81.8,81.4,81.8s81.4-36.9,81.4-81.8v-18.4c8.2,17.1,18.2,34.4,30.4,49.6l-25.8,121.4h43.1l18.7-88c16.4,10.5,35.2,17.1,56.8,17.1c46.2,0,83.8-37.8,83.8-84.1C440.9,209,403.4,171.4,357.2,171.4"
      />
    </svg>
  );
}

export default Footer;
