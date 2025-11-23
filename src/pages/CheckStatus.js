import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import './Login.css'; 

// ✅ Animation Imports
import IOSPage from "../components/IOSPage";
import useIOSSound from "../hooks/useIOSSound";
import { motion } from "framer-motion";
import { buttonTap } from "../animations/interactionVariants";

export default function CheckStatus() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(''); // 'approved', 'pending', 'denied', 'error'
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const playSound = useIOSSound();

  const handleCheckStatus = async (e) => {
    e.preventDefault();
    setMessage('');
    setStatus('');
    setLoading(true);
    playSound('tap');

    if (!email) {
      setStatus('error');
      setMessage('Please enter your email address.');
      playSound('error');
      setLoading(false);
      return;
    }

    try {
      // 1️⃣ Check Student Requests (Pending / Denied)
      const qRequest = query(collection(db, "student_requests"), where("email", "==", email));
      const snapRequest = await getDocs(qRequest);

      if (!snapRequest.empty) {
        const data = snapRequest.docs[0].data();
        
        if (data.status === 'pending') {
          setStatus('pending');
          setMessage('⏳ Application Pending. Waiting for HOD Approval.');
          playSound('success'); // Soft success for found
        } else if (data.status === 'denied') {
          setStatus('denied');
          setMessage('❌ Application Denied. Please contact your HOD.');
          playSound('error');
        } else {
            setStatus('error');
            setMessage('Unknown status.');
        }
      } else {
        // 2️⃣ Check Users Collection (Approved & Active)
        // If approved, the request doc is deleted, so we must check the 'users' table.
        const qUser = query(collection(db, "users"), where("email", "==", email));
        const snapUser = await getDocs(qUser);

        if (!snapUser.empty) {
          setStatus('approved');
          setMessage('✅ Account Active! You can Login now.');
          playSound('success');
        } else {
          // 3️⃣ Not found anywhere
          setStatus('error');
          setMessage('No application found with this email.');
          playSound('error');
        }
      }

    } catch (error) {
      setStatus('error');
      setMessage('Error checking status. Try again.');
      console.error("Error:", error);
      playSound('error');
    } finally {
        setLoading(false);
    }
  };

  // Dynamic CSS Class for Message
  const getMessageClass = () => {
    switch (status) {
      case 'approved': return 'success-message';
      case 'pending': return 'info-message'; // Yellow/Blue style
      case 'denied': 
      case 'error': return 'error-message';
      default: return '';
    }
  };

  return (
    <IOSPage>
      <div className="login-wrapper">
        <div className="login-container">
          <div className="login-header">
            <img className="login-logo" src="https://iili.io/KoAVeZg.md.png" alt="AcadeX Logo" />
            <h1>Check Status</h1>
          </div>
          
          <form className="login-form" onSubmit={handleCheckStatus}>
            <div className="input-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            {message && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={getMessageClass()}
                    style={{ padding: '12px', borderRadius: '10px', textAlign: 'center', fontWeight: '500', marginBottom: '15px' }}
                >
                    {message}
                </motion.div>
            )}

            <motion.button 
                type="submit" 
                className="btn-primary"
                disabled={loading}
                variants={buttonTap}
                whileTap="tap"
            >
                {loading ? 'Checking...' : 'Check Status'}
            </motion.button>
            
            <p style={{ marginTop: '15px', textAlign: 'center' }}>
              Back to{" "}
              <span style={{ color: "#075eec", cursor: "pointer", fontWeight:'600' }} onClick={() => { playSound('tap'); navigate("/"); }}>
                Sign In
              </span>
            </p>
          </form>
        </div>
      </div>
    </IOSPage>
  );
}