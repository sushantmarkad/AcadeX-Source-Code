import React, { useRef, useState } from "react";
import * as faceapi from 'face-api.js';
import { auth } from '../firebase';
import toast, { Toaster } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Geolocation } from '@capacitor/geolocation';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// ==========================================
// 🧮 LIVENESS MATH HELPERS
// ==========================================
const getDistance = (point1, point2) => {
  return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2));
};

const getEyeAspectRatio = (eyePoints) => {
  const v1 = getDistance(eyePoints[1], eyePoints[5]);
  const v2 = getDistance(eyePoints[2], eyePoints[4]);
  const h = getDistance(eyePoints[0], eyePoints[3]);
  return (v1 + v2) / (2.0 * h);
};
// ==========================================

function Attendance() {
  const videoRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [sessionId, setSessionId] = useState(""); 

  const handleMarkAttendance = async () => {
    if (!sessionId) return toast.error("Please enter a Session ID first");
    
    setIsScanning(true);
    const toastId = toast.loading("Checking GPS Location...");
    
    try {
      // 1. Fetch GPS
      let userLocation;
      try {
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        userLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      } catch (geoError) {
        toast.error("GPS Error: Please enable location services.", { id: toastId });
        setIsScanning(false);
        return; 
      }

      toast.loading("Starting High-Security Scanner...", { id: toastId });

      // 2. Load Models (USING SSD MOBILENET FOR HIGH ACCURACY)
      await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');

      // 3. Start Camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;

      videoRef.current.onloadedmetadata = async () => {
        await videoRef.current.play();
        videoRef.current.width = videoRef.current.videoWidth;
        videoRef.current.height = videoRef.current.videoHeight;

        toast.loading("Please BLINK to verify you are human...", { id: toastId });

        let blinkDetected = false;
        
        // 4. Start Liveness Loop
        const scanInterval = setInterval(async () => {
          try {
            // Use SSD Mobilenet with High Confidence threshold (0.85)
            const detection = await faceapi.detectSingleFace(
              videoRef.current, 
              new faceapi.SsdMobilenetv1Options({ minConfidence: 0.85 }) 
            ).withFaceLandmarks().withFaceDescriptor();

            if (detection) {
              const landmarks = detection.landmarks;
              const leftEye = landmarks.getLeftEye();
              const rightEye = landmarks.getRightEye();

              const leftEAR = getEyeAspectRatio(leftEye);
              const rightEAR = getEyeAspectRatio(rightEye);
              const avgEAR = (leftEAR + rightEAR) / 2.0;

              // Detect Blink
              if (avgEAR < 0.25) {
                  blinkDetected = true;
              }

              // Capture when eyes reopen
              if (blinkDetected && avgEAR > 0.28) {
                  clearInterval(scanInterval);
                  clearTimeout(timeoutFailsafe);
                  stream.getTracks().forEach(track => track.stop());
                  setIsScanning(false);

                  toast.loading("Human Verified! Sending to Server...", { id: toastId });
                  const descriptorArray = Array.from(detection.descriptor);
                  
                  const token = await auth.currentUser.getIdToken();
                  const response = await fetch(`${BACKEND_URL}/markAttendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                      sessionId: sessionId,
                      studentLocation: userLocation,
                      faceDescriptor: descriptorArray
                    })
                  });

                  const data = await response.json();
                  if (response.ok) {
                    toast.success(data.message, { id: toastId, duration: 4000 });
                  } else {
                    toast.error(data.error, { id: toastId, duration: 5000 });
                  }
              }
            }
          } catch (error) {
             console.error("Detection error:", error);
          }
        }, 200); 

        // 5. Failsafe Timeout
        const timeoutFailsafe = setTimeout(() => {
            clearInterval(scanInterval);
            stream.getTracks().forEach(track => track.stop());
            setIsScanning(false);
            toast.error("Verification timeout. Make sure you blink clearly into the camera.", { id: toastId, duration: 4000 });
        }, 15000);
      };

    } catch (err) {
      toast.error("Camera or Location access denied.", { id: toastId });
      setIsScanning(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page" style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
      <Toaster position="top-center" />
      <h1 style={{ color: '#1e293b', marginBottom: '10px' }}>📅 Face Attendance</h1>
      <p style={{ color: '#64748b', marginBottom: '30px' }}>Enter the session code and verify your identity.</p>
      
      <div style={{ margin: '20px 0' }}>
        <input 
          type="text" 
          placeholder="Enter Session ID..." 
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          style={{ padding: '16px', width: '100%', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '16px', outline: 'none', transition: 'border-color 0.2s' }}
          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
          onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
        />
      </div>

      <div style={{ position: 'relative', width: '100%', height: '350px', background: '#0f172a', borderRadius: '24px', overflow: 'hidden', margin: '30px 0', border: '4px solid #f8fafc', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
        <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        {!isScanning && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', background: '#1e293b' }}>
                <i className="fas fa-camera" style={{ fontSize: '48px', marginBottom: '10px', color: '#475569' }}></i>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Camera Ready</span>
            </div>
        )}
      </div>

      <motion.button 
        whileTap={{ scale: 0.95 }}
        onClick={handleMarkAttendance} 
        disabled={isScanning}
        style={{ padding: '18px 30px', background: isScanning ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', borderRadius: '14px', fontSize: '18px', fontWeight: 'bold', cursor: isScanning ? 'not-allowed' : 'pointer', width: '100%', boxShadow: isScanning ? 'none' : '0 4px 15px rgba(59, 130, 246, 0.4)', transition: 'background 0.3s' }}
      >
        {isScanning ? "Scanning Face..." : "Mark Attendance"}
      </motion.button>
    </motion.div>
  );
}

export default Attendance;