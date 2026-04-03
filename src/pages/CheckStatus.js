import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from "../assets/logo.png";
import './Login.css'; // Re-using the premium layout

// ✅ Animation Imports
import IOSPage from "../components/IOSPage";
import useIOSSound from "../hooks/useIOSSound";
import { motion, AnimatePresence } from "framer-motion";
import { buttonTap } from "../animations/interactionVariants";

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com"; 

export default function CheckStatus() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null); 
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const playSound = useIOSSound();

  const handleCheckStatus = async (e) => {
    e.preventDefault();
    setResult(null);
    setLoading(true);
    playSound('tap');

    if (!email) {
      setResult({ error: true, message: 'Please enter your email address.' });
      playSound('error');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/checkStatus`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
          throw new Error(data.error || "Failed to check status");
      }

      if (data.found) {
          playSound('success');
          setResult({ 
              success: true, 
              status: data.status, 
              message: data.message 
          });
      } else {
          playSound('error');
          setResult({ 
              success: false, 
              message: "No application found with this email." 
          });
      }

    } catch (error) {
      console.error(error);
      playSound('error');
      setResult({ error: true, message: "Server Error: Could not check status." });
    } finally {
      setLoading(false);
    }
  };

  // Helper for status colors
  const getStatusColor = (status) => {
      if (status === 'approved') return '#dcfce7'; 
      if (status === 'pending') return '#fef9c3'; 
      if (status === 'denied') return '#fee2e2'; 
      return '#f3f4f6'; 
  };

  const getStatusTextColor = (status) => {
      if (status === 'approved') return '#166534';
      if (status === 'pending') return '#854d0e';
      if (status === 'denied') return '#991b1b';
      return '#374151';
  };

  const themeColor = "#6366f1"; // Indigo theme for status check

  return (
    <IOSPage>
      <div className="split-layout-wrapper">
        <div className="split-layout-container">
          
          {/* 🎭 LEFT PANEL */}
          <div className="left-panel" style={{ background: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)" }}>
            <img className="panel-logo" src={logo} alt="trackee Logo" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="graphic-content">
              <div className="hero-icon" style={{ color: themeColor }}>
                <i className="fas fa-clipboard-check"></i>
              </div>
              <h2>Track Your<br/>Application</h2>
              <p>Check the real-time approval status of your institute registration or student account request.</p>
            </motion.div>
          </div>

          {/* 🔐 RIGHT PANEL */}
          <div className="right-panel" style={{ '--theme-color': themeColor }}>
            
            {/* Mobile Header */}
            <div className="login-header-mobile">
              <img className="mobile-logo" src={logo} alt="trackee Logo" />
              <h1>Welcome to <span style={{ color: themeColor }}>trackee</span></h1>
            </div>

            {/* Desktop Brand Header */}
            <div className="desktop-brand-header">
              <img className="desktop-brand-logo" src={logo} alt="trackee Logo" />
              <h1 className="desktop-brand-name" style={{ color: themeColor }}>trackee</h1>
            </div>

            <div className="form-header">
              <h3 className="form-title">Check Status</h3>
              <p className="form-subtitle">Enter your registered email to track your request.</p>
            </div>

            <form className="login-form" onSubmit={handleCheckStatus}>
              <div className="input-group">
                <label>Email Address</label>
                <div className="input-with-icon">
                  <i className="fas fa-envelope input-icon"></i>
                  <input
                    type="email"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              {/* ✅ Result Display */}
              <AnimatePresence>
                  {result && (
                      <motion.div 
                          initial={{ opacity: 0, height: 0, y: -10 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{ 
                              padding: '16px', 
                              borderRadius: '16px', 
                              textAlign: 'center', 
                              fontWeight: '600', 
                              fontSize: '15px',
                              backgroundColor: result.success ? getStatusColor(result.status) : '#fef2f2',
                              color: result.success ? getStatusTextColor(result.status) : '#ef4444',
                              border: `1px solid ${result.success ? 'rgba(0,0,0,0.05)' : '#fca5a5'}`
                          }}
                      >
                          {result.success && result.status === 'approved' && <i className="fas fa-check-circle mr-2"></i>}
                          {result.success && result.status === 'pending' && <i className="fas fa-clock mr-2"></i>}
                          {result.success && result.status === 'denied' && <i className="fas fa-times-circle mr-2"></i>}
                          {!result.success && <i className="fas fa-exclamation-circle mr-2"></i>}
                          {result.message}
                      </motion.div>
                  )}
              </AnimatePresence>

              <motion.button 
                  type="submit" 
                  className="btn-primary main-submit-btn"
                  disabled={loading}
                  variants={buttonTap}
                  whileTap="tap"
                  style={{ marginTop: '10px' }}
              >
                  {loading ? 'Checking...' : 'Check Status'} <i className="fas fa-arrow-right ml-2"></i>
              </motion.button>
              
              <div className="global-footer-links" style={{ marginTop: '24px' }}>
                <p>Back to <span className="text-link" onClick={() => { playSound('tap'); navigate("/"); }}>Sign In</span></p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </IOSPage>
  );
}