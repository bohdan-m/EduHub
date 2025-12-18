import { useState, type FormEvent } from "react";
import { useUserStore } from "../../store/store";
import { authApi } from "../../api/auth.api";
import styles from "./Login.module.css";
import { useNavigate } from "react-router";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  const { setUser } = useUserStore();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await authApi.login({ username, password });      
      setUser(response);
      navigate("/dashboard")
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 
                          err.message || 
                          "Error! Check your data";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.tagline}>
          EduHub - The Best Platform for Online Learning
        </div>
        <button className={styles.createAccountButton} onClick={() => {navigate("/register")}} type="button">
          Create Account
        </button>
      </header>

      <div className={styles.loginBox}>
        <h1 className={styles.title}>Log into EduHub</h1>
        
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
        
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Username:
            <input
              className={styles.input}
              name="username"
              placeholder="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="username"
            />
          </label>

          <label className={styles.label}>
            Password:
            <input
              className={styles.input}
              name="password"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          </label>

          <button 
            className={styles.submitButton} 
            type="submit" 
            disabled={isLoading}
          >
            {isLoading ? 'LOGGING IN...' : 'LOG IN'}
          </button>
        </form>

        <p className={styles.helpText}>CAN'T LOG IN?</p>
        
        <div className={styles.footer}>
          <p>Secure Login with reCAPTCHA subject to Google</p>
          <p>Terms & Privacy</p>
        </div>
      </div>
    </div>
  );
}

export default Login;