import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import logo from "../assets/logo2.png";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import toast from "react-hot-toast";

// ✅ Animation Imports
import IOSPage from "../components/IOSPage";
import useIOSSound from "../hooks/useIOSSound";
import { motion, AnimatePresence } from "framer-motion";
import { buttonTap } from "../animations/interactionVariants";
import { Helmet } from 'react-helmet-async';

// ✅ Import Modal & Biometrics
import TwoFactorVerifyModal from "../components/TwoFactorVerifyModal";
import { useBiometricAuth } from '../components/BiometricAuth';

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  // 🎭 ROLE SELECTION STATE
  const [activeRole, setActiveRole] = useState("student");

  // 🔐 Auth States
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [tempUser, setTempUser] = useState(null);
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [showBioLogin, setShowBioLogin] = useState(false);

  const { loginWithPasskey, bioLoading } = useBiometricAuth();
  const navigate = useNavigate();
  const playSound = useIOSSound();
  const [showPassword, setShowPassword] = useState(false);

  // Defining Roles with Modern SaaS Colors
  const roles = [
    { id: "student", label: "Student", icon: "fas fa-user-graduate", color: "#3b82f6", bgGradient: "linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)" },
    { id: "teacher", label: "Faculty", icon: "fas fa-chalkboard-teacher", color: "#10b981", bgGradient: "linear-gradient(135deg, #ecfdf5 0%, #a7f3d0 100%)" },
    { id: "admin", label: "Admin", icon: "fas fa-user-shield", color: "#8b5cf6", bgGradient: "linear-gradient(135deg, #f5f3ff 0%, #ddd6fe 100%)" }
  ];

  const activeColor = roles.find(r => r.id === activeRole).color;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCheckingAuth(false);
    });

    const hasBiometric = localStorage.getItem('biometric_enabled');
    const lastUser = localStorage.getItem('last_userId');
    if (hasBiometric === 'true' && lastUser) {
      setShowBioLogin(true);
    }

    return () => unsubscribe();
  }, [navigate]);

  const handleUserAuth = async (user) => {
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) throw new Error("User profile not found.");

      const userData = userDoc.data();
      if (userData.is2FAEnabled) {
        setTempUser(user);
        setShow2FAModal(true);
        return;
      }
      proceedToDashboard(userData);
    } catch (err) {
      setError("❌ Login Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    playSound('tap');
    setError("");

    if (!form.email || !form.password) {
      playSound('error');
      setError("Please enter both your email and password.");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, form.email, form.password);
      const user = userCredential.user;
      localStorage.setItem('last_userId', user.uid);
      await handleUserAuth(user);
    } catch (error) {
      handleLoginError(error);
    }
  };

  const triggerBiometricLogin = () => {
    playSound('tap');
    loginWithPasskey(async (userId) => {
      playSound('success');
      toast.success("Biometric Verified!");
      const mockUser = { uid: userId, getIdToken: async () => "BIO_TOKEN" };

      if (show2FAModal) {
        setShow2FAModal(false);
        const userDoc = await getDoc(doc(db, "users", userId));
        proceedToDashboard(userDoc.data());
      } else {
        await handleUserAuth(mockUser);
      }
    });
  };

  const handleForgotPassword = async () => {
    playSound('tap');
    if (!form.email) {
      playSound('error');
      setError("Please enter your email address first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, form.email);
      playSound('success');
      toast.success("Reset link sent! Check your email.");
      setError("");
    } catch (err) {
      playSound('error');
      setError(err.code === 'auth/user-not-found' ? "No account found with this email." : "Failed to send link.");
    }
  };

  const onVerify2FA = async (code) => {
    setVerifying2FA(true);
    try {
      const token = tempUser.getIdToken ? await tempUser.getIdToken() : "BIO_TOKEN";
      const verifyRes = await fetch('https://acadex-backend-n2wh.onrender.com/verify2FA', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ token: code, isLogin: true })
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.success) {
        playSound('error');
        toast.error("Invalid Code");
        setVerifying2FA(false);
        return;
      }

      toast.success("Identity Verified!");
      setShow2FAModal(false);
      const userDoc = await getDoc(doc(db, "users", tempUser.uid));
      proceedToDashboard(userDoc.data());
    } catch (error) {
      toast.error("Verification Error");
      setVerifying2FA(false);
    }
  };

  const proceedToDashboard = (userData) => {
    playSound('success');
    if (userData.role !== activeRole && userData.role !== 'institute-admin' && userData.role !== 'super-admin') {
      toast(`Welcome back! Routing to your ${userData.role} dashboard.`, { icon: '👋' });
    }

    if (userData.role === 'student') navigate('/student-dashboard');
    else if (userData.role === 'teacher') navigate('/teacher-dashboard');
    else if (userData.role === 'institute-admin') navigate('/admin-dashboard');
    else if (userData.role === 'super-admin') navigate('/super-admin');
    else navigate('/dashboard');
  };

  const handleLoginError = (error) => {
    playSound('error');
    let errorMessage = "Login Failed.";
    if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
      errorMessage = "Invalid credentials. Please try again.";
    }
    setError(errorMessage);
  };

  const handleGoogleSignIn = async () => {
    playSound('tap');
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      localStorage.setItem('last_userId', res.user.uid);
      await handleUserAuth(res.user);
    } catch (error) {
      playSound('error');
      setError(`Google Sign-In Error: ${error.message}`);
    }
  };

  if (checkingAuth) return null;

  // --- Dynamic Left Panel Graphics ---
  const renderLeftPanelGraphic = () => {
    switch (activeRole) {
      case 'student':
        return (
          <motion.div key="student-gfx" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="graphic-content">
            <div className="floating-shapes">
              <motion.div animate={{ y: [-10, 10, -10], rotate: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 4 }} className="shape-circle blue-light"></motion.div>
              <motion.div animate={{ y: [10, -10, 10], rotate: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 5 }} className="shape-square blue-dark"></motion.div>
            </div>
            <div className="hero-icon" style={{ color: "#2563eb" }}><i className="fas fa-graduation-cap"></i></div>
            <h2>Your Academic<br />Journey Starts Here</h2>
            <p>Track your semester attendance, manage assignments, and stay connected with your campus in one seamless platform.</p>
          </motion.div>
        );
      case 'teacher':
        return (
          <motion.div key="teacher-gfx" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="graphic-content">
            <div className="floating-shapes">
              <motion.div animate={{ y: [-15, 15, -15], scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 6 }} className="shape-blob green-light"></motion.div>
            </div>
            <div className="hero-icon" style={{ color: "#059669" }}><i className="fas fa-chalkboard-teacher"></i></div>
            <h2>Empower Your<br />Classroom</h2>
            <p>Log in to access your secure HOD dashboard, track daily attendance, and manage your class rosters effortlessly.</p>
          </motion.div>
        );
      case 'admin':
        return (
          <motion.div key="admin-gfx" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="graphic-content">
            <div className="floating-shapes">
              <motion.div animate={{ rotate: [0, 360] }} transition={{ repeat: Infinity, duration: 20, ease: "linear" }} className="shape-gear purple-light"><i className="fas fa-cog"></i></motion.div>
            </div>
            <div className="hero-icon" style={{ color: "#7c3aed" }}><i className="fas fa-building"></i></div>
            <h2>Institute<br />Command Center</h2>
            <p>Seamlessly manage student enrollment and attendance data across academic semesters for engineering, pharmacy, and agriculture departments.</p>
          </motion.div>
        );
      default: return null;
    }
  };

  return (
    <IOSPage>
      <Helmet>
        <title>Login | trackee - Smart Attendance</title>
        <meta name="description" content="Secure login for trackee." />
      </Helmet>

      <TwoFactorVerifyModal
        isOpen={show2FAModal}
        isLoading={verifying2FA}
        onClose={() => { setShow2FAModal(false); auth.signOut(); }}
        onVerify={onVerify2FA}
        onBiometricAuth={showBioLogin ? triggerBiometricLogin : null}
      />

      <div className="split-layout-wrapper">
        <div className="split-layout-container">

          {/* 🎭 LEFT PANEL */}
          <div className="left-panel" style={{ background: roles.find(r => r.id === activeRole).bgGradient }}>
            <img className="panel-logo" src={logo} alt="trackee Logo" />
            <AnimatePresence mode="wait">
              {renderLeftPanelGraphic()}
            </AnimatePresence>
          </div>

          {/* 🔐 RIGHT PANEL */}
          <div className="right-panel" style={{ '--theme-color': activeColor }}>
            <div className="login-header-mobile">
              <img className="mobile-logo" src={logo} alt="trackee Logo" />
              <h1>Welcome to <span style={{ color: activeColor }}>trackee</span></h1>
            </div>

            <div className="desktop-brand-header">
              <img className="desktop-brand-logo" src={logo} alt="trackee Logo" />
              <h1 className="desktop-brand-name" style={{ color: activeColor }}>trackee</h1>
            </div>

            <div className="form-header">
              <h3 className="form-title">Welcome back</h3>
              <p className="form-subtitle">Please enter your details to sign in.</p>
            </div>

            {/* ROLE SELECTOR */}
            <div className="role-selector-container">
              {roles.map((role) => (
                <div
                  key={role.id}
                  onClick={() => { playSound('pop'); setActiveRole(role.id); setError(""); }}
                  className={`role-tab ${activeRole === role.id ? "active" : ""}`}
                  style={{ color: activeRole === role.id ? "#fff" : "#64748b" }}
                >
                  {activeRole === role.id && (
                    <motion.div
                      layoutId="activeRoleIndicator"
                      className="active-indicator"
                      style={{ backgroundColor: role.color }}
                    />
                  )}
                  <span className="role-content">
                    <i className={role.icon}></i> {role.label}
                  </span>
                </div>
              ))}
            </div>

            {showBioLogin && activeRole !== "admin" && (
              <motion.button
                className="btn-primary bio-btn"
                onClick={triggerBiometricLogin}
                disabled={bioLoading}
                variants={buttonTap}
                whileTap="tap"
                type="button"
              >
                {bioLoading ? <span>Scanning Face/Touch ID...</span> : <><i className="fas fa-fingerprint"></i> Login with Biometrics</>}
              </motion.button>
            )}

            {showBioLogin && activeRole !== "admin" && (
              <div className="divider-with-text">
                <div className="line"></div>
                <span>OR CONTINUE WITH EMAIL</span>
                <div className="line"></div>
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Email Address</label>
                <div className="input-with-icon">
                  <i className="fas fa-envelope input-icon"></i>
                  <input
                    type="email"
                    placeholder={activeRole === 'student' ? "student@institute.edu" : activeRole === 'teacher' ? "faculty@institute.edu" : "admin@institute.edu"}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Password</label>
                <div className="input-with-icon">
                  <i className="fas fa-lock input-icon"></i>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    style={{
                      letterSpacing: showPassword ? '0.5px' : '3px',
                      transition: 'letter-spacing 0.2s ease'
                    }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="eye-toggle-btn">
                    <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                  </button>
                </div>
              </div>

              <div className="form-actions-row">
                <span onClick={handleForgotPassword} className="forgot-password-link">Forgot Password?</span>
              </div>

              {error && <p className="error-message">
                <i className="fas fa-exclamation-circle"></i> {error}
              </p>}

              <motion.button
                type="submit"
                className="btn-primary main-submit-btn"
                variants={buttonTap}
                whileTap="tap"
              >
                Sign In <i className="fas fa-arrow-right ml-2"></i>
              </motion.button>

              <div className="divider-with-text">
                <div className="line"></div>
                <span>OR</span>
                <div className="line"></div>
              </div>

              <motion.button
                type="button"
                onClick={handleGoogleSignIn}
                className="btn-google"
                variants={buttonTap}
                whileTap="tap"
              >
                <img src="https://cdn1.iconfinder.com/data/icons/google-s-logo/150/Google_Icons-09-512.png" alt="Google" className="google-icon" />
                Continue with Google
              </motion.button>

              <div className="global-footer-links">
                <p>Want to use trackee for your institute? <span className="text-link" onClick={() => { playSound('tap'); navigate("/apply"); }}>Apply here</span></p>
                <p>Are you a student? <span className="text-link" onClick={() => { playSound('tap'); navigate("/student-register"); }}>Register with Institute Code</span></p>
              </div>

            </form>

            <div className="login-footer-credits">
              <p>&copy; {new Date().getFullYear()} trackee. All rights reserved.</p>
              <p>Designed & Developed by <span>Sushant Markad</span></p>
            </div>
          </div>

        </div>
      </div>
    </IOSPage>
  );
}