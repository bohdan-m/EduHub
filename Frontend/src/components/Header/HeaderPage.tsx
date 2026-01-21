import { useUserStore } from "../../store/store";
import styles from "./HeaderPage.module.css";

function HeaderPage() {
    const { isAuthenticated, logout } = useUserStore();

    return (
        <>
            <header className={styles.header}>
                <nav className={styles.nav}>
                    <div className={styles.logoContainer}>
                        <img
                            className={styles.logo}
                            src="src/images/logo.svg"
                            alt="logo"
                        />
                    </div>
                    <div className={styles.buttonsContainer}>
                        <button className={styles.navButton}>Home</button>
                        <button className={styles.navButton}>About Us</button>
                        <button className={styles.navButton}>Pricing</button>
                        <button className={styles.navButton}>Contact</button>
                    </div>
                </nav>

                <div className={styles.auth}>
                    {isAuthenticated() ? (
                        <button
                            className={styles.navButton}
                            onClick={logout}
                        >
                            Logout
                        </button>
                    ) : (
                        <>
                            <button className={styles.navButton}>Sign Up</button>
                            <button className={styles.loginButton}>Log In</button>
                        </>
                    )}
                </div>
            </header>
        </>
    );
}

export default HeaderPage;
