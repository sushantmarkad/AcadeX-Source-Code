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
import { motion } from "framer-motion";
import { buttonTap } from "../animations/interactionVariants";

// ✅ Import the New Modal
import TwoFactorVerifyModal from "../components/TwoFactorVerifyModal";

// ✅ Import Biometric Hook
import { useBiometricAuth } from '../components/BiometricAuth';

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
  const [showPassword, setShowPassword] = useState(false);

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

  // ✅ HELPER: Centralized Auth Handler
  const handleUserAuth = async (user) => {
      try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (!userDoc.exists()) throw new Error("User profile not found.");
          
          const userData = userDoc.data();
          
          console.log("Checking 2FA for:", userData.firstName, "Enabled:", userData.is2FAEnabled);

          // 🔐 CHECK IF 2FA IS ENABLED
          if (userData.is2FAEnabled) {
              // 🛑 STOP! Show Custom 2FA Modal
              setTempUser(user); 
              setShow2FAModal(true); 
              return;
          }

          // No 2FA? Proceed to Dashboard
          proceedToDashboard(userData);
      } catch (err) {
          setError("❌ Login Error: " + err.message);
      }
  };

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

      // Save ID for next time
      localStorage.setItem('last_userId', user.uid);

      // ✅ 2FA CHECK (Bypass Removed)
      // This will now properly check database for ALL users, including Super Admin
      await handleUserAuth(user);

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
        
        // Mock a user object since bio doesn't return full firebase user immediately
        const mockUser = { uid: userId, getIdToken: async () => "BIO_TOKEN" };
        
        // ✅ Check 2FA (or if already in 2FA modal, this acts as the verification)
        if (show2FAModal) {
            // If we are INSIDE the modal, biometric success = 2FA success
            setShow2FAModal(false);
            const userDoc = await getDoc(doc(db, "users", userId));
            proceedToDashboard(userDoc.data());
        } else {
            // If primary login, proceed to check checks
            await handleUserAuth(mockUser);
        }
    });
  };

  // --- 🔑 HANDLE FORGOT PASSWORD ---
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
      setError(""); 
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

  // --- 2. HANDLE 2FA VERIFICATION (Code) ---
  const onVerify2FA = async (code) => {
      setVerifying2FA(true);
      try {
          const token = tempUser.getIdToken ? await tempUser.getIdToken() : "BIO_TOKEN";
          
          const verifyRes = await fetch('https://acadex-backend-n2wh.onrender.com/verify2FA', {
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
      
      localStorage.setItem('last_userId', res.user.uid); 

      // ✅ FIX: Use Helper to Check 2FA for Google Users too
      await handleUserAuth(res.user);
      
    } catch (error) {
      playSound('error');
      setError(`❌ Google Sign-In Error: ${error.message}`);
    }
  };

  if (checkingAuth) return null;

  return (
    <IOSPage>
      {/* ✅ RENDER 2FA MODAL WITH BIOMETRIC OPTION */}
      <TwoFactorVerifyModal 
          isOpen={show2FAModal} 
          isLoading={verifying2FA}
          onClose={() => { setShow2FAModal(false); auth.signOut(); }} 
          onVerify={onVerify2FA}
          onBiometricAuth={showBioLogin ? triggerBiometricLogin : null}
      />

      <div className="login-wrapper">
        <div className="login-container">
          <div className="login-header">
            <img className="login-logo" src={logo} alt="App Logo" />
            <h1>Sign in to <span className="highlight">trackee</span></h1>
          </div>

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

            {/* Password Field with Toggle Eye Icon */}
            <div className="input-group" style={{ position: "relative" }}>
              <label>Password</label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  style={{ paddingRight: "40px" }} // Make room for the icon
                />
                <button
                  type="button" // Prevents form submission
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748b",
                    fontSize: "16px",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    zIndex: 10
                  }}
                >
                  <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                </button>
              </div>
            </div>

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
              Want to use trackee for your institute?{" "}
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