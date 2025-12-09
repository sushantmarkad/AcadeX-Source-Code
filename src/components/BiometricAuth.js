import React, { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

// ⚠️ CHANGE THIS to your actual backend URL
const API_BASE = 'https://acadex-backend-n2wh.onrender.com/auth/passkeys'; 

export const useBiometricAuth = () => {
  const [bioLoading, setBioLoading] = useState(false);

  // --- 1. REGISTER (Enable Fingerprint) ---
  const registerPasskey = async (userId) => {
    setBioLoading(true);
    try {
      // A. Get Challenge from Backend
      const resp = await fetch(`${API_BASE}/register-start?userId=${userId}`);
      if (!resp.ok) throw new Error('Failed to start registration');
      const options = await resp.json();

      // B. Trigger Browser/Phone Biometric Prompt
      const attResp = await startRegistration(options);

      // C. Verify with Backend
      const verifyResp = await fetch(`${API_BASE}/register-finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, data: attResp }),
      });

      const result = await verifyResp.json();
      
      if (result.verified) {
        // Save flag locally so Login page knows to show the button
        localStorage.setItem('biometric_enabled', 'true');
        localStorage.setItem('last_userId', userId);
        alert("✅ Fingerprint Setup Complete! You can use it to login next time.");
        return true;
      } else {
        alert("❌ Setup Failed");
        return false;
      }
      
    } catch (error) {
      console.error(error);
      // Don't alert if user just cancelled the popup
      if (error.name !== 'NotAllowedError') {
        alert("Error: " + error.message);
      }
      return false;
    } finally {
      setBioLoading(false);
    }
  };

  // --- 2. LOGIN (Use Fingerprint) ---
  const loginWithPasskey = async (onSuccess) => {
    // We need the User ID to ask the server for *their* specific key challenge.
    const userId = localStorage.getItem('last_userId');
    if (!userId) {
      alert("⚠️ Please login with password once first.");
      return;
    }

    setBioLoading(true);
    try {
      // A. Get Challenge
      const resp = await fetch(`${API_BASE}/login-start?userId=${userId}`);
      
      if (resp.status === 404) {
        throw new Error("User not found. Please login with password.");
      }
      const options = await resp.json();

      // B. Trigger Browser/Phone Biometric Prompt
      const asseResp = await startAuthentication(options);

      // C. Verify
      const verifyResp = await fetch(`${API_BASE}/login-finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, data: asseResp }),
      });

      const result = await verifyResp.json();
      if (result.verified) {
        onSuccess(userId); // Callback to redirect user
      } else {
        alert("❌ Authentication Failed");
      }
    } catch (error) {
      console.error(error);
      alert("Login Failed: " + error.message);
    } finally {
      setBioLoading(false);
    }
  };

  return { registerPasskey, loginWithPasskey, bioLoading };
};