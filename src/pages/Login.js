import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth,TZprovider, signInWithPopup } from "../firebase";
import { GoogleAuthProvider } from "firebase/auth";

// ✅ Animation Imports
import IOSPage from "../components/IOSPage";
import useIOSSound from "../hooks/useIOSSound";
import { motion } from "framer-motion";
import { buttonTap } from "../animations/interactionVariants";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const playSound = useIOSSound(); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/dashboard", { replace: true });
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    playSound('tap');
    setError("");

    if (!form.email || !form.password) {
      playSound('error');
      setError("❌ Please enter both your email and password.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, form.email, form.password);
      playSound('success');
      navigate("/dashboard", { replace: true });
    } catch (error) {
      playSound('error');
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
    playSound('tap');
    setError("");
    try {
      // Create a new provider instance for this call to ensure no conflict
      const googleProvider = new GoogleAuthProvider();
      await signInWithPopup(auth, googleProvider);
      playSound('success');
      navigate("/dashboard", { replace: true });
    } catch (error) {
      playSound('error');
      setError(`❌ Google Sign-In Error: ${error.message}`);
    }
  };

  if (checkingAuth) return null;

  return (
    <IOSPage>
      {/* ✅ WRAPPER ADDED HERE to handle centering without breaking global body */}
      <div className="login-wrapper">
        <div className="login-container">
          <div className="login-header">
            <img
              className="login-logo"
              src="https://iili.io/KoAVeZg.md.png"
              alt="App Logo"
            />
            <h1>
              Sign in to <span className="highlight">AcadeX</span>
            </h1>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
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
              variants={buttonTap}
              whileTap="tap"
            >
              Sign In
            </motion.button>
            
            <div className="separator">OR</div>

            <motion.button 
              type="button" 
              onClick={handleGoogleSignIn} 
              className="btn-google"
              variants={buttonTap}
              whileTap="tap"
            >
              <i className="fab fa-google"></i> Sign in with Google
            </motion.button>

            <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px' }}>
              Want to use AcadeX for your institute?{" "}
              <span
                style={{ color: "#2563eb", cursor: "pointer", fontWeight: "600" }}
                onClick={() => { playSound('tap'); navigate("/apply"); }}
              >
                Apply here
              </span>
            </p>

            <p style={{ marginTop: '10px', textAlign: 'center', fontSize: '14px' }}>
              Are you a student?{" "}
              <span
                style={{ color: "#2563eb", cursor: "pointer", fontWeight: "600" }}
                onClick={() => { playSound('tap'); navigate("/student-register"); }}
              >
                Register with Institute Code
              </span>
            </p>
          </form>
        </div>
      </div>
    </IOSPage>
  );
}