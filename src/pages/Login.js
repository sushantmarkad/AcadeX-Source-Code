import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth"; // ✅ Added onAuthStateChanged
import { auth, provider, signInWithPopup } from "../firebase";
import AnimatedPage from "../components/AnimatedPage";
import { motion } from "framer-motion";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true); // To prevent flickering
  const navigate = useNavigate();

  // ✅ FIX 1: Auto-redirect if user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 'replace: true' creates the "No Back Button" effect
        navigate("/dashboard", { replace: true });
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.email || !form.password) {
      setError("❌ Please enter both your email and password.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, form.email, form.password);
      // ✅ FIX 2: Use replace here too
      navigate("/dashboard", { replace: true });
    } catch (error) {
      let errorMessage = "❌ Invalid email or password.";
      if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        errorMessage = "❌ Invalid credentials. Please try again.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "❌ Too many failed attempts. Try again later.";
      }
      setError(errorMessage);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    try {
      await signInWithPopup(auth, provider);
      // ✅ FIX 3: Use replace here too
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setError(`❌ Google Sign-In Error: ${error.message}`);
    }
  };

  // Prevent showing the login form for a split second if already logged in
  if (checkingAuth) return null;

  return (
    <AnimatedPage>
      <div className="login-container">
        <div className="login-header">
          <motion.img
            className="login-logo"
            src="https://iili.io/KoAVeZg.md.png"
            alt="App Logo"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
          <motion.h1
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Sign in to <span className="highlight">AcadeX</span>
          </motion.h1>
        </div>

        <motion.form
          className="login-form"
          onSubmit={handleSubmit}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="input-group">
            <label>Email address</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="********"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <motion.button
            type="submit"
            className="btn-primary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Sign In
          </motion.button>

          <div className="separator">OR</div>

          {/* Google Sign-In Button */}
          <motion.button
            type="button"
            onClick={handleGoogleSignIn}
            className="btn-google"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <i className="fab fa-google"></i> Sign in with Google
          </motion.button>

          {/* Link for New Institutes */}
          <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px' }}>
            Want to use AcadeX for your institute?{" "}
            <span
              style={{ color: "#2563eb", cursor: "pointer", fontWeight: "600" }}
              onClick={() => navigate("/apply")}
            >
              Apply here
            </span>
          </p>

          {/* Link for Student Registration */}
          <p style={{ marginTop: '10px', textAlign: 'center', fontSize: '14px' }}>
            Are you a student?{" "}
            <span
              style={{ color: "#2563eb", cursor: "pointer", fontWeight: "600" }}
              onClick={() => navigate("/student-register")}
            >
              Register with Institute Code
            </span>
          </p>
        </motion.form>
      </div>
    </AnimatedPage>
  );
}