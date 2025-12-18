import { useState, type FormEvent } from "react";
import { useUserStore } from "../../store/store";
import { authApi } from "../../api/auth.api";
import styles from "./Login.module.css";
import { useNavigate } from "react-router";

function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  const { setUser } = useUserStore();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const responseRegister = await authApi.register({ username, password, email, role }); 
      
      if (responseRegister) {
        const responseLogin = await authApi.login({ username, password });
        setUser(responseLogin);
      };
    } catch (err: any) {
      const errorMessage = err.responseLogin?.data?.message || 
                          err.responseRegister?.data?.message || 
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
        <button className={styles.createAccountButton} onClick={() => {navigate("/login")}} type="button">
          Already have an account
        </button>
      </header>

      <div className={styles.loginBox}>
        <h1 className={styles.title}>Register EduHub</h1>
        
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
        
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Email:
            <input
              className={styles.input}
              name="email"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </label>

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

          <div className={styles.selectWrapper}>
            <select 
              className={styles.select}
              value={role} 
              onChange={e => setRole(e.target.value as "student" | "teacher")}
              disabled={isLoading}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>

          <button 
            className={styles.submitButton} 
            type="submit" 
            disabled={isLoading}
          >
            {isLoading ? 'REGISTER...' : 'SIGN UP'}
          </button>
        </form>

        <p className={styles.helpText}>CAN'T REGISTER?</p>
        
        <div className={styles.footer}>
          <p>Secure Login with reCAPTCHA subject to Google</p>
          <p>Terms & Privacy</p>
        </div>
      </div>
    </div>
  );
}

export default Register;