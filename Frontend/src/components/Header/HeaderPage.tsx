import { useState } from "react";
import { useNavigate } from "react-router";
import { useUserStore } from "../../store/store";
import styles from "./HeaderPage.module.css";

function HeaderPage() {
    const { isAuthenticated, logout } = useUserStore();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    return (
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

                <button 
                    className={styles.hamburger} 
                    onClick={toggleMobileMenu}
                    aria-label="Toggle menu"
                >
                    <span className={styles.hamburgerLine}></span>
                    <span className={styles.hamburgerLine}></span>
                    <span className={styles.hamburgerLine}></span>
                </button>
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

            {isMobileMenuOpen && (
                <div className={styles.mobileMenu}>
                    <button className={styles.mobileNavButton} onClick={() => { navigate('/home'); setIsMobileMenuOpen(false); }}>Home</button>
                    <button className={styles.mobileNavButton} onClick={() => { navigate('/about'); setIsMobileMenuOpen(false); }}>About Us</button>
                    <button className={styles.mobileNavButton} onClick={() => { navigate('/pricing'); setIsMobileMenuOpen(false); }}>Pricing</button>
                    <button className={styles.mobileNavButton} onClick={() => { navigate('/contact'); setIsMobileMenuOpen(false); }}>Contact</button>
                    
                    <div className={styles.mobileAuth}>
                        {isAuthenticated() ? (
                            <button
                                className={styles.mobileNavButton}
                                onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                            >
                                Logout
                            </button>
                        ) : (
                            <>
                                <button className={styles.mobileNavButton}>Sign Up</button>
                                <button className={styles.mobileLoginButton}>Log In</button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}

export default HeaderPage;