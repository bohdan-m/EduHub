import { useNavigate } from "react-router";
import { useUserStore } from "../../store/store";
import styles from "./HeaderPage.module.css";

function HeaderPage() {
    const { isAuthenticated, logout } = useUserStore();
    const navigate = useNavigate();

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
                        <button className={styles.navButton} onClick={() => navigate('/home')}>Home</button>
                        <button className={styles.navButton} onClick={() => navigate('/about')}>About Us</button>
                        <button className={styles.navButton} onClick={() => navigate('/pricing')}>Pricing</button>
                        <button className={styles.navButton} onClick={() => navigate('/contact')}>Contact</button>
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
