import React, { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import toast from 'react-hot-toast';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

// ✅ Point this to your Render backend URL
const API_BASE = 'https://acadex-backend-n2wh.onrender.com/auth/passkeys'; 

export const useBiometricAuth = () => {
  const [bioLoading, setBioLoading] = useState(false);

  /**
   * 1. REGISTER PASSKEY (The "Setup" phase)
   * This links the student's fingerprint AND their specific device to their account.
   */
  const registerPasskey = async (userId) => {
    setBioLoading(true);
    try {
      // Step A: Request registration options from the server
      const resp = await fetch(`${API_BASE}/register-start?userId=${userId}`);
      
      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.error || 'Failed to start registration');
      }
      
      const options = await resp.json();

      // Step B: Trigger the browser's native biometric prompt (TouchID/FaceID)
      // ✅ We wrap 'options' in 'optionsJSON' to comply with the latest library version
      const attResp = await startRegistration({ optionsJSON: options });

      // Step C: Generate a unique Hardware Fingerprint for Device Binding
      const fp = await FingerprintJS.load();
      const fpResult = await fp.get();
      const deviceId = fpResult.visitorId;

      // Step D: Send biometric data + hardware ID to backend to finalize the lock
      const verifyResp = await fetch(`${API_BASE}/register-finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            userId, 
            data: attResp, 
            deviceId: deviceId // ✅ This prevents others from using this account on their phone
        }),
      });

      const result = await verifyResp.json();
      
      if (result.verified) {
        toast.success("✅ Device & Biometric identity linked!");
        return true;
      } else {
        toast.error("❌ Verification failed: " + (result.error || "Unknown error"));
        return false;
      }
      
    } catch (error) {
      console.error("Registration Error:", error);
      // Don't show error toast if the user simply cancelled the fingerprint prompt
      if (error.name !== 'NotAllowedError') {
        toast.error(error.message);
      }
      return false;
    } finally {
      setBioLoading(false);
    }
  };

  /**
   * 2. AUTHENTICATE (The "Attendance" phase)
   * Verifies the student is who they say they are before marking them present.
   */
  const authenticate = async (userId) => {
    setBioLoading(true);
    try {
      // Step A: Get login challenge from server
      const resp = await fetch(`${API_BASE}/login-start?userId=${userId}`);
      
      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.error || "Authentication start failed");
      }
      
      const options = await resp.json();

      // Step B: Trigger biometric scan
      // ✅ Using 'optionsJSON' wrapper
      const asseResp = await startAuthentication({ optionsJSON: options });

      // Step C: Verify scan with backend
      const verifyResp = await fetch(`${API_BASE}/login-finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, data: asseResp }),
      });

      const result = await verifyResp.json();
      return result.verified;

    } catch (error) {
      console.error("Biometric Auth Error:", error);
      if (error.name !== 'NotAllowedError') {
        toast.error(error.message);
      }
      return false;
    } finally {
      setBioLoading(false);
    }
  };

  /**
   * 3. LOGIN WRAPPER (Optional)
   * Allows logging into the app using biometrics if the user has logged in once before.
   */
  const loginWithPasskey = async (onSuccess) => {
    const userId = localStorage.getItem('last_userId');
    if (!userId) {
      toast.error("Please login with your password once on this device first.");
      return;
    }

    const isVerified = await authenticate(userId);
    if (isVerified) {
        onSuccess(userId);
    }
  };

  return { registerPasskey, loginWithPasskey, authenticate, bioLoading };
};