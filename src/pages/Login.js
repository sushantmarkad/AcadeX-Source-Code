import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import logo from "../assets/logo.png";
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
import { motion } from "framer-motion";
import { buttonTap } from "../animations/interactionVariants";

// ✅ Import the New Modal
import TwoFactorVerifyModal from "../components/TwoFactorVerifyModal";

// ✅ Import Biometric Hook
import { useBiometricAuth } from '../components/BiometricAuth';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // 🔐 2FA State
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [tempUser, setTempUser] = useState(null); // Stores user while verifying
  const [verifying2FA, setVerifying2FA] = useState(false);

  // 👆 Biometric State
  const [showBioLogin, setShowBioLogin] = useState(false);
  const { loginWithPasskey, bioLoading } = useBiometricAuth();

  const navigate = useNavigate();
  const playSound = useIOSSound(); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCheckingAuth(false);
    });

    // 👆 Check if this device has Biometrics enabled
    const hasBiometric = localStorage.getItem('biometric_enabled');
    const lastUser = localStorage.getItem('last_userId');
    if (hasBiometric === 'true' && lastUser) {
      setShowBioLogin(true);
    }

    return () => unsubscribe();
  }, [navigate]);

  // --- 1. HANDLE LOGIN (Initial Step) ---
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
      // Login with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, form.email, form.password);
      const user = userCredential.user;

      // Save ID for next time (Enables the biometric button for future visits)
      localStorage.setItem('last_userId', user.uid);

      // 🚨 Super Admin Bypass
      if (user.email === "scheduplan1@gmail.com") {
          playSound('success');
          navigate('/super-admin');
          return;
      }

      // Check Database for 2FA
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) throw new Error("User profile not found.");
      
      const userData = userDoc.data();

      if (userData.is2FAEnabled) {
          // 🛑 STOP! Show Custom 2FA Modal
          setTempUser(user); // Save user for step 2
          setShow2FAModal(true); // Open Modal
          return;
      }

      // No 2FA? Proceed to Dashboard
      proceedToDashboard(userData);

    } catch (error) {
      handleLoginError(error);
    }
  };

  // --- 👆 HANDLE BIOMETRIC LOGIN ---
  const triggerBiometricLogin = () => {
    playSound('tap');
    loginWithPasskey(async (userId) => {
        // Success Callback
        playSound('success');
        toast.success("Biometric Verified!");
        
        // Fetch user role to route them correctly
        try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
                proceedToDashboard(userDoc.data());
            } else {
                setError("❌ User data not found.");
            }
        } catch (err) {
            setError("❌ Error fetching user profile.");
        }
    });
  };

  // --- 🔑 HANDLE FORGOT PASSWORD (Fixes your issue) ---
  const handleForgotPassword = async () => {
    playSound('tap');
    if (!form.email) {
      playSound('error');
      setError("❌ Please enter your email address first.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, form.email);
      playSound('success');
      toast.success("Reset link sent! Check your email.");
      setError(""); // Clear previous errors
    } catch (err) {
      console.error(err);
      playSound('error');
      if (err.code === 'auth/user-not-found') {
          setError("❌ No account found with this email.");
      } else {
          setError("❌ Failed to send link. Try again.");
      }
    }
  };

  // --- 2. HANDLE 2FA VERIFICATION (Step 2) ---
  const onVerify2FA = async (code) => {
      setVerifying2FA(true);
      try {
          const token = await tempUser.getIdToken();
          
          const verifyRes = await fetch(`${BACKEND_URL}/verify2FA`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json', 
                  'Authorization': `Bearer ${token}` 
              },
              body: JSON.stringify({ token: code, isLogin: true })
          });

          const verifyData = await verifyRes.json();
          
          if (!verifyData.success) {
              playSound('error');
              toast.error("❌ Invalid Code");
              setVerifying2FA(false);
              return; 
          }

          // ✅ Success!
          toast.success("Identity Verified!");
          setShow2FAModal(false);
          
          // Fetch role again to redirect
          const userDoc = await getDoc(doc(db, "users", tempUser.uid));
          proceedToDashboard(userDoc.data());

      } catch (error) {
          console.error(error);
          toast.error("Verification Error");
          setVerifying2FA(false);
      }
  };

  // --- HELPER: Redirect based on Role ---
  const proceedToDashboard = (userData) => {
      playSound('success');
      if (userData.role === 'student') navigate('/student-dashboard');
      else if (userData.role === 'teacher') navigate('/teacher-dashboard');
      else if (userData.role === 'institute-admin') navigate('/admin-dashboard'); 
      else if (userData.role === 'super-admin') navigate('/super-admin');
      else navigate('/dashboard');
  };

  const handleLoginError = (error) => {
      playSound('error');
      let errorMessage = "❌ Login Failed.";
      if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
         errorMessage = "❌ Invalid credentials.";
      } 
      setError(errorMessage);
  };

  // Handle Google Login
  const handleGoogleSignIn = async () => {
    playSound('tap');
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      
      localStorage.setItem('last_userId', res.user.uid); // Save for bio

      const userDoc = await getDoc(doc(db, "users", res.user.uid));
      if (userDoc.exists()) proceedToDashboard(userDoc.data());
      else navigate("/dashboard"); 
      
    } catch (error) {
      playSound('error');
      setError(`❌ Google Sign-In Error: ${error.message}`);
    }
  };

  if (checkingAuth) return null;

  return (
    <IOSPage>
      {/* ✅ RENDER 2FA MODAL */}
      <TwoFactorVerifyModal 
          isOpen={show2FAModal} 
          isLoading={verifying2FA}
          onClose={() => { setShow2FAModal(false); auth.signOut(); }} // Logout if they cancel
          onVerify={onVerify2FA}
      />

      <div className="login-wrapper">
        <div className="login-container">
          <div className="login-header">
            <img className="login-logo" src={logo} alt="App Logo" />
            <h1>Sign in to <span className="highlight">AcadeX</span></h1>
          </div>

          {/* 👆 BIOMETRIC LOGIN BUTTON (Only shows if enabled) */}
          {showBioLogin && (
              <motion.button 
                  className="btn-primary"
                  style={{ 
                    background: 'linear-gradient(135deg, #10b981, #059669)', 
                    marginBottom: '20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                  }}
                  onClick={triggerBiometricLogin}
                  disabled={bioLoading}
                  variants={buttonTap}
                  whileTap="tap"
                  type="button"
              >
                  {bioLoading ? (
                      <span>Scanning...</span>
                  ) : (
                      <>
                          <i className="fas fa-fingerprint" style={{fontSize: '18px'}}></i> 
                          Login with TouchID
                      </>
                  )}
              </motion.button>
          )}

          {showBioLogin && (
             <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#94a3b8' }}>
                <div style={{ flex: 1, borderBottom: '1px solid #e2e8f0' }}></div>
                <span style={{ padding: '0 10px', fontSize: '12px', fontWeight: '500' }}>OR USE PASSWORD</span>
                <div style={{ flex: 1, borderBottom: '1px solid #e2e8f0' }}></div>
             </div>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            
            {/* 1. Email Input */}
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

            {/* 2. Password Input (This is what you asked for!) */}
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

            {/* 3. Forgot Password Link (Added below password) */}
            <div style={{ textAlign: 'right', marginTop: '-10px', marginBottom: '15px' }}>
              <span 
                onClick={handleForgotPassword}
                style={{ 
                  color: '#6366f1', 
                  fontSize: '13px', 
                  cursor: 'pointer', 
                  fontWeight: '600' 
                }}
              >
                Forgot Password?
              </span>
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