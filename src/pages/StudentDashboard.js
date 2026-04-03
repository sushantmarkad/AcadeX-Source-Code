import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, orderBy, limit, updateDoc, getCountFromServer } from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import logo from "../assets/logo.png";
import './Dashboard.css';
import './FeedbackView.css';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'; // ✅ NATIVE CAMERA
import NativeFriendlyDateInput from '../components/NativeFriendlyDateInput';
import { useFileDownloader } from '../hooks/useFileDownloader';
import { Geolocation } from '@capacitor/geolocation';
import * as faceapi from 'face-api.js';

// ✅ NEW IMPORTS FOR SECURITY
import { Device } from '@capacitor/device';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { useBiometricAuth } from '../components/BiometricAuth';
// ✅ Add these imports at the top

// Component Imports
import FreePeriodTasks from './FreePeriodTasks';
import Profile from './Profile';
import AiChatbot from './AiChatbot';
import CareerRoadmap from './CareerRoadmap';
import Leaderboard from './Leaderboard';
import FreePeriodQuiz from '../components/FreePeriodQuiz';



const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// --- MATH HELPER FOR BLINK DETECTION ---
const calculateEAR = (eye) => {
    const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (v1 + v2) / (2.0 * h);
};

let cachedFeedbackForms = null;
let cachedDeptTeachers = null;
let modelsLoaded = false;

// --- 📱 BEAUTIFUL CUSTOM MOBILE DROPDOWN ---
const CustomMobileSelect = ({ label, value, onChange, options, icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedLabel = options.find(o => String(o.value) === String(value))?.label || "Select...";

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <label style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {icon && <i className={`fas ${icon}`} style={{ color: '#8b5cf6' }}></i>}
                {label}
            </label>

            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '16px 20px', borderRadius: '16px', background: isOpen ? '#ffffff' : '#f8fafc',
                    border: isOpen ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                    color: '#1e293b', fontWeight: '600', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'all 0.2s ease', width: '100%', boxSizing: 'border-box'
                }}
            >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '15px' }}>
                    {selectedLabel}
                </span>
                <i className={`fas fa-chevron-down ${isOpen ? 'fa-rotate-180' : ''}`} style={{ transition: '0.3s', color: isOpen ? '#3b82f6' : '#94a3b8' }}></i>
            </div>

            {isOpen && (
                <>
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px',
                        background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
                        zIndex: 100, maxHeight: '250px', overflowY: 'auto'
                    }}>
                        {options.map((opt, idx) => (
                            <div
                                key={idx}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                style={{
                                    padding: '14px 20px', borderBottom: idx === options.length - 1 ? 'none' : '1px solid #f8fafc',
                                    color: String(value) === String(opt.value) ? '#2563eb' : '#475569',
                                    fontWeight: String(value) === String(opt.value) ? '700' : '500',
                                    background: String(value) === String(opt.value) ? '#eff6ff' : 'transparent',
                                    cursor: 'pointer', fontSize: '14px', transition: 'background 0.2s'
                                }}
                            >
                                {opt.label}
                            </div>
                        ))}
                    </div>
                    {/* Overlay to close when clicking outside */}
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setIsOpen(false)}></div>
                </>
            )}
        </div>
    );
};

// --- HELPER: Time Logic ---
const getCurrentTimeMinutes = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
};

const getMinutesFromTime = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

// --- HELPER: Relative Time ---
const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
};

// --- ✅ HELPER: BULLETPROOF DEVICE ID (Anti-Proxy Fix) ---
const getUniqueDeviceId = async () => {
    // 1. Check if we already created a permanent ID for this exact device installation
    const storedId = localStorage.getItem('trackee_secure_device_id');
    if (storedId) return storedId;

    let baseId = '';

    try {
        // A. Try getting the NATIVE DEVICE UUID (For Mobile App)
        const info = await Device.getId();
        if (info && info.uuid) {
            baseId = `app-${info.uuid}`;
        }
    } catch (err) {
        console.warn("Native ID failed, falling back to Web");
    }

    // B. Browser Fingerprinting Fallback
    if (!baseId) {
        try {
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            baseId = `web-${result.visitorId}`;
        } catch (err) {
            baseId = 'unknown';
        }
    }

    // 2. Add a random salt to guarantee uniqueness even if two phones are identical models!
    const finalDeviceId = `${baseId}-${Math.random().toString(36).substring(2, 10)}`;

    // 3. Save it permanently to the device's local storage
    localStorage.setItem('trackee_secure_device_id', finalDeviceId);

    return finalDeviceId;
};

const enableAndroidLocation = async () => {
    return new Promise((resolve, reject) => {
        if (Capacitor.getPlatform() !== 'android') {
            resolve(true);
            return;
        }

        // Check if the Cordova plugin is actually available
        const locationAccuracy = window.cordova?.plugins?.locationAccuracy;

        if (!locationAccuracy) {
            console.warn("⚠️ Cordova Location Accuracy plugin not found. Skipping auto-enable.");
            // We resolve true here to let the app try fetching location anyway, 
            // but we will catch the error in the main function if it fails.
            resolve(true);
            return;
        }

        const mode = locationAccuracy.REQUEST_PRIORITY_HIGH_ACCURACY;

        locationAccuracy.request(
            () => {
                console.log("✅ GPS Enabled by User");
                resolve(true);
            },
            (error) => {
                console.error("❌ User rejected GPS request", error);
                // Rejecting here allows us to show an immediate error
                reject(new Error("GPS must be enabled to mark attendance."));
            },
            mode
        );
    });
};

// ✅ UPDATED: Robust Location Strategy (High Accuracy -> Fallback to Low Accuracy)
const getLocation = async () => {
    try {
        // STEP 1: Force GPS On (Android Only)
        if (Capacitor.getPlatform() === 'android') {
            await enableAndroidLocation();
        }

        // STEP 2: Check Permissions (✅ FIX: Run on Native Devices Only)
        if (Capacitor.isNativePlatform()) {
            let permissionStatus = await Geolocation.checkPermissions();

            if (permissionStatus.location === 'denied') {
                throw new Error("Location permission denied. Please allow it in settings.");
            }

            if (permissionStatus.location !== 'granted') {
                const request = await Geolocation.requestPermissions();
                if (request.location !== 'granted') {
                    throw new Error("Location permission is required to mark attendance.");
                }
            }
        }

        // STEP 3: Try High Accuracy (GPS) - Increased Timeout to 10s
        try {
            const position = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 10000, // ⚡ Increased to 10 seconds
                maximumAge: 0
            });
            return position;
        } catch (highAccuracyError) {
            console.warn("⚠️ High Accuracy GPS failed, switching to Low Accuracy...", highAccuracyError);

            // STEP 4: Fallback to Low Accuracy (Network/WiFi Location)
            // This is much faster and works indoors
            const lowAccuracyPosition = await Geolocation.getCurrentPosition({
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 30000 // Accept locations up to 30s old
            });

            return lowAccuracyPosition;
        }

    } catch (error) {
        console.error("Location Logic Error:", error);

        // 🚨 Handle specific error codes
        if (error.code === 2 || error.message.includes("disabled") || error.message.includes("location")) {
            throw new Error("⚠️ GPS is OFF or Signal is Weak. Turn on Location.");
        }
        if (error.code === 3 || error.message.includes("time")) {
            throw new Error("⏳ Location Timeout. Move outdoors or try again.");
        }

        // Custom error for web without HTTPS
        if (!Capacitor.isNativePlatform() && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            throw new Error("Location requires HTTPS or Localhost.");
        }

        throw error;
    }
};

// --- COMPONENT: Leave Request Form ---
const LeaveRequestForm = ({ user }) => {
    const [form, setForm] = useState({ reason: '', fromDate: '', toDate: '' });
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [myLeaves, setMyLeaves] = useState([]);
    const { downloadFile } = useFileDownloader();

    useEffect(() => {
        if (!user.uid) return;
        // 🛑 OPTIMIZED: Fetch once instead of listening forever
        const fetchLeaves = async () => {
            const q = query(collection(db, 'leave_requests'), where('studentId', '==', user.uid));
            const snapshot = await getDocs(q);
            const leavesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            leavesData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setMyLeaves(leavesData);
        };
        fetchLeaves();
    }, [user.uid]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const toastId = toast.loading("Uploading & Sending...");

        try {
            const formData = new FormData();
            formData.append('uid', user.uid);
            formData.append('name', `${user.firstName} ${user.lastName}`);
            formData.append('rollNo', user.rollNo);
            formData.append('department', user.department);
            formData.append('instituteId', user.instituteId);
            formData.append('reason', form.reason);
            formData.append('fromDate', form.fromDate);
            formData.append('toDate', form.toDate);

            if (file) formData.append('document', file);

            const res = await fetch(`${BACKEND_URL}/requestLeave`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toast.success("Request sent to HOD!", { id: toastId });
            setForm({ reason: '', fromDate: '', toDate: '' });
            setFile(null);
        } catch (err) {
            toast.error(err.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Request Leave</h2>

            <div className="card" style={{ marginBottom: '30px' }}>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Reason</label>
                        <input type="text" required value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Medical Leave" />
                    </div>

                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label>From</label>
                            {/* ✅ UPDATED: Native Friendly Input */}
                            <NativeFriendlyDateInput
                                required
                                value={form.fromDate}
                                onChange={(nextDate) => setForm({ ...form, fromDate: nextDate })}
                            />
                        </div>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label>To</label>
                            {/* ✅ UPDATED: Native Friendly Input with Min Date Logic */}
                            <NativeFriendlyDateInput
                                required
                                value={form.toDate}
                                onChange={(nextDate) => setForm({ ...form, toDate: nextDate })}
                                min={form.fromDate || undefined}
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Attach Proof <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="file"
                            accept="image/*,.pdf"
                            required
                            onChange={(e) => setFile(e.target.files[0])}
                            style={{ padding: '10px', background: '#f8fafc' }}
                        />
                        <small style={{ color: '#64748b' }}>Upload medical certificate or letter (Max 5MB)</small>
                    </div>
                    <button className="btn-primary" disabled={loading}>
                        {loading ? 'Sending...' : 'Submit Request'}
                    </button>
                </form>
            </div>

            <h3 style={{ color: '#1e293b', margin: '0 0 15px 0', fontSize: '18px' }}>My Leave History</h3>
            <div className="cards-grid">
                {myLeaves.length > 0 ? (
                    myLeaves.map(leave => (
                        <div key={leave.id} className="card" style={{ borderLeft: `5px solid ${leave.status === 'approved' ? '#10b981' : leave.status === 'rejected' ? '#ef4444' : '#f59e0b'}`, padding: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{leave.reason}</h4>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                                        {new Date(leave.fromDate).toLocaleDateString()} ➔ {new Date(leave.toDate).toLocaleDateString()}
                                    </p>
                                    {leave.documentUrl && (
                                        <button
                                            onClick={() => downloadFile(leave.documentUrl, `LeaveProof_${leave.id}.pdf`)}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px',
                                                color: '#2563eb', marginTop: '8px', background: '#eff6ff',
                                                padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer'
                                            }}
                                        >
                                            <i className="fas fa-file-download"></i> Download Proof
                                        </button>
                                    )}
                                </div>
                                <span className={`status-badge status-${leave.status}`} style={{ textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>{leave.status}</span>
                            </div>
                        </div>
                    ))
                ) : <div className="card" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontStyle: 'italic' }}>No leave history found.</div>}
            </div>
        </div>
    );
};

// --- COMPONENT: Notices View (Updated with Division Badge) ---
const NoticesView = ({ notices }) => {
    const { downloadFile } = useFileDownloader();
    return (
        <div className="content-section">
            <h2 className="content-title">Notice Board</h2>
            <p className="content-subtitle">Stay updated with the latest announcements.</p>
            <div className="notice-list">
                {notices.length > 0 ? notices.map((n, index) => {
                    const isNew = (new Date() - (n.createdAt?.toDate ? n.createdAt.toDate() : new Date())) / (1000 * 60 * 60) < 24;
                    return (
                        <div key={n.id} className="notice-card" style={{ animationDelay: `${index * 0.1}s` }}>
                            <div className="notice-icon-box"><i className="fas fa-bullhorn"></i></div>
                            <div className="notice-content">
                                <div className="notice-header">
                                    <h3 className="notice-title">{n.title}{isNew && <span className="badge-new">NEW</span>}</h3>
                                    <span className="notice-time">{getRelativeTime(n.createdAt)}</span>
                                </div>
                                <p className="notice-body">{n.message}</p>

                                {n.attachmentUrl && (
                                    <div style={{ marginBottom: '12px', marginTop: '10px' }}>
                                        <button
                                            onClick={() => downloadFile(n.attachmentUrl, `Notice_${n.id}.pdf`)}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                                padding: '8px 12px', background: '#eff6ff',
                                                color: '#2563eb', borderRadius: '8px',
                                                fontSize: '13px', fontWeight: '600',
                                                border: '1px solid #bfdbfe', cursor: 'pointer'
                                            }}>
                                            <i className="fas fa-file-download"></i> Download Attachment
                                        </button>
                                    </div>
                                )}

                                {/* Teacher Info */}
                                {n.teacherName && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                                        <i className="fas fa-user-circle" style={{ color: '#94a3b8' }}></i>
                                        <span>Posted by <strong>{n.teacherName}</strong></span>
                                    </div>
                                )}

                                <div className="notice-footer">
                                    {/* 1. Department Badge */}
                                    <span className="notice-dept-badge">{n.department || 'General'}</span>

                                    {/* 2. Year Badge (Hide if it duplicates the Department) */}
                                    {n.targetYear !== 'All' && n.targetYear !== n.department && (
                                        <span className="notice-year-badge">{n.targetYear}</span>
                                    )}

                                    {/* 3. Division Badge */}
                                    {n.division && n.division !== 'All' && (
                                        <span className="notice-year-badge" style={{ background: '#dbeafe', color: '#1e40af', marginLeft: '6px' }}>
                                            Div {n.division}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }) : <div className="empty-state-card"><div className="empty-icon"><i className="fas fa-inbox"></i></div><h3>No Announcements</h3><p>You're all caught up!</p></div>}
            </div>
        </div>
    );
};

const handleAttendance = async (sessionIdFromQR) => {
    const toastId = toast.loading("Verifying security...");

    try {
        // ✅ FIX: Use the bulletproof helper function we just created!
        const hardwareId = await getUniqueDeviceId();

        // 2. ✅ UPDATED: Get Location using the new Native Plugin
        const position = await getLocation();

        const token = await auth.currentUser.getIdToken();

        // 3. Send Attendance to Backend
        const response = await fetch(`${BACKEND_URL}/markAttendance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                sessionId: sessionIdFromQR,
                deviceId: hardwareId,
                studentLocation: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                },
                verificationMethod: 'qr'
            })
        });

        const data = await response.json();

        if (response.ok) {
            toast.success(data.message, { id: toastId });
        } else {
            toast.error(data.error, { id: toastId });
        }

    } catch (error) {
        console.error(error);
        // Handle specific errors for better UX
        if (error.message.includes("denied")) {
            toast.error("Permission Denied: Enable Location in Settings", { id: toastId });
        } else {
            toast.error("Location failed. Ensure GPS is ON.", { id: toastId });
        }
    }
};

// --- COMPONENT: Smart Schedule Card (Presentational) ---
const SmartScheduleCard = ({ user, currentSlot, loading }) => {
    const isFree = currentSlot?.type === 'Free' || currentSlot?.type === 'Break' || currentSlot?.type === 'Holiday';

    if (loading) return <div className="card" style={{ padding: '20px', textAlign: 'center' }}>Loading Schedule...</div>;

    return (
        <>
            <div className="card" style={{ borderLeft: isFree ? '5px solid #10b981' : '5px solid #3b82f6', background: isFree ? 'linear-gradient(to right, #ecfdf5, white)' : 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h4 style={{ margin: 0, color: isFree ? '#059669' : '#2563eb', fontSize: '12px', fontWeight: 'bold' }}>{isFree ? "🟢 RIGHT NOW" : "🔴 LIVE CLASS"}</h4>
                        <h2 style={{ margin: '5px 0 0 0', fontSize: '20px', color: '#1e293b', fontWeight: '700' }}>{currentSlot?.subject || "Free Period"}</h2>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>{currentSlot?.startTime ? `${currentSlot.startTime} - ${currentSlot.endTime}` : "Enjoy your free time!"}</p>
                    </div>
                </div>
                {isFree && <div style={{ marginTop: '15px', padding: '10px', background: '#dcfce7', color: '#166534', borderRadius: '8px', fontSize: '13px' }}>✨ Free Period Detected! Check "Free Tasks" tab for AI activities.</div>}
            </div>
            {isFree && <FreePeriodQuiz user={user} isFree={isFree} />}
        </>
    );
};
// --- COMPONENT: Attendance Overview (Split Theory & Practical) ---
const AttendanceOverview = ({ user }) => {
    const [stats, setStats] = useState({
        overall: 0,
        theory: 0,
        practical: 0,
        totalTheory: 0,
        attendedTheory: 0,
        totalPractical: 0,
        attendedPractical: 0
    });

    useEffect(() => {
        const fetchAccurateStats = async () => {
            if (!user?.instituteId || !user?.department || !user?.year) return;

            try {
                const myAttendanceQ = query(
                    collection(db, 'attendance'),
                    where('studentId', '==', user.uid),
                    where('status', '==', 'Present'),
                    where('academicYear', '==', user.academicYear || '2025-2026')
                );
                const myAttendanceSnap = await getDocs(myAttendanceQ);
                const myPresentSessionIds = new Set(myAttendanceSnap.docs.map(doc => doc.data().sessionId));

                const sessionsQ = query(
                    collection(db, 'live_sessions'),
                    where('instituteId', '==', user.instituteId),
                    where('department', '==', user.department),
                    where('academicYear', '==', user.academicYear || '2025-2026')
                );

                const sessionsSnap = await getDocs(sessionsQ);

                let tTotal = 0, tPresent = 0;
                let pTotal = 0, pPresent = 0;

                sessionsSnap.forEach(doc => {
                    const data = doc.data();
                    const sessionId = doc.id;

                    // 🚨 THE FIX: Ignore Deleted and Cancelled sessions!
                    if (data.isDeleted === true || data.status === 'deleted' || data.status === 'cancelled') return;
                    if (data.type !== 'theory' && data.type !== 'practical') return;

                    const sYear = data.year || data.targetYear;
                    if (sYear !== 'All' && sYear !== user.year) return;

                    if (data.division && data.division !== 'All') {
                        const myDiv = user.division || user.div;
                        if (data.division !== myDiv) return;
                    }

                    if (data.type === 'practical' && data.rollRange) {
                        const myRoll = parseInt(user.rollNo);
                        const min = parseInt(data.rollRange.start);
                        const max = parseInt(data.rollRange.end);
                        if (isNaN(myRoll) || myRoll < min || myRoll > max) return;
                    }

                    if (data.type === 'theory') {
                        tTotal++;
                        if (myPresentSessionIds.has(sessionId)) tPresent++;
                    }

                    if (data.type === 'practical') {
                        pTotal++;
                        if (myPresentSessionIds.has(sessionId)) pPresent++;
                    }
                });

                setStats({
                    theory: tTotal > 0 ? Math.round((tPresent / tTotal) * 100) : 0,
                    practical: pTotal > 0 ? Math.round((pPresent / pTotal) * 100) : 0,
                    overall: (tTotal + pTotal) > 0 ? Math.round(((tPresent + pPresent) / (tTotal + pTotal)) * 100) : 0,
                    totalTheory: tTotal, attendedTheory: tPresent,
                    totalPractical: pTotal, attendedPractical: pPresent
                });

            } catch (err) { console.error("Stats Error:", err); }
        };
        fetchAccurateStats();
    }, [user]);

    const getColor = (pct) => pct >= 75 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';

    return (
        <div className="card">
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#1e293b' }}>Attendance Overview</h3>

            <div style={{ display: 'flex', gap: '20px', justifyContent: 'space-around' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: '70px', height: '70px', margin: '0 auto' }}>
                        <svg width="70" height="70" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                            <circle cx="50" cy="50" r="45" fill="none" stroke={getColor(stats.theory)} strokeWidth="8"
                                strokeDasharray="283" strokeDashoffset={283 - (283 * stats.theory) / 100}
                                transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s' }} />
                        </svg>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                            {stats.theory}%
                        </div>
                    </div>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginTop: '5px' }}>Theory</p>
                    <p style={{ fontSize: '10px', color: '#94a3b8' }}>{stats.attendedTheory}/{stats.totalTheory}</p>
                </div>

                <div style={{ textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: '70px', height: '70px', margin: '0 auto' }}>
                        <svg width="70" height="70" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                            <circle cx="50" cy="50" r="45" fill="none" stroke={getColor(stats.practical)} strokeWidth="8"
                                strokeDasharray="283" strokeDashoffset={283 - (283 * stats.practical) / 100}
                                transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s' }} />
                        </svg>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                            {stats.practical}%
                        </div>
                    </div>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginTop: '5px' }}>Practical</p>
                    <p style={{ fontSize: '10px', color: '#94a3b8' }}>{stats.attendedPractical}/{stats.totalPractical}</p>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: Subject-Wise Attendance (Optimized) ---
const SubjectWiseAttendance = ({ user }) => {
    const [subjectStats, setSubjectStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSubjectStats = async () => {
            if (!user?.instituteId || !user?.department || !user?.year) return;

            try {
                const myAttendanceQ = query(
                    collection(db, 'attendance'),
                    where('studentId', '==', user.uid)
                );
                const myAttendanceSnap = await getDocs(myAttendanceQ);
                const myPresentSessionIds = new Set(myAttendanceSnap.docs.map(d => d.data().sessionId));

                const sessionsQ = query(
                    collection(db, 'live_sessions'),
                    where('instituteId', '==', user.instituteId),
                    where('department', '==', user.department),
                    where('academicYear', '==', user.academicYear || '2025-2026')
                );
                const snap = await getDocs(sessionsQ);

                let stats = {};

                snap.docs.forEach(doc => {
                    const data = doc.data();

                    // 🚨 THE FIX: Ignore Deleted and Cancelled sessions!
                    if (data.isDeleted === true || data.status === 'deleted' || data.status === 'cancelled') return;
                    if (data.type !== 'theory' && data.type !== 'practical') return;

                    const sessionYear = data.year || data.targetYear;
                    if (sessionYear !== 'All' && sessionYear !== user.year) return;

                    if (data.division && data.division !== 'All') {
                        const myDiv = user.division || user.div;
                        if (data.division !== myDiv) return;
                    }

                    const subject = data.subject || 'Unknown Subject';
                    if (!stats[subject]) stats[subject] = { tTotal: 0, tPresent: 0, pTotal: 0, pPresent: 0 };

                    const isPresent = myPresentSessionIds.has(doc.id);

                    if (data.type === 'practical') {
                        if (data.rollRange) {
                            const r = parseInt(user.rollNo);
                            if (r >= data.rollRange.start && r <= data.rollRange.end) {
                                stats[subject].pTotal++;
                                if (isPresent) stats[subject].pPresent++;
                            }
                        } else {
                            stats[subject].pTotal++;
                            if (isPresent) stats[subject].pPresent++;
                        }
                    } else {
                        stats[subject].tTotal++;
                        if (isPresent) stats[subject].tPresent++;
                    }
                });

                setSubjectStats(stats);
                setLoading(false);
            } catch (error) {
                console.error("Subject Stats Error:", error);
                setLoading(false);
            }
        };
        fetchSubjectStats();
    }, [user]);

    if (loading) return <div className="card" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading Subject Analytics...</div>;

    const subjectsArray = Object.entries(subjectStats).filter(([_, stat]) => stat.tTotal > 0 || stat.pTotal > 0);

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#1e293b' }}>Subject-wise Analytics</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {subjectsArray.length > 0 ? subjectsArray.map(([subject, stat]) => {
                    const tPct = stat.tTotal > 0 ? Math.round((stat.tPresent / stat.tTotal) * 100) : 0;
                    const pPct = stat.pTotal > 0 ? Math.round((stat.pPresent / stat.pTotal) * 100) : 0;

                    return (
                        <div key={subject} style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#334155' }}>{subject}</h4>

                            {stat.tTotal > 0 && (
                                <div style={{ marginBottom: stat.pTotal > 0 ? '10px' : '0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                                        <span>Theory ({stat.tPresent}/{stat.tTotal})</span>
                                        <span style={{ fontWeight: 'bold', color: tPct >= 75 ? '#10b981' : tPct >= 60 ? '#f59e0b' : '#ef4444' }}>{tPct}%</span>
                                    </div>
                                    <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '4px', height: '6px' }}>
                                        <div style={{ width: `${tPct}%`, background: tPct >= 75 ? '#10b981' : tPct >= 60 ? '#f59e0b' : '#ef4444', height: '100%', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                            )}

                            {stat.pTotal > 0 && (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                                        <span>Practical ({stat.pPresent}/{stat.pTotal})</span>
                                        <span style={{ fontWeight: 'bold', color: pPct >= 75 ? '#10b981' : pPct >= 60 ? '#f59e0b' : '#ef4444' }}>{pPct}%</span>
                                    </div>
                                    <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '4px', height: '6px' }}>
                                        <div style={{ width: `${pPct}%`, background: pPct >= 75 ? '#10b981' : pPct >= 60 ? '#f59e0b' : '#ef4444', height: '100%', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }) : <div style={{ textAlign: 'center', padding: '10px', color: '#94a3b8', fontSize: '13px' }}>No subjects found.</div>}
            </div>
        </div>
    );
};

// --- COMPONENT: Student Test Marks (New Card) ---
const StudentTestResults = ({ user }) => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid) return;

        // 🛑 OPTIMIZED: Fetch test results once
        const fetchResults = async () => {
            const q = query(
                collection(db, 'exam_marks'),
                where('year', '==', user.year),
                where('department', '==', user.department),
                orderBy('date', 'desc'),
                where('academicYear', '==', user.academicYear || '2025-2026'),
                limit(5)
            );

            const snapshot = await getDocs(q);
            const myResults = [];
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const studentScore = data.scores ? data.scores[user.uid] : null;

                if (studentScore) {
                    myResults.push({
                        id: doc.id, testName: data.testName, subject: data.subject,
                        date: data.date, maxMarks: data.maxMarks,
                        obtained: studentScore.marks, status: studentScore.status
                    });
                }
            });
            setResults(myResults);
            setLoading(false);
        };
        fetchResults();
    }, [user]);

    if (loading) return <div className="card" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading results...</div>;

    return (
        <div className="card" style={{ maxHeight: '350px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Recent Test Results</h3>
                <span style={{ fontSize: '12px', background: '#eff6ff', padding: '4px 10px', borderRadius: '20px', color: '#2563eb', fontWeight: '600' }}>
                    {results.length} Tests
                </span>
            </div>

            {results.length > 0 ? (
                // ✅ ADDED: overflowY and paddingRight for the scrollbar
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', paddingRight: '5px', flex: 1 }}>
                    {results.map(res => (
                        <div key={res.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '12px', background: '#f8fafc', borderRadius: '12px',
                            borderLeft: res.status === 'Pass' ? '4px solid #10b981' : '4px solid #ef4444'
                        }}>
                            <div>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#334155' }}>{res.testName}</h4>
                                <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                                    {res.subject} • {new Date(res.date).toLocaleDateString()}
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ display: 'block', fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>
                                    {res.obtained} <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'normal' }}>/ {res.maxMarks}</span>
                                </span>
                                <span style={{
                                    fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase',
                                    color: res.status === 'Pass' ? '#16a34a' : '#dc2626'
                                }}>
                                    {res.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '14px' }}>
                    No test results released yet.
                </div>
            )}
        </div>
    );
};

// --- COMPONENT: Student Assignment Marks (New Card) ---
const StudentAssignmentResults = ({ user }) => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);

   // ✅ FIXED: FETCH ASSIGNMENTS (Optimized with getDocs)
    useEffect(() => {
        if (!user?.instituteId) return;

        const fetchAssignments = async () => {
            const q = query(
                collection(db, 'assignments'),
                where('instituteId', '==', user.instituteId),
                where('department', '==', user.department),
                where('academicYear', '==', user.academicYear || '2025-2026')
            );

            try {
                const snapshot = await getDocs(q);
                const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const relevantTasks = allTasks.filter(task => {
                    const norm = (str) => str ? str.toString().trim().toLowerCase() : '';
                    const userDept = norm(user.department);
                    const taskDept = norm(task.department);
                    const userYear = norm(user.year);
                    const taskYear = norm(task.targetYear);

                    if (taskDept !== userDept) return false;
                    const isYearMatch = taskYear === 'all' || taskYear === userYear;
                    if (!isYearMatch) return false;

                    if (task.division && task.division !== 'All') {
                        const userDiv = norm(user.division || user.div);
                        const taskDiv = norm(task.division);
                        if (!userDiv || userDiv !== taskDiv) return false;
                    }
                    return true;
                });

                relevantTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                // ✅ FIXED: Changed setAssignments to setResults
                setResults(relevantTasks);
            } catch (error) {
                console.error("Error fetching assignments", error);
            } finally {
                // ✅ FIXED: Ensure loading state is set to false whether it succeeds or fails
                setLoading(false);
            }
        };

        fetchAssignments();
    }, [user?.instituteId, user?.department, user?.year, user?.division]);

    if (loading) return <div className="card" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading assignments...</div>;

    return (
        <div className="card" style={{ maxHeight: '350px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Recent Assignment Marks</h3>
                <span style={{ fontSize: '12px', background: '#fef3c7', padding: '4px 10px', borderRadius: '20px', color: '#d97706', fontWeight: '600' }}>
                    {results.length} Assignments
                </span>
            </div>

            {results.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', paddingRight: '5px', flex: 1 }}>
                    {results.map(res => (
                        <div key={res.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '12px', background: '#f8fafc', borderRadius: '12px',
                            borderLeft: res.status === 'Pass' ? '4px solid #10b981' : '4px solid #ef4444'
                        }}>
                            <div>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#334155' }}>{res.testName}</h4>
                                <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                                    {res.subject} • {new Date(res.createdAt || res.date).toLocaleDateString()}
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ display: 'block', fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>
                                    {res.obtained || 0} <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'normal' }}>/ {res.maxMarks || 0}</span>
                                </span>
                                <span style={{
                                    fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase',
                                    color: res.status === 'Pass' ? '#16a34a' : '#dc2626'
                                }}>
                                    {res.status || 'Pending'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '14px' }}>
                    No assignment marks released yet.
                </div>
            )}
        </div>
    );
};

// --- DASHBOARD HOME (Updated with Biometrics & Reordered Cards) ---
const DashboardHome = ({ user, setLiveSession, setRecentAttendance, liveSession, recentAttendance, setShowScanner, currentSlot, onBiometricAttendance, bioLoading, openNativeCameraForQR, setShowPinModal, setShowFaceScanner, handleFaceAttendance, setShowFaceSetup }) => {

    const displayName = user?.lastName ? user.lastName.split(' ')[0] : user?.firstName;

    useEffect(() => {
        if (!auth.currentUser) return;
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // ✅ FIXED: Changed from onSnapshot to getDocs
        const fetchRecentAttendance = async () => {
            const q = query(
                collection(db, "attendance"),
                where("studentId", "==", auth.currentUser.uid),
                where("timestamp", ">=", startOfDay),
                orderBy("timestamp", "desc")
            );

            try {
                const snapshot = await getDocs(q);
                setRecentAttendance(snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        timeDisplay: data.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        dateDisplay: data.timestamp?.toDate().toLocaleDateString()
                    };
                }));
            } catch (error) {
                console.error("Error fetching recent attendance", error);
            }
        };

        fetchRecentAttendance();
    }, [setRecentAttendance]);

    return (
        <div className="content-section">
            <h2 className="content-title">Welcome, {displayName}!</h2>

            <div className="cards-grid">

                {/* 1. Smart Schedule Card */}
                <SmartScheduleCard user={user} currentSlot={currentSlot} loading={!currentSlot} />

                {/* 2. ✨ ULTRA-MODERN LIVE ATTENDANCE CARD ✨ */}
                <div className="card" style={{
                    background: 'linear-gradient(120deg, #4f46e5 0%, #0ea5e9 100%)',
                    color: 'white', border: 'none', borderRadius: '24px',
                    boxShadow: '0 20px 40px -10px rgba(79, 70, 229, 0.5)',
                    position: 'relative', overflow: 'hidden', padding: '28px'
                }}>
                    <div style={{
                        position: 'absolute', top: '-60px', right: '-60px',
                        width: '220px', height: '220px',
                        background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)',
                        borderRadius: '50%', pointerEvents: 'none'
                    }}></div>
                    <div style={{
                        position: 'absolute', bottom: '-40px', left: '-20px',
                        width: '180px', height: '180px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '50%', filter: 'blur(30px)', pointerEvents: 'none'
                    }}></div>

                    <div style={{ position: 'relative', zIndex: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '12px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
                                }}>
                                    <i className="fas fa-wifi" style={{ fontSize: '16px' }}></i>
                                </div>
                                <span style={{ fontWeight: '600', fontSize: '14px', letterSpacing: '0.5px', textTransform: 'uppercase', opacity: 0.9 }}>
                                    Attendance
                                </span>
                            </div>

                            {liveSession && (
                                <div className="pulsate" style={{
                                    background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.4)',
                                    padding: '6px 14px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(4px)'
                                }}>
                                    <div style={{ width: '8px', height: '8px', background: '#bef264', borderRadius: '50%', boxShadow: '0 0 8px #bef264' }}></div>
                                    <span style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' }}>LIVE</span>
                                </div>
                            )}
                        </div>

                        {liveSession ? (
                            <div>
                                <div style={{ marginBottom: '28px' }}>
                                    <h1 style={{ fontSize: '34px', fontWeight: '800', margin: '0', lineHeight: '1.1', textShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                                        {liveSession.subject}
                                    </h1>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', opacity: 0.85 }}>
                                        <i className="far fa-clock"></i>
                                        <span style={{ fontSize: '14px', fontWeight: '500' }}>
                                            Session Started • {liveSession.startTime || "Now"}
                                        </span>
                                    </div>
                                </div>

                                {/* Primary QR Scanner Button */}
                                <button
                                    onClick={() => {
                                        if (Capacitor.isNativePlatform()) openNativeCameraForQR();
                                        else setShowScanner(true);
                                    }}
                                    style={{
                                        background: 'white', color: '#4f46e5', border: 'none', width: '100%',
                                        padding: '18px', borderRadius: '18px', fontSize: '16px', fontWeight: '800',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                        boxShadow: '0 8px 25px rgba(0,0,0,0.2)', transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                                        position: 'relative', overflow: 'hidden'
                                    }}
                                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <i className="fas fa-expand" style={{ fontSize: '18px' }}></i>
                                    {Capacitor.isNativePlatform() ? "Scan Now" : "Open Scanner"}
                                </button>

                                {/* NEW: Side-by-Side Face ID & PIN Buttons */}
                                <div style={{ display: 'flex', gap: '12px', marginTop: '15px' }}>
                                    <button
                                            onClick={() => {
                                                // 🚨 TEMPORARILY DISABLED FOR MAINTENANCE
                                                toast("This feature is under maintenance. Try to give attendance through QR or PIN.", { 
                                                    icon: '🔧',
                                                    duration: 4000,
                                                    style: {
                                                        borderRadius: '10px',
                                                        background: '#1e293b',
                                                        color: '#fff',
                                                    }
                                                });
                                            }}
                                            style={{
                                                flex: 1, background: 'rgba(255, 255, 255, 0.2)', border: '1px solid rgba(255, 255, 255, 0.4)',
                                                borderRadius: '16px', padding: '14px', color: 'white', fontSize: '14px',
                                                fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                backdropFilter: 'blur(10px)', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                                opacity: 0.8 // Slightly dimmed to show it's currently inactive
                                            }}
                                            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                                            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                            <i className="fas fa-user-check"></i> Face ID
                                        </button>
                                    <button
                                        onClick={() => setShowPinModal(true)}
                                        style={{
                                            flex: 1, background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.3)',
                                            borderRadius: '16px', padding: '14px', color: 'white', fontSize: '14px',
                                            fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            backdropFilter: 'blur(5px)', transition: 'all 0.2s ease'
                                        }}
                                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
                                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        <i className="fas fa-keyboard"></i> PIN Code
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.15)', borderRadius: '16px', padding: '25px',
                                textAlign: 'center', border: '1px dashed rgba(253, 253, 253, 0.3)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
                            }}>
                                <i className="fas fa-coffee" style={{ fontSize: '28px', opacity: 0.8, color: 'white' }}></i>
                                <p style={{ fontSize: '14px', fontWeight: '500', margin: 0, opacity: 0.9, color: 'white' }}>
                                    No active class. Enjoy your break!
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. TODAY'S HISTORY CARD */}
                <div className="card" style={{ maxHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0 }}>Today's History</h3>
                        <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '4px 10px', borderRadius: '20px', color: '#64748b' }}>
                            {recentAttendance.length} Classes
                        </span>
                    </div>

                    <div className="recent-attendance-list" style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
                        {recentAttendance.length > 0 ? (
                            recentAttendance.map(item => (
                                <div key={item.id} className="history-card" style={{ padding: '12px', marginBottom: '10px', borderLeft: '4px solid #3b82f6' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <div>
                                            <p className="history-subject" style={{ fontWeight: 'bold', fontSize: '15px', margin: '0 0 4px 0' }}>
                                                {item.subject}
                                            </p>
                                            <p className="history-date" style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                                                <i className="far fa-clock" style={{ marginRight: '5px' }}></i>
                                                {item.timeDisplay}
                                            </p>
                                        </div>
                                        <div className="status-badge-pill" style={{ background: '#dcfce7', color: '#166534', fontSize: '11px', padding: '4px 8px' }}>
                                            Present
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                                <p style={{ fontSize: '14px' }}>No attendance marked today.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Attendance Overview (Theory/Practical Circles) */}
                <AttendanceOverview user={user} />

                <SubjectWiseAttendance user={user} />

                {/* 5. Test Results (Now at the bottom) */}
                <StudentTestResults user={user} />

                {/* 6. Assignment Marks (Now at the bottom) */}
                <StudentAssignmentResults user={user} />

            </div>
        </div>
    );
};

const MobileFooter = ({ activePage, setActivePage, badgeCount, taskBadgeCount, liveSession, onScan, onChat }) => {
    return (
        <div className="mobile-footer">
            <button className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`} onClick={() => setActivePage('dashboard')}>
                <i className="fas fa-home"></i>
                <span>Home</span>
            </button>

            <button className={`nav-item ${activePage === 'notices' ? 'active' : ''}`} onClick={() => setActivePage('notices')} style={{ position: 'relative' }}>
                <i className="fas fa-bullhorn"></i>
                <span>Updates</span>
                {/* ✅ NOTICE BADGE */}
                {badgeCount > 0 && <span className="nav-badge" style={{ position: 'absolute', top: '-5px', right: '15px', padding: '2px 6px', background: '#ef4444', color: 'white', borderRadius: '10px', fontSize: '10px' }}>{badgeCount}</span>}
            </button>

            {/* FLOATING SCAN BUTTON */}
            <div className="scan-btn-wrapper">
                <button className="scan-btn" onClick={onScan}>
                    <i className="fas fa-qrcode"></i>
                    {liveSession && <div className="scan-badge">1</div>}
                </button>
            </div>

            {/* ✅ TASKS BUTTON WITH BADGE */}
            <button className={`nav-item ${activePage === 'tasks' ? 'active' : ''}`} onClick={() => setActivePage('tasks')} style={{ position: 'relative' }}>
                <i className="fas fa-tasks"></i>
                <span>Tasks</span>
                {taskBadgeCount > 0 && <span className="nav-badge" style={{ position: 'absolute', top: '-5px', right: '15px', padding: '2px 6px', background: '#10b981', color: 'white', borderRadius: '10px', fontSize: '10px' }}>{taskBadgeCount}</span>}
            </button>

            <button className={`nav-item ${activePage === 'profile' ? 'active' : ''}`} onClick={() => setActivePage('profile')}>
                <i className="fas fa-user"></i>
                <span>Profile</span>
            </button>
        </div>
    );
};

// ✅ NEW COMPONENT: Manual PIN Entry Modal (Fixed Z-Index)
const ManualAttendanceModal = ({ isOpen, onClose, onSubmit, pinValue, setPinValue, loading }) => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9000, // 👈 CHANGED from 99999 to 9000 (Toasts are usually 9999)
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            {/* Animation Styles */}
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .pin-input:focus {
                    border-color: #3b82f6 !important;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
                }
            `}</style>

            <div className="card" style={{
                width: '90%', maxWidth: '400px',
                background: 'white', borderRadius: '24px',
                padding: '30px', position: 'relative',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                display: 'flex', flexDirection: 'column', alignItems: 'center'
            }}>

                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '20px', right: '20px',
                        background: '#f1f5f9', border: 'none', width: '32px', height: '32px',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#64748b', fontSize: '16px', transition: 'all 0.2s'
                    }}
                >
                    &times;
                </button>

                <div style={{
                    width: '60px', height: '60px', borderRadius: '20px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '20px', boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.3)'
                }}>
                    <i className="fas fa-key" style={{ fontSize: '24px', color: 'white' }}></i>
                </div>

                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>
                    Enter Session PIN
                </h3>

                <p style={{ margin: 0, fontSize: '14px', color: '#64748b', textAlign: 'center', lineHeight: '1.5' }}>
                    Ask your teacher for the 6-digit dynamic PIN to mark your attendance manually.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '15px', margin: '25px 0' }}>
                    <div style={{ height: '1px', background: '#e2e8f0', flex: 1 }}></div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', background: 'white', padding: '0 5px' }}>
                        PIN CODE
                    </span>
                    <div style={{ height: '1px', background: '#e2e8f0', flex: 1 }}></div>
                </div>

                <input
                    type="number"
                    placeholder="• • • • • •"
                    value={pinValue}
                    onChange={(e) => setPinValue(e.target.value.slice(0, 6))}
                    className="pin-input"
                    style={{
                        width: '100%', fontSize: '24px', fontWeight: 'bold', textAlign: 'center',
                        letterSpacing: '8px', padding: '15px', borderRadius: '16px',
                        border: '2px solid #e2e8f0', background: '#f8fafc', color: '#1e293b',
                        outline: 'none', transition: 'all 0.2s', marginBottom: '25px'
                    }}
                    autoFocus
                />

                <button
                    onClick={onSubmit}
                    disabled={loading || pinValue.length < 6}
                    style={{
                        width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
                        background: loading ? '#cbd5e1' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white', fontSize: '16px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
                        boxShadow: loading ? 'none' : '0 10px 20px -5px rgba(16, 185, 129, 0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                    }}
                >
                    {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check-circle"></i>}
                    {loading ? 'Verifying...' : 'Submit Attendance'}
                </button>

            </div>
        </div>,
        document.body
    );
};

// --- COMPONENT: Teacher Feedback Form (Student View) ---
const FeedbackView = ({ user }) => {
    const [feedbackForms, setFeedbackForms] = useState(cachedFeedbackForms || []);
    const [deptTeachers, setDeptTeachers] = useState(cachedDeptTeachers || []);
    const [mySubmissions, setMySubmissions] = useState([]); // ✅ TRACKS SUBMISSIONS

    // UI States
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [selectedForm, setSelectedForm] = useState(null);
    const [isFormLoading, setIsFormLoading] = useState(false);
    const [feedbackResponse, setFeedbackResponse] = useState({ teacherId: '', subject: '', answers: {} });

    useEffect(() => {
        if (!user || !auth.currentUser) return;

        const currentUserId = auth.currentUser.uid; // ✅ FIX: Guaranteed to have the exact ID
        const fetchPromises = [];

        // 1. Fetch Forms
        if (!cachedFeedbackForms) {
            const formsPromise = fetch(`${BACKEND_URL}/getFeedbackForms`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    department: user.department,
                    year: user.year,
                    academicYear: user.academicYear || '2025-2026'
                })
            }).then(res => res.json()).then(data => {
                const myDiv = user.division || user.div;
                const filtered = (data.forms || []).filter(f => !f.division || f.division === 'All' || f.division === myDiv);
                cachedFeedbackForms = filtered;
                setFeedbackForms(filtered);
            }).catch(err => console.error("Error fetching forms", err));
            fetchPromises.push(formsPromise);
        }
// 2. Fetch Teachers (Safely checking enrolled departments for Agri)
        if (!cachedDeptTeachers) {
            // If they are in the COMMON pool, we must fetch teachers for ALL their enrolled departments
            const deptsToFetch = user.department === 'COMMON' && user.enrolledDepartments 
                ? user.enrolledDepartments 
                : [user.department];

            if (deptsToFetch.length > 0) {
                const teacherPromises = deptsToFetch.map(dept => 
                    fetch(`${BACKEND_URL}/getDepartmentTeachers`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            instituteId: user.instituteId,
                            department: dept
                        })
                    }).then(res => res.json())
                );

                const teachersPromise = Promise.all(teacherPromises).then(results => {
                    // Combine teachers from all fetched departments
                    let allTeachers = [];
                    results.forEach(data => {
                        if (data.teachers) allTeachers = [...allTeachers, ...data.teachers];
                    });
                    
                    // Remove duplicates just in case
                    const uniqueTeachers = Array.from(new Map(allTeachers.map(t => [t.id, t])).values());
                    
                    cachedDeptTeachers = uniqueTeachers;
                    setDeptTeachers(uniqueTeachers);
                }).catch(err => console.error("Error fetching teachers", err));
                
                fetchPromises.push(teachersPromise);
            }
        }

        // 3. ✅ REAL-TIME LISTENER FOR THIS STUDENT'S SUBMISSIONS
        const qSub = query(collection(db, 'feedback_responses'), where('studentId', '==', currentUserId));
        const unsubSub = onSnapshot(qSub, (snapshot) => {
            const subs = snapshot.docs.map(doc => doc.data());
            setMySubmissions(subs);
        });

        Promise.all(fetchPromises).finally(() => {
            setTimeout(() => { setIsInitialLoading(false); }, 2500);
        });

        return () => unsubSub(); // Cleanup listener on unmount
    }, [user]);

    const handleStartEvaluation = (form) => {
        setIsFormLoading(true);
        setTimeout(() => {
            setSelectedForm(form);
            setFeedbackResponse({ teacherId: '', subject: '', answers: {} });
            setIsFormLoading(false);
        }, 2000);
    };

    // 🎯 SMART TEACHER DROPDOWN LOGIC (Removes already evaluated subjects)
    let availableTeacherOptions = [];
    if (selectedForm) {
        availableTeacherOptions = [
            { value: '|', label: '-- Choose the subject to evaluate --' },
            ...deptTeachers.flatMap(teacher =>
                (teacher.assignedClasses || []).filter(cls => {
                    const matchesYear = cls.year === user.year;
                    let matchesDiv = true;
                    if (user.year === 'FE' || user.year === 'First Year') {
                        const myDiv = user.division || user.div;
                        matchesDiv = (!cls.divisions || cls.divisions === myDiv);
                    }

                    // ✅ CHECK: Has this student already submitted feedback for this teacher/subject?
                    const isAlreadyEvaluated = mySubmissions.some(sub =>
                        sub.formId === selectedForm.id &&
                        sub.teacherId === teacher.id &&
                        sub.subject === cls.subject
                    );

                    return matchesYear && matchesDiv && !isAlreadyEvaluated;
                }).map((cls, idx) => ({
                    value: `${teacher.id}|${cls.subject}`,
                    label: `${cls.subject} (Prof. ${teacher.name})`
                }))
            )
        ];
    }

    return (
        <div className="content-section std-fb-wrapper">
            <div style={{ marginBottom: '25px' }}>
                <h2 className="content-title" style={{ margin: 0 }}>Teacher Feedback</h2>
                <p className="content-subtitle" style={{ margin: '5px 0 0 0' }}>Your honest feedback is 100% anonymous & secure.</p>
            </div>

            {isInitialLoading ? (
                <div className="std-fb-initial-loader">
                    <div className="std-fb-radar"></div>
                    <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '20px', fontWeight: '800' }}>Establishing Secure Link...</h3>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Fetching your anonymous evaluation portals</p>
                </div>
            ) :
                isFormLoading ? (
                    <div className="std-fb-loader-container">
                        <div className="std-fb-pulse-ring">
                            <div className="std-fb-shield-icon"><i className="fas fa-user-secret"></i></div>
                        </div>
                        <h3 style={{ margin: '20px 0 5px 0', color: '#1e293b', fontSize: '18px', fontWeight: '800' }}>Encrypting Session...</h3>
                        <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Protecting your identity</p>
                    </div>
                ) : !selectedForm ? (
                    // --- LIST VIEW ---
                    <div className="cards-grid std-fb-stagger-grid">
                        {feedbackForms.length > 0 ? feedbackForms.map((form, index) => {

                            // ✅ COUNT SUBMISSIONS FOR THIS SPECIFIC FORM
                            const formSubmissions = mySubmissions.filter(s => s.formId === form.id);
                            const hasSubmittedAtLeastOnce = formSubmissions.length > 0;

                            return (
                                <div key={form.id} className={`std-fb-list-card ${hasSubmittedAtLeastOnce ? 'completed' : ''}`} style={{ animationDelay: `${index * 0.15}s` }}>
                                    <div className="std-fb-card-bg-blob"></div>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px', position: 'relative', zIndex: 2 }}>

                                        {/* Icon changes to Green Check if submitted */}
                                        <div className={`std-fb-icon-box ${hasSubmittedAtLeastOnce ? 'submitted' : ''}`}>
                                            <i className={`fas ${hasSubmittedAtLeastOnce ? 'fa-check-circle' : 'fa-clipboard-list'}`}></i>
                                        </div>

                                        <div>
                                            <h3 style={{ margin: 0, color: '#1e293b', fontSize: '18px', fontWeight: '800', lineHeight: '1.2' }}>{form.title}</h3>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                                <span className="std-fb-anon-badge" style={{ margin: 0 }}>
                                                    <i className="fas fa-shield-check"></i> Anonymous
                                                </span>

                                                {/* ✅ SHOW GREEN BADGE WITH SUBMISSION COUNT */}
                                                {hasSubmittedAtLeastOnce && (
                                                    <span className="std-fb-anon-badge" style={{ margin: 0, background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0' }}>
                                                        <i className="fas fa-check-double"></i> Evaluated ({formSubmissions.length} subjects)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        className={`std-fb-start-btn ${hasSubmittedAtLeastOnce ? 'submitted' : ''}`}
                                        onClick={() => handleStartEvaluation(form)}
                                    >
                                        <span>{hasSubmittedAtLeastOnce ? 'Evaluate Another Subject' : 'Start Evaluation'}</span> <i className="fas fa-arrow-right"></i>
                                    </button>
                                </div>
                            );
                        }) : (
                            <div className="std-fb-empty-wrapper">
                                <div className="std-fb-empty-badge">
                                    <i className="fas fa-info-circle" style={{ color: '#3b82f6' }}></i> Status Clear
                                </div>
                                <div className="std-fb-empty-illustration">
                                    <i className="fas fa-check-double"></i>
                                </div>
                                <h3 className="std-fb-empty-title">You're All Caught Up!</h3>
                                <p className="std-fb-empty-subtitle">
                                    There are no active feedback forms assigned to your class right now. Relax and check back later!
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    // --- FORM VIEW ---
                    <div className="std-fb-form-container">
                        <button
                            className="std-fb-back-btn"
                            onClick={() => setSelectedForm(null)}
                        >
                            <i className="fas fa-chevron-left"></i> Back
                        </button>

                        <h3 className="std-fb-form-title">
                            {selectedForm.title}
                        </h3>

                        {/* ✅ CHECK IF ALL SUBJECTS ARE EVALUATED */}
                        {availableTeacherOptions.length <= 1 ? (
                            <div className="std-fb-all-complete">
                                <div className="std-fb-all-complete-icon"><i className="fas fa-check"></i></div>
                                <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#1e293b' }}>Evaluation Complete</h3>
                                <p style={{ margin: 0, color: '#64748b', fontSize: '14px', lineHeight: '1.6' }}>
                                    You have successfully submitted feedback for all your assigned subjects. Thank you for your honest responses!
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="std-fb-dropdown-section" style={{ position: 'relative', zIndex: 100 }}>
                                    <CustomMobileSelect
                                        label="Select Subject & Teacher"
                                        icon="fa-chalkboard-teacher"
                                        value={`${feedbackResponse.teacherId}|${feedbackResponse.subject}`}
                                        onChange={(val) => {
                                            const [tId, sub] = val.split('|');
                                            setFeedbackResponse({ ...feedbackResponse, teacherId: tId || '', subject: sub || '' });
                                        }}
                                        options={availableTeacherOptions}
                                    />
                                    <p className="std-fb-hint" style={{ marginTop: '12px' }}>
                                        <i className="fas fa-info-circle"></i> Only remaining unevaluated subjects are shown.
                                    </p>
                                </div>

                                {/* Dynamic Questions */}
                                {selectedForm.questions.map((q, index) => (
                                    <div key={q.id} className="std-fb-question-box" style={{ position: 'relative', zIndex: 40 - index }}>
                                        <h4 className="std-fb-question-text">
                                            <span className="std-fb-q-num">Q{index + 1}.</span> {q.text}
                                        </h4>

                                        {q.type === 'text' ? (
                                            <textarea
                                                rows="4"
                                                className="std-fb-textarea"
                                                placeholder="Type your honest thoughts here..."
                                                value={feedbackResponse.answers[q.id] || ''}
                                                onChange={e => setFeedbackResponse({
                                                    ...feedbackResponse,
                                                    answers: { ...feedbackResponse.answers, [q.id]: e.target.value }
                                                })}
                                            ></textarea>
                                        ) : (
                                            <div className="std-fb-radio-group">
                                                {q.options.map((opt, oIndex) => {
                                                    const isSelected = feedbackResponse.answers[q.id] === opt;
                                                    return (
                                                        <label key={oIndex} className={`std-fb-radio-label ${isSelected ? 'selected' : ''}`}>
                                                            <input
                                                                type="radio"
                                                                name={`question_${q.id}`}
                                                                value={opt}
                                                                checked={isSelected}
                                                                onChange={e => setFeedbackResponse({
                                                                    ...feedbackResponse,
                                                                    answers: { ...feedbackResponse.answers, [q.id]: e.target.value }
                                                                })}
                                                                className="std-fb-radio-input"
                                                            />
                                                            <div className="std-fb-radio-circle"></div>
                                                            <span className="std-fb-radio-text">{opt}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <button
                                    className="std-fb-submit-btn"
                                    disabled={!feedbackResponse.teacherId || !feedbackResponse.subject}
                                    onClick={async () => {
                                        const toastId = toast.loading("Submitting Securely...");
                                        try {
                                            const formattedAnswers = selectedForm.questions.map(q => ({
                                                questionText: q.text,
                                                answer: feedbackResponse.answers[q.id] || 'No Answer'
                                            }));

                                            const res = await fetch(`${BACKEND_URL}/submitFeedback`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    formId: selectedForm.id,
                                                    studentId: auth.currentUser.uid, // ✅ FIX: Use guaranteed auth ID
                                                    teacherId: feedbackResponse.teacherId,
                                                    subject: feedbackResponse.subject,
                                                    answers: formattedAnswers,
                                                    academicYear: user.academicYear || '2025-2026'
                                                })
                                            });

                                            const data = await res.json();
                                            if (!res.ok) throw new Error(data.error);

                                            toast.success("Evaluation submitted anonymously!", { id: toastId });
                                            setSelectedForm(null); // Kicks back to list view which immediately shows the ✅ Badge
                                        } catch (error) {
                                            toast.error(error.message || "Failed to submit.", { id: toastId });
                                        }
                                    }}
                                >
                                    <i className="fas fa-paper-plane" style={{ marginRight: '8px' }}></i> Submit Evaluation
                                </button>
                            </>
                        )}
                    </div>
                )}
        </div>
    );
};

// --- MAIN COMPONENT ---
export default function StudentDashboard() {
    const [activePage, setActivePage] = useState('dashboard');
    const [user, setUser] = useState(null);
    const [notices, setNotices] = useState([]);
    const [readCount, setReadCount] = useState(() => {
        const saved = localStorage.getItem('seenNoticesCount');
        return saved ? parseInt(saved) : 0;
    });
    // ✅ 2. NEW: Assignments State & Task Read Count
    const [assignments, setAssignments] = useState([]);
    const [taskReadCount, setTaskReadCount] = useState(() => {
        const saved = localStorage.getItem('seenTasksCount');
        return saved ? parseInt(saved) : 0;
    });

    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [liveSession, setLiveSession] = useState(null);
    const [recentAttendance, setRecentAttendance] = useState([]);
    const [zoom, setZoom] = useState(1);
    const [zoomCap, setZoomCap] = useState(null);
    const [showPinModal, setShowPinModal] = useState(false);
    const [enteredPin, setEnteredPin] = useState('');
    const [livenessPrompt, setLivenessPrompt] = useState("");
    const [loading, setLoading] = useState(false);

    const [showFaceSetup, setShowFaceSetup] = useState(false);
    const [isScanningSetup, setIsScanningSetup] = useState(false);
    const videoSetupRef = useRef(null);
    // 📸 DAILY FACE ATTENDANCE STATE
    const [showFaceScanner, setShowFaceScanner] = useState(false);
    const [isScanningFace, setIsScanningFace] = useState(false);
    const faceVideoRef = useRef(null);
    const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";



    const handleFaceRegistration = async () => {
        setIsScanningSetup(true);
        const toastId = toast.loading("Requesting Camera Access...");
        let stream = null;

       
        const optimalInputSize = 416;
        const optimalThreshold = 0.40;

        try {
            if (Capacitor.isNativePlatform()) {
                const permissions = await Camera.requestPermissions();
                if (permissions.camera !== 'granted' && permissions.camera !== 'limited') {
                    toast.dismiss(toastId);
                    toast.error("You must allow camera access to set up Face ID.");
                    setIsScanningSetup(false);
                    return;
                }
            }

            if (!modelsLoaded) {
                toast.loading("Loading AI Models...", { id: toastId });
                const MODEL_URL = process.env.PUBLIC_URL ? process.env.PUBLIC_URL + '/models' : '/models';
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                modelsLoaded = true;
            }

            toast.loading("Starting Camera...", { id: toastId });

            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });

            if (videoSetupRef.current) {
                videoSetupRef.current.srcObject = stream;
            }

            toast("Please look straight into the camera...", { icon: '📸', id: toastId, duration: 3000 });

            let attempts = 0;
            const maxAttempts = 60;
            let isCancelled = false;
            let glitchCount = 0;

            const scanLoop = async () => {
                const video = videoSetupRef.current;

                if (!video || isCancelled) {
                    if (stream) stream.getTracks().forEach(track => track.stop());
                    return;
                }

                if (video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) {
                    setTimeout(scanLoop, 250);
                    return;
                }

               
                video.width = video.videoWidth;
                video.height = video.videoHeight;

                try {
                    const detection = await faceapi.detectSingleFace(
                        video,
                       new faceapi.SsdMobilenetv1Options({ minConfidence: 0.85 })
                    ).withFaceLandmarks().withFaceDescriptor();

                    if (detection && detection.detection.score > optimalThreshold) {
                        const descriptorArray = Array.from(detection.descriptor);

                        
                        const badValueCount = descriptorArray.filter(
                            val => val === null || isNaN(val) || !isFinite(val)
                        ).length;

                        if (badValueCount > 64) {
                            
                            glitchCount++;
                            console.warn(`⚠️ Bad frame (${badValueCount}/128 values corrupt). Retry ${glitchCount}...`);

                            if (glitchCount >= 10) {
                                // After 10 bad frames, clean & normalize as a last resort
                                console.warn("🔧 Forcing descriptor cleanup after repeated glitches...");
                            } else {
                                setTimeout(scanLoop, 150);
                                return;
                            }
                        }

                        
                        const cleanedDescriptor = descriptorArray.map(val =>
                            (val === null || isNaN(val) || !isFinite(val)) ? 0 : val
                        );

                        // Re-normalize to a unit vector (face descriptors must be L2-normalized)
                        const norm = Math.sqrt(cleanedDescriptor.reduce((sum, v) => sum + v * v, 0));
                        const finalDescriptor = norm > 0 ? cleanedDescriptor.map(v => v / norm) : cleanedDescriptor;

                        stream.getTracks().forEach(track => track.stop());
                        setIsScanningSetup(false);
                        toast.loading("Saving High-Quality Face ID...", { id: toastId });

                        const token = await auth.currentUser.getIdToken();
                        const response = await fetch(`${BACKEND_URL}/registerFace`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                           body: JSON.stringify({ descriptor: finalDescriptor })
                        });

                        if (response.ok) {
                            toast.success("Face ID Registered! You can now mark attendance.", { id: toastId });
                            setShowFaceSetup(false);
                        } else {
                            const data = await response.json();
                            toast.error(data.error || "Registration failed.", { id: toastId });
                        }
                        return;
                    }

                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(scanLoop, 300);
                    } else {
                        handleFailure("Face not clear. Please wipe your lens and face a bright light.");
                    }

                } catch (e) {
                    console.error("Camera Error:", e);
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(scanLoop, 300);
                    } else {
                        handleFailure("An error occurred while scanning.");
                    }
                }
            };

            const handleFailure = (message) => {
                if (stream) stream.getTracks().forEach(track => track.stop());
                setIsScanningSetup(false);
                toast.error(message, { id: toastId, duration: 5000 });
            };

            setTimeout(scanLoop, 2000);

        } catch (err) {
            if (stream) stream.getTracks().forEach(track => track.stop());
            toast.dismiss(toastId);
            toast.error(`Blocked: ${err.message || err}`, { duration: 6000 });
            setIsScanningSetup(false);
        }
    };

    // --- COMPONENT: Face ID Manager (Student View) ---
    const FaceIdManager = ({ user }) => {
        const [reason, setReason] = useState('');
        const [myRequests, setMyRequests] = useState([]);
        const [loading, setLoading] = useState(false);

       useEffect(() => {
            if (!user?.uid) return;
            // 🛑 OPTIMIZED: Fetch once
            const fetchRequests = async () => {
                const q = query(collection(db, 'face_update_requests'), where('studentId', '==', user.uid));
                const snapshot = await getDocs(q);
                const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                reqs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                setMyRequests(reqs);
            };
            fetchRequests();
        }, [user]);

        const handleSubmit = async (e) => {
            e.preventDefault();
            setLoading(true);
            const toastId = toast.loading("Sending Request...");
            try {
                const token = await auth.currentUser.getIdToken();
                const res = await fetch(`${BACKEND_URL}/requestFaceUpdate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ reason })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                toast.success(data.message, { id: toastId });
                setReason('');
            } catch (err) {
                toast.error(err.message, { id: toastId });
            } finally {
                setLoading(false);
            }
        };

        return (
            <div className="content-section">
                <h2 className="content-title">Face ID Settings</h2>

                <div className="card" style={{ marginBottom: '30px' }}>
                    <h3 style={{ marginTop: 0 }}>Request Face ID Reset</h3>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>If you got a new device, changed your appearance, or your scanner isn't working, request a reset from your Institute Admin.</p>

                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label>Reason for Update</label>
                            <input type="text" required value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., I got a new phone with a better camera" />
                        </div>
                        <button className="btn-primary" disabled={loading} style={{ background: '#db2777' }}>
                            {loading ? 'Sending...' : 'Submit Request'}
                        </button>
                    </form>
                </div>

                <h3 style={{ color: '#1e293b', fontSize: '18px' }}>My Requests</h3>
                <div className="cards-grid">
                    {myRequests.map(req => (
                        <div key={req.id} className="card" style={{ borderLeft: `5px solid ${req.status === 'approved' ? '#10b981' : req.status === 'rejected' ? '#ef4444' : '#f59e0b'}`, padding: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 5px 0' }}>{req.reason}</h4>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{req.createdAt?.toDate().toLocaleDateString()}</p>
                                </div>
                                <span className={`status-badge status-${req.status}`} style={{ textTransform: 'uppercase', fontSize: '11px' }}>{req.status}</span>
                            </div>
                        </div>
                    ))}
                    {myRequests.length === 0 && <p style={{ color: '#94a3b8' }}>No requests made yet.</p>}
                </div>
            </div>
        );
    };

    const handleFaceAttendance = async () => {
        setIsScanningFace(true);
        setLivenessPrompt("Checking Security Permissions...");
        const toastId = toast.loading("Checking Security Permissions...");

        try {
            if (Capacitor.isNativePlatform()) {
                const permissions = await Camera.requestPermissions();
                if (permissions.camera !== 'granted' && permissions.camera !== 'limited') {
                    toast.dismiss(toastId);
                    toast.error("Camera access is required to scan your face.");
                    setIsScanningFace(false);
                    setShowFaceScanner(false);
                    return;
                }
            }

            setLivenessPrompt("Loading AI Models...");
            toast.loading("Initializing Security Camera...", { id: toastId });
            const MODEL_URL = process.env.PUBLIC_URL ? process.env.PUBLIC_URL + '/models' : '/models';
           await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
            await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });
            if (faceVideoRef.current) faceVideoRef.current.srcObject = stream;

            setLivenessPrompt("Looking for your face... 👀");
            toast.loading("Analyzing Face...", { id: toastId });

            let attempts = 0;
            const maxAttempts = 150;
            let currentChallenge = "detecting";

            // PRE-liveness descriptor (captured when face is first detected)
            let preDescriptor = null;
            // POST-liveness descriptor (captured AFTER blink, proves same person did liveness)
            let postDescriptor = null;

            const stopAndFail = (message) => {
                stream.getTracks().forEach(track => track.stop());
                setIsScanningFace(false);
                setShowFaceScanner(false);
                toast.error(message, { id: toastId, duration: 5000 });
            };

           const captureDescriptor = async (video) => { 
                const det = await faceapi.detectSingleFace(
                    video,
                    new faceapi.SsdMobilenetv1Options({ minConfidence: 0.85 }) // ✅ NEW
                ).withFaceLandmarks().withFaceDescriptor();

                if (!det) return null;

                const arr = Array.from(det.descriptor);
                // Reject corrupted GPU frames
                if (arr.some(v => v === null || isNaN(v) || !isFinite(v))) return null;

                // Normalize to unit vector (matches registration normalization)
                const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
                return norm > 0 ? arr.map(v => v / norm) : arr;
            };

            const scanLoop = async () => {
                const video = faceVideoRef.current;
                if (!video) return;

                if (video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) {
                    setTimeout(scanLoop, 100);
                    return;
                }

                video.width = video.videoWidth;
                video.height = video.videoHeight;

                try {
                    // ═══════════════════════════════════════════════════════
                    // PHASE 1 — Initial face detection & descriptor capture
                    // High inputSize (416) for accurate descriptor
                    // ═══════════════════════════════════════════════════════
                    if (currentChallenge === "detecting") {
                        const desc = await captureDescriptor(video, 416);
                        if (desc) {
                            preDescriptor = desc;
                            currentChallenge = "smile";
                            setLivenessPrompt("Face locked! Now SMILE 😊");
                        }
                    }

                    // ═══════════════════════════════════════════════════════
                    // PHASE 2 — Liveness challenges (Smile → Blink)
                    // Uses lower inputSize for speed during liveness
                    // ═══════════════════════════════════════════════════════
                    else if (currentChallenge === "smile" || currentChallenge === "blink") {
                        const livenessDetection = await faceapi.detectSingleFace(
                            video,
                            new faceapi.SsdMobilenetv1Options({ minConfidence: 0.50 }) // ✅ NEW (0.50 is fine here for fast blink detection)
                        ).withFaceLandmarks().withFaceExpressions();

                        if (livenessDetection) {
                            if (currentChallenge === "smile") {
                                // Require a strong smile — 0.85 threshold rejects subtle expressions
                                if (livenessDetection.expressions.happy > 0.85) {
                                    currentChallenge = "blink";
                                    setLivenessPrompt("Great! Now BLINK your eyes! 😑");
                                }
                            } else if (currentChallenge === "blink") {
                                const landmarks = livenessDetection.landmarks.positions;
                                const leftEye = landmarks.slice(36, 42);
                                const rightEye = landmarks.slice(42, 48);
                                const avgEAR = (calculateEAR(leftEye) + calculateEAR(rightEye)) / 2;

                                // EAR < 0.22 = eyes clearly closed (stricter than 0.25)
                                if (avgEAR < 0.22) {
                                    currentChallenge = "recapture";
                                    setLivenessPrompt("Hold still... Re-verifying identity 🔒");
                                }
                            }
                        }
                    }

                    // ═══════════════════════════════════════════════════════
                    // PHASE 3 — Post-liveness re-capture
                    // The CRITICAL anti-spoof step:
                    // Capture a SECOND descriptor after liveness passes.
                    // Compare pre vs post — if different faces, it's a spoof.
                    // ═══════════════════════════════════════════════════════
                    else if (currentChallenge === "recapture") {
                        const desc = await captureDescriptor(video, 416);
                        if (desc) {
                            postDescriptor = desc;

                            // Calculate Euclidean distance between pre and post descriptors
                            // If two captures of the SAME face, distance should be < 0.35
                            // If different faces (photo held up then removed), distance will be > 0.50
                            let prePostSum = 0;
                            for (let i = 0; i < 128; i++) {
                                prePostSum += Math.pow(postDescriptor[i] - preDescriptor[i], 2);
                            }
                            const prePostDistance = Math.sqrt(prePostSum);

                            console.log(`[Anti-Spoof] Pre vs Post descriptor distance: ${prePostDistance.toFixed(4)}`);

                            if (prePostDistance > 0.50) {
                                // The face changed between detection and post-liveness.
                                // This is the classic "show a photo, then move it" spoof attack.
                                stopAndFail("⚠️ Security Alert: Face inconsistency detected. Please try again without any obstructions.");
                                return;
                            }

                            // Pre and post match — use the post-liveness descriptor for backend
                            // (post is taken after the person has proven they are live)
                            currentChallenge = "passed";
                        }
                    }

                    // ═══════════════════════════════════════════════════════
                    // PHASE 4 — Submit to backend
                    // ═══════════════════════════════════════════════════════
                    if (currentChallenge === "passed") {
                        setLivenessPrompt("Verifying Identity... 🔒");
                        stream.getTracks().forEach(track => track.stop());
                        setIsScanningFace(false);
                        setShowFaceScanner(false);

                        toast.loading("Verifying Identity & GPS Location...", { id: toastId });

                        try {
                            const currentDeviceId = await getUniqueDeviceId();
                            const position = await getLocation();
                            const token = await auth.currentUser.getIdToken();

                            // Send the POST-liveness descriptor to backend
                            // This is the final proof that the live person matches the registered face
                            const response = await fetch(`${BACKEND_URL}/markAttendance`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({
                                    sessionId: liveSession.id,
                                    studentLocation: { latitude: position.coords.latitude, longitude: position.coords.longitude },
                                    deviceId: currentDeviceId,
                                    faceDescriptor: postDescriptor, // ← POST-liveness descriptor
                                    preDescriptor: preDescriptor,   // ← PRE-liveness (for backend dual-check)
                                    verificationMethod: 'face'
                                })
                            });

                            const data = await response.json();
                            if (response.ok) {
                                toast.success(data.message, { id: toastId, duration: 4000 });
                            } else {
                                toast.error(data.error || "Attendance Failed", { id: toastId, duration: 5000 });
                            }
                        } catch (err) {
                            toast.error("Verification failed. Please check your connection.", { id: toastId });
                        }
                        return;
                    }

                    // Timeout guard
                    attempts++;
                    if (attempts >= maxAttempts) {
                        stopAndFail("Liveness check timed out. Make sure you are in a bright area.");
                        return;
                    }

                    setTimeout(scanLoop, 100);

                } catch (e) {
                    console.error("🚨 Liveness Error:", e);
                    setTimeout(scanLoop, 100);
                }
            };

            setTimeout(scanLoop, 1500);

        } catch (err) {
            console.error("NATIVE ERROR:", err);
            toast.error(`Blocked: ${err.message || err}`, { id: toastId, duration: 6000 });
            setIsScanningFace(false);
            setShowFaceScanner(false);
        }
    };


    // ✅ GLOBAL SCHEDULE STATE
    const [currentSlot, setCurrentSlot] = useState(null);
    const [isFreePeriod, setIsFreePeriod] = useState(false);
    // ✅ CHATBOT PROMPT STATE
    const [chatInitialMessage, setChatInitialMessage] = useState('');

    // ✅ BIOMETRIC HOOK
    const { authenticate, bioLoading } = useBiometricAuth();

    const scannerRef = useRef(null);
    const navigate = useNavigate();

    // ✅ FLASHLIGHT STATE for low-light scanning
    const [flashlightOn, setFlashlightOn] = useState(false);

    // 🎯 NATIVE CAMERA QR SCANNING (Like Google Pay)
    // 🎯 TRUE NATIVE SCANNER (Google Pay Style)
    const openNativeCameraForQR = async () => {
        try {
            // 1. Check Permissions
            const { camera } = await BarcodeScanner.requestPermissions();
            if (camera !== 'granted' && camera !== 'limited') {
                toast.error("Camera permission denied");
                return;
            }

            // 2. Start Live Scanner (Opens a native camera view on top)
            const { barcodes } = await BarcodeScanner.scan({
                formats: [], // Scan all formats
            });

            // 3. Handle Result
            if (barcodes.length > 0) {
                const scannedValue = barcodes[0].rawValue;
                await onScanSuccess(scannedValue);
            }
        } catch (err) {
            console.error("Native Scan Error:", err);
            // Fallback to web scanner if native fails
            if (!err.message.includes('canceled')) {
                toast.error("Native scanner failed, switching to Web Scanner");
                setShowScanner(true);
            }
        }
    };

    // 🔍 Decode QR Code from Image Data
    const decodeQRFromImage = async (imageDataUrl) => {
        try {
            // Method 1: Use Html5Qrcode static method
            const result = await Html5Qrcode.scanFile(imageDataUrl, true);
            return result.decodedText || result;
        } catch (err) {
            console.error("QR Decode Error:", err);
            // Method 2: Try creating image and using jsQR library approach
            try {
                // Create image element
                const img = new Image();
                img.src = imageDataUrl;

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });

                // Create canvas and draw image
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                // Get image data
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // Try to decode with Html5Qrcode scanner
                const tempScanner = new Html5Qrcode("qr-reader-temp");
                const qrResult = await tempScanner.scanFile(canvas.toDataURL(), false);
                return qrResult.decodedText || qrResult;
            } catch (e) {
                console.error("Fallback decode failed:", e);
                return null;
            }
        }
    };



    // ✅ Toggle Flashlight for better scanning in low light
    const toggleFlashlight = async () => {
        try {
            if (scannerRef.current) {
                await scannerRef.current.applyVideoConstraints({
                    advanced: [{ torch: !flashlightOn }]
                });
                setFlashlightOn(!flashlightOn);
            }
        } catch (err) {
            console.log("Flashlight not supported:", err);
            toast.error("Flashlight not available on this device");
        }
    };

    // ✅ NEW: Handle Zoom Slider
    // ✅ NEW: Smart Zoom Handler (Hardware + CSS Fallback)
    // ✅ NEW: Smart Zoom Handler (Hardware + CSS Fallback)
    const handleZoomChange = (e) => {
        const val = Number(e.target.value);
        setZoom(val);

        // A. Try Hardware Zoom first (Clearer)
        if (zoomCap && scannerRef.current) {
            scannerRef.current.applyVideoConstraints({
                advanced: [{ zoom: val }]
            }).catch(err => console.log("Hardware zoom failed, ignoring...", err));
        } else {
            // B. Fallback to CSS Zoom (Works on all devices)
            const videoElement = document.querySelector('#reader video');
            if (videoElement) {
                videoElement.style.transform = `scale(${val})`;
                videoElement.style.transformOrigin = "center center";
            }
        }
    };
    // 1. User Loading
    useEffect(() => {
        const authUnsub = onAuthStateChanged(auth, (authUser) => {
            if (authUser) {
                const unsub = onSnapshot(doc(db, "users", authUser.uid), (doc) => {
                    if (doc.exists()) setUser(doc.data());
                });
                return () => unsub();
            } else {
                // ✅ SAFETY: Ensure local user state is cleared immediately
                setUser(null);
                // App.js handles the redirect, but this ensures we don't render stale data
            }
        });
        return () => authUnsub();
    }, []);



   // ✅ 2. Listen for Active Session (Filtered by Year AND Division AND Enrolled Depts)
    useEffect(() => {
        if (!auth.currentUser || !user) return;

        // 🚨 THE FIX: For Agri/Medical (where user.department might be 'COMMON'), 
        // we can't filter by department in the query. We must fetch all institute sessions and filter in memory.
        const isNonEngg = user.department === 'COMMON' || (user.enrolledDepartments && user.enrolledDepartments.length > 0);

        const q = isNonEngg 
            ? query(
                collection(db, 'live_sessions'),
                where('isActive', '==', true),
                where('instituteId', '==', user.instituteId)
            )
            : query(
                collection(db, 'live_sessions'),
                where('isActive', '==', true),
                where('instituteId', '==', user.instituteId),
                where('department', '==', user.department)
            );

        const unsub = onSnapshot(q, (snap) => {
            if (!snap.empty) {
                // ✅ CLIENT-SIDE FILTERING
                const relevantSession = snap.docs.find(doc => {
                    const data = doc.data();

                    // 1. Check Department Match (CRITICAL FOR AGRI)
                    if (isNonEngg) {
                        const myDepts = user.enrolledDepartments || [];
                        if (!myDepts.includes(data.department)) return false;
                    }

                    // 2. Check Year Match
                    const sessionYear = data.year || data.targetYear;
                    const isYearMatch = sessionYear === 'All' || sessionYear === user.year;
                    if (!isYearMatch) return false;

                    // 3. Check Division Match
                    if (data.division && data.division !== 'All') {
                        const myDiv = user.division || user.div;
                        if (!myDiv || data.division !== myDiv) return false;
                    }

                    // 4. Check Roll Number Range (For Practical Labs)
                    if (data.type === 'practical' && data.rollRange) {
                        const myRoll = parseInt(user.rollNo);
                        const min = parseInt(data.rollRange.start);
                        const max = parseInt(data.rollRange.end);

                        if (isNaN(myRoll) || myRoll < min || myRoll > max) return false;
                    }

                    return true; // Passed all checks
                });

                if (relevantSession) {
                    setLiveSession({ id: relevantSession.id, ...relevantSession.data() });
                } else {
                    setLiveSession(null);
                }
            } else {
                setLiveSession(null);
            }
        });

        return () => unsub();
    }, [user]);

    // src/pages/StudentDashboard.js

    // 3. GLOBAL SCHEDULE LOGIC (Fixed to match HOD's new format)
    useEffect(() => {
        const fetchSchedule = async () => {
            if (!user?.department || !user?.year || !user?.instituteId) return;

            // Get Current Day Name (e.g., "Monday")
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const today = days[new Date().getDay()];

            if (today === 'Sunday') {
                setCurrentSlot({ type: 'Holiday', subject: 'Weekend! Relax.' });
                return;
            }

            try {
                // ✅ 1. Construct the EXACT ID that HOD Dashboard uses
                let docId = `${user.instituteId}_${user.department}_${user.year}_Timetable`;

                // If FE, append the Division (e.g., _FE_A_Timetable)
                if (user.year === 'FE' && user.division) {
                    docId = `${user.instituteId}_${user.department}_${user.year}_${user.division}_Timetable`;
                }

                // ✅ 2. Fetch the Weekly Timetable Document
                const docSnap = await getDoc(doc(db, 'timetables', docId));

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const todaysSlots = data[today] || []; // Get array for "Monday" etc.

                    // ✅ 3. Find Active Slot based on Current Time
                    const now = getCurrentTimeMinutes();
                    const activeSlot = todaysSlots.find(slot => {
                        const start = getMinutesFromTime(slot.startTime);
                        const end = getMinutesFromTime(slot.endTime);
                        return now >= start && now < end;
                    });

                    // Set State
                    if (activeSlot) {
                        setCurrentSlot(activeSlot);
                        // Trigger Free Period logic if needed
                        const isNowFree = activeSlot.type === 'Break' || activeSlot.type === 'Free';
                        if (isNowFree && !isFreePeriod) {
                            toast("Free Period Detected! Tasks generated.", { icon: '🤖' });
                            setIsFreePeriod(true);
                        } else if (!isNowFree) {
                            setIsFreePeriod(false);
                        }
                    } else {
                        // No slot right now (e.g. after college hours)
                        setCurrentSlot({ type: 'Free', subject: 'No active class', startTime: '00:00', endTime: '00:00' });
                    }
                } else {
                    console.log("Timetable document not found:", docId);
                    setCurrentSlot({ type: 'Free', subject: 'No Schedule Set', startTime: '00:00', endTime: '00:00' });
                }
            } catch (error) {
                console.error("Timetable Error:", error);
                setCurrentSlot({ type: 'Free', subject: 'Error Loading', startTime: '00:00', endTime: '00:00' });
            }
        };

        fetchSchedule();
        const interval = setInterval(fetchSchedule, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [user, isFreePeriod]);
    // ✅ NEW: FETCH ASSIGNMENTS (For Task Badge)
    useEffect(() => {
        if (!user?.instituteId) return;

        // ✅ OPTIMIZED: Added department filter to save reads
        const q = query(
            collection(db, 'assignments'),
            where('instituteId', '==', user.instituteId),
            where('department', '==', user.department), // <-- ADD THIS
            where('academicYear', '==', user.academicYear || '2025-2026')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const relevantTasks = allTasks.filter(task => {
                // Helper to normalize strings
                const norm = (str) => str ? str.toString().trim().toLowerCase() : '';

                const userDept = norm(user.department);
                const taskDept = norm(task.department);
                const userYear = norm(user.year);
                const taskYear = norm(task.targetYear);

                // 1. Department Check
                if (taskDept !== userDept) return false;

                // 2. Year Check
                const isYearMatch = taskYear === 'all' || taskYear === userYear;
                if (!isYearMatch) return false;

                // 3. Division Check (If task is for specific division)
                if (task.division && task.division !== 'All') {
                    const userDiv = norm(user.division || user.div);
                    const taskDiv = norm(task.division);
                    if (!userDiv || userDiv !== taskDiv) return false;
                }

                return true;
            });

            // Sort newest first so the count is accurate based on time
            relevantTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setAssignments(relevantTasks);
        });

        return () => unsub();
    }, [user?.instituteId, user?.department, user?.year, user?.division]);

    // ✅ UPDATE: Auto-hide badges when tab is viewed
    useEffect(() => {
        // Hide Notice Badge
        if (activePage === 'notices' && notices.length > readCount) {
            setReadCount(notices.length);
            localStorage.setItem('seenNoticesCount', notices.length.toString());
        }

        // Hide Task Badge
        if (activePage === 'tasks' && assignments.length > taskReadCount) {
            setTaskReadCount(assignments.length);
            localStorage.setItem('seenTasksCount', assignments.length.toString());
        }
    }, [activePage, notices, assignments, readCount, taskReadCount]);
// ✅ OPTIMIZED: FETCH NOTICES ONCE (Saves thousands of reads)
    useEffect(() => {
        if (!user?.instituteId) return;

        const fetchNotices = async () => {
            const q = query(
                collection(db, 'announcements'),
                where('instituteId', '==', user.instituteId)
            );
            
            const snapshot = await getDocs(q); // 🛑 CHANGED FROM onSnapshot to getDocs
            const allNotices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const relevantNotices = allNotices.filter(n => {
                const noticeDept = n.department ? n.department.trim().toLowerCase() : '';
                const userDeptNorm = user.department ? user.department.trim().toLowerCase() : '';
                const userYearNorm = user.year ? user.year.trim().toLowerCase() : '';
                
                const isNoticeFE = noticeDept === 'fe' || noticeDept === 'first year' || noticeDept === 'firstyear';
                const isUserFE = userYearNorm === 'fe' || userYearNorm === 'first year' || userDeptNorm === 'fe' || userDeptNorm === 'first year';
                const isNonEngg = userDeptNorm === 'common' || (user.enrolledDepartments && user.enrolledDepartments.length > 0);

                // 1. Department Check
                if (isUserFE && isNoticeFE) {
                    // Match!
                } else if (isNonEngg) {
                    const myDepts = user.enrolledDepartments ? user.enrolledDepartments.map(d => d.trim().toLowerCase()) : [];
                    if (userDeptNorm && !myDepts.includes(userDeptNorm)) myDepts.push(userDeptNorm);
                    
                    if (!myDepts.includes(noticeDept) && noticeDept !== 'general' && noticeDept !== 'common') {
                        return false; 
                    }
                } else if (userDeptNorm !== noticeDept && noticeDept !== 'general') {
                    return false; 
                }

                // 2. Year Check 
                if (n.targetYear === 'Teachers') return false;
                
                if (n.targetYear !== 'All' && n.targetYear !== user.year) {
                    if (!(isUserFE && n.targetYear === 'FE')) {
                         return false; 
                    }
                }

                // 3. Division Check
                if (n.division && n.division !== 'All') {
                    const myDiv = user.division || user.div;
                    if (n.division !== myDiv) return false;
                }

                return true;
            });

            relevantNotices.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setNotices(relevantNotices);
        };
        fetchNotices();
    }, [user]);

    // ✅ 7. PUSH NOTIFICATION SETUP (Get Token & Save to DB)
    useEffect(() => {
        const registerPushNotifications = async () => {
            // Only run on Android/iOS (Native Devices)
            if (Capacitor.isNativePlatform()) {

                // 1. Request Permission
                let permStatus = await PushNotifications.checkPermissions();
                if (permStatus.receive === 'prompt') {
                    permStatus = await PushNotifications.requestPermissions();
                }

                if (permStatus.receive !== 'granted') {
                    console.error('User denied permissions!');
                    return;
                }

                // 2. Register with FCM
                await PushNotifications.register();

                // 3. Listen for the Token (The "Address" of this phone)
                PushNotifications.addListener('registration', async (token) => {
                    console.log('Push Token:', token.value);

                    // 4. Save Token to Firestore (So Backend can find it)
                    if (user?.uid) {
                        const userRef = doc(db, 'users', user.uid);
                        // We use merge to avoid overwriting other data
                        await updateDoc(userRef, { fcmToken: token.value });
                    }
                });

                // 4. Handle Errors
                PushNotifications.addListener('registrationError', (error) => {
                    console.error('Error on registration: ' + JSON.stringify(error));
                });

                // 5. Handle Incoming Notification (While App is Open)
                PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    toast(notification.title + ": " + notification.body, {
                        icon: '🔔',
                        duration: 5000,
                        style: { background: '#3b82f6', color: '#fff' }
                    });
                });

                // 6. Handle Notification Tap (When user clicks the notification)
                PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                    // Navigate to dashboard or specific page
                    setActivePage('dashboard');
                });
            }
        };

        if (user?.uid) {
            registerPushNotifications();
        }

        // Cleanup listeners on unmount
        return () => {
            if (Capacitor.isNativePlatform()) {
                PushNotifications.removeAllListeners();
            }
        };
    }, [user]);

    const badgeCount = Math.max(0, notices.length - readCount);
    const taskBadgeCount = Math.max(0, assignments.length - taskReadCount);
    const handleLogout = async () => { await signOut(auth); };

    const handleOpenAiWithPrompt = (prompt) => {
        setChatInitialMessage(prompt);
        setIsChatOpen(true);
    };

    // ✅ 5. HANDLE QR ATTENDANCE
    const onScanSuccess = async (decodedText) => {
        // 1. Pause Camera
        if (scannerRef.current) {
            scannerRef.current.pause(true);
        }
        setShowScanner(false);

        const toastId = toast.loading("Verifying Location...");

        try {
            // A. Get Security Data (Parallel)
            const deviceIdPromise = getUniqueDeviceId();
            const tokenPromise = auth.currentUser.getIdToken();
            const locationPromise = getLocation(); // Uses new robust function

            const [currentDeviceId, token, position] = await Promise.all([
                deviceIdPromise,
                tokenPromise,
                locationPromise
            ]);

            // B. Send to Backend
            const response = await fetch(`${BACKEND_URL}/markAttendance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sessionId: decodedText,
                    studentLocation: {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    },
                    deviceId: currentDeviceId,
                    verificationMethod: 'qr'
                })
            });

            const data = await response.json();

            // C. Handle Response
            if (response.ok) {
                toast.success(data.message, { id: toastId, duration: 4000 });
            } else {
                // 🚨 HERE IS THE FIX: Show the exact error from backend (which contains the distance)
                toast.error(data.error || "Attendance Failed", { id: toastId, duration: 5000 });
            }

        } catch (error) {
            console.error("Attendance Error:", error);

            // Frontend-side errors (GPS, etc)
            if (error.message.includes("GPS is OFF")) {
                toast.error("📍 GPS is OFF! Turn it on in settings.", { id: toastId, duration: 5000 });
            }
            else if (error.message.includes("Timeout")) {
                toast.error("📡 GPS Signal Weak. Try moving near a window.", { id: toastId });
            }
            else {
                toast.error("❌ " + (error.message || "Verification Failed"), { id: toastId });
            }
        }
    };
    // ✅ REPLACED: Updated PIN Handler (6-Digit Version)
    const handlePinSubmit = async () => {
        // ✅ CHANGED: Check for 6 digits
        if (enteredPin.length !== 6) return toast.error("Enter a valid 6-digit PIN");

        setLoading(true);
        const toastId = toast.loading("Verifying Code...");

        try {
            // 1. Find the session that has this active PIN
            // Remove 'isActive' from the query to make it simpler
            const q = query(
                collection(db, 'live_sessions'),
                where('instituteId', '==', user.instituteId),
                where('currentPin', '==', enteredPin)
            );

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast.error("Invalid PIN", { id: toastId });
                setLoading(false);
                return;
            }

            // Check 'isActive' manually in Javascript instead
            const sessionDoc = querySnapshot.docs[0];
            const sessionData = sessionDoc.data();

            if (!sessionData.isActive) {
                toast.error("Session has ended", { id: toastId });
                setLoading(false);
                return;
            }

            const targetSessionId = sessionDoc.id;

            // 3. Close Modal & Call Secure Function
            setShowPinModal(false);
            setEnteredPin('');
            toast.success("Code Verified! Checking Device...", { id: toastId });

            // 🔥 REUSE SECURITY LOGIC
            await onScanSuccess(targetSessionId);

        } catch (error) {
            console.error("Verification Error:", error);
            toast.error("Verification Failed", { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    // ✅ 6. HANDLE BIOMETRIC ATTENDANCE
    const handleBiometricAttendance = async () => {
        if (!liveSession) return;

        // A. Verify Identity via Fingerprint
        const isVerified = await authenticate(user.uid);
        if (!isVerified) return;

        const toastId = toast.loading("Marking Attendance...");

        // ✅ ADD THIS: Get Device ID for biometric flow too
        const currentDeviceId = await getUniqueDeviceId();

        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const token = await auth.currentUser.getIdToken();
                const response = await fetch(`${BACKEND_URL}/markAttendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        sessionId: liveSession.id,
                        studentLocation: {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        },
                        deviceId: currentDeviceId, // ✅ MUST send deviceId here too
                        verificationMethod: 'biometric'
                    })
                });

                const data = await response.json();
                if (response.ok) toast.success(data.message, { id: toastId });
                else toast.error(data.error, { id: toastId });

            } catch (error) {
                toast.error(error.message, { id: toastId });
            }
        }, () => toast.error("Location Required", { id: toastId }));
    };

    // ✅ UPGRADED: ULTRA HD Camera - Direct MediaStream Approach for Browser
    // ✅ WEB SCANNER LOGIC (Simple Start -> HD Upgrade -> Zoom)
    // ✅ UPDATED CAMERA LOGIC (Always Enable Zoom)
    useEffect(() => {
        let html5QrCode;
        if (showScanner) {
            html5QrCode = new Html5Qrcode("reader");
            scannerRef.current = html5QrCode;

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };

            html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
                .then(() => {
                    // 🔍 Check Hardware Zoom Support
                    try {
                        const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
                        if (capabilities && capabilities.zoom) {
                            // Hardware Zoom Supported!
                            setZoomCap(capabilities.zoom);
                            setZoom(capabilities.zoom.min || 1);
                        } else {
                            // Hardware Zoom NOT Supported -> Use CSS Zoom Default
                            console.log("Hardware zoom not supported. Switching to Digital Zoom.");
                            setZoomCap(null);
                            setZoom(1);
                        }
                    } catch (e) {
                        console.log("Zoom check failed, using Digital Zoom", e);
                        setZoomCap(null);
                    }
                })
                .catch(err => {
                    console.error(err);
                    // Don't show error immediately to avoid spam, just close if critical
                    if (showScanner) setShowScanner(false);
                });
        }

        return () => {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
            }
        };
    }, [showScanner]);



    const renderContent = () => {
        if (!user) return <div style={{ textAlign: 'center', paddingTop: 50 }}>Loading...</div>;
        switch (activePage) {
            case 'dashboard': return <DashboardHome
                user={user}
                currentSlot={currentSlot}
                onOpenAI={() => setIsChatOpen(true)}
                liveSession={liveSession}
                setLiveSession={setLiveSession}
                recentAttendance={recentAttendance}
                setRecentAttendance={setRecentAttendance}
                setShowScanner={setShowScanner}
                // ✅ PASS BIOMETRIC PROPS
                onBiometricAttendance={handleBiometricAttendance}
                bioLoading={bioLoading}
                openNativeCameraForQR={openNativeCameraForQR}
                setShowPinModal={setShowPinModal}
                setShowFaceScanner={setShowFaceScanner}
                setShowFaceSetup={setShowFaceSetup}
                handleFaceAttendance={handleFaceAttendance}
            />;
            case 'tasks': return <FreePeriodTasks user={user} isFreePeriod={isFreePeriod} onOpenAIWithPrompt={handleOpenAiWithPrompt} />;
            case 'profile': return <Profile user={user} />;
            case 'plans': return <CareerRoadmap user={user} />;
            case 'leaderboard': return <Leaderboard user={user} />;
            case 'leave': return <LeaveRequestForm user={user} />;
            case 'notices': return <NoticesView notices={notices} />;
            case 'feedback': return <FeedbackView user={user} />;
            case 'security': return <FaceIdManager user={user} />;
            default: return <DashboardHome
                user={user}
                currentSlot={currentSlot}
                onOpenAI={() => setIsChatOpen(true)}
                liveSession={liveSession}
                setLiveSession={setLiveSession}
                recentAttendance={recentAttendance}
                setRecentAttendance={setRecentAttendance}
                setShowScanner={setShowScanner}
                onBiometricAttendance={handleBiometricAttendance}
                bioLoading={bioLoading}
                openNativeCameraForQR={openNativeCameraForQR}
                setShowPinModal={setShowPinModal}
                setShowFaceScanner={setShowFaceScanner}
                handleFaceAttendance={handleFaceAttendance}
            />;
        }
    };

    return (
        <div className="dashboard-container">



            {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)} />}

            {/* ✅ REVERTED TO FAST CSS SIDEBAR */}
            {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)} />}

            <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`}>
                <div className="logo-container">
                    <img src={logo} alt="trackee" className="sidebar-logo" />
                    <span className="logo-text">trackee</span>
                </div>
                {user && (
                    <div className="teacher-info" onClick={() => { setActivePage('profile'); setIsMobileNavOpen(false); }} style={{ cursor: 'pointer' }}>
                        <h4>{user.firstName} {user.lastName}</h4>
                        <p>Roll No: {user.rollNo}</p>
                        <p style={{ fontSize: '14px', color: '#059669', fontWeight: '700', margin: '4px 0' }}>{user.xp || 0} Credits</p>
                    </div>
                )}
                <ul className="menu">
                    <li className={activePage === 'dashboard' ? 'active' : ''} onClick={() => { setActivePage('dashboard'); setIsMobileNavOpen(false); }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '15px' }}>
                            <i className="fas fa-home" style={{ width: '24px', textAlign: 'center' }}></i>
                            <span>Dashboard</span>
                        </div>
                    </li>
                    {/* ✅ UPDATED: Notice Board with Badge */}
                    <li className={activePage === 'notices' ? 'active' : ''} onClick={() => { setActivePage('notices'); setIsMobileNavOpen(false); }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '15px' }}>
                            <i className="fas fa-bullhorn" style={{ width: '24px', textAlign: 'center' }}></i>
                            <span>Notice Board</span>
                            {/* Show Red Badge if unread notices exist */}
                            {badgeCount > 0 && (
                                <span className="nav-badge" style={{ background: '#ef4444', color: 'white', fontSize: '10px', padding: '2px 8px', borderRadius: '12px', marginLeft: 'auto', fontWeight: 'bold' }}>
                                    {badgeCount}
                                </span>
                            )}
                        </div>
                    </li>
                    {/* ✅ UPDATED: Tasks with Badge */}
                    <li className={activePage === 'tasks' ? 'active' : ''} onClick={() => { setActivePage('tasks'); setIsMobileNavOpen(false); }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '15px' }}>
                            <i className="fas fa-check-circle" style={{ width: '24px', textAlign: 'center' }}></i>
                            <span>Free Period Tasks</span>

                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px' }}>
                                {/* Show Red Badge for New Tasks */}
                                {taskBadgeCount > 0 && (
                                    <span className="nav-badge" style={{ background: '#ef4444', color: 'white', fontSize: '10px', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                                        {taskBadgeCount}
                                    </span>
                                )}
                                {/* Show Live Badge if Free Period */}
                                {isFreePeriod && (
                                    <span className="nav-badge pulsate" style={{ background: '#10b981', color: 'white', fontSize: '10px', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                                        LIVE
                                    </span>
                                )}
                            </div>
                        </div>
                    </li>
                    <li className={activePage === 'leaderboard' ? 'active' : ''} onClick={() => { setActivePage('leaderboard'); setIsMobileNavOpen(false); }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '15px' }}>
                            <i className="fas fa-trophy" style={{ width: '24px', textAlign: 'center' }}></i>
                            <span>Leaderboard</span>
                        </div>
                    </li>
                    <li className={activePage === 'plans' ? 'active' : ''} onClick={() => { setActivePage('plans'); setIsMobileNavOpen(false); }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '15px' }}>
                            <i className="fas fa-paper-plane" style={{ width: '24px', textAlign: 'center' }}></i>
                            <span>Future Plans</span>
                        </div>
                    </li>
                    <li className={activePage === 'leave' ? 'active' : ''} onClick={() => { setActivePage('leave'); setIsMobileNavOpen(false); }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '15px' }}>
                            <i className="fas fa-calendar-minus" style={{ width: '24px', textAlign: 'center' }}></i>
                            <span>Apply Leave</span>
                        </div>
                    </li>
                    <li className={activePage === 'profile' ? 'active' : ''} onClick={() => { setActivePage('profile'); setIsMobileNavOpen(false); }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '15px' }}>
                            <i className="fas fa-user" style={{ width: '24px', textAlign: 'center' }}></i>
                            <span>Profile</span>
                        </div>
                    </li>
                    <li className={activePage === 'feedback' ? 'active' : ''} onClick={() => { setActivePage('feedback'); setIsMobileNavOpen(false); }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '15px' }}>
                            <i className="fas fa-comment-dots" style={{ width: '24px', textAlign: 'center' }}></i>
                            <span>Teacher Feedback</span>
                        </div>
                    </li>
                    <li className={activePage === 'security' ? 'active' : ''} onClick={() => { setActivePage('security'); setIsMobileNavOpen(false); }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '15px' }}>
                            <i className="fas fa-user-shield" style={{ width: '24px', textAlign: 'center' }}></i>
                            <span>Face ID Reset</span>
                        </div>
                    </li>
                </ul>
                <div className="sidebar-footer"><button onClick={handleLogout} className="logout-btn"><i className="fas fa-sign-out-alt"></i> <span>Logout</span></button>{/* ✅ ADD THIS CREDIT */}
                    <div style={{
                        marginTop: '15px',
                        fontSize: '10px',
                        color: 'rgba(0, 0, 0, 0.4)',
                        textAlign: 'center',
                        letterSpacing: '0.5px'
                    }}>
                        Built with ❤️ by Sushant
                    </div></div>
            </aside>

            <main className="main-content">
                <header className="mobile-header">
                    <button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}><i className="fas fa-bars"></i></button>
                    <div className="mobile-brand"><img src={logo} alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">trackee</span></div>
                    <div style={{ width: '40px' }}></div>
                </header>

                {renderContent()}

                {/* ✅ WEB SCANNER UI (Previous Style with Zoom) */}
                {showScanner && ReactDOM.createPortal(
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 999999,
                        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
                    }}>
                        {/* 🛑 CSS FIX: Forces the video to show up */}
                        <style>{`
                            #reader video {
                                width: 100% !important;
                                height: 100% !important;
                                object-fit: cover !important;
                                border-radius: 16px;
                            }
                        `}</style>

                        {/* Scanner Frame */}
                        <div style={{ position: 'relative', width: '300px', height: '300px', borderRadius: '20px', overflow: 'hidden', border: '2px solid #3b82f6', boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)' }}>
                            <div id="reader" style={{ width: '100%', height: '100%' }}></div>

                            {/* Scanning Animation Line */}
                            <div style={{
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '2px', background: '#3b82f6',
                                boxShadow: '0 0 4px #3b82f6', animation: 'scan 2s infinite'
                            }}>
                                <style>{`@keyframes scan { 0% { top: 0 } 50% { top: 100% } 100% { top: 0 } }`}</style>
                            </div>
                        </div>

                        <p style={{ color: 'white', marginTop: '20px', fontWeight: '500' }}>Align QR Code within the frame</p>

                        {/* ✅ ZOOM SLIDER (Always Visible) */}
                        <div style={{ width: '80%', maxWidth: '300px', marginTop: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>1x</span>
                            <input
                                type="range"
                                // If hardware zoom exists, use its limits. Otherwise default to 1x - 3x for CSS.
                                min={zoomCap ? zoomCap.min : 1}
                                max={zoomCap ? zoomCap.max : 3}
                                step={zoomCap ? zoomCap.step : 0.1}
                                value={zoom}
                                onChange={handleZoomChange}
                                style={{ flex: 1, accentColor: '#3b82f6', cursor: 'pointer', height: '6px' }}
                            />
                            <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>
                                {zoomCap ? 'Max' : '3x'}
                            </span>
                        </div>

                        <button
                            onClick={() => setShowScanner(false)}
                            style={{
                                marginTop: '30px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
                                color: 'white', padding: '10px 30px', borderRadius: '30px', fontWeight: '600', backdropFilter: 'blur(5px)', cursor: 'pointer'
                            }}
                        >
                            Cancel Scan
                        </button>
                    </div>,
                    document.body
                )}
                <ManualAttendanceModal
                    isOpen={showPinModal}          // Matches: const [showPinModal, setShowPinModal]
                    onClose={() => setShowPinModal(false)}
                    pinValue={enteredPin}          // Matches: const [enteredPin, setEnteredPin]
                    setPinValue={setEnteredPin}    // Matches: setEnteredPin
                    onSubmit={handlePinSubmit}     // Matches: const handlePinSubmit
                    loading={loading}              // Matches: const [loading, setLoading]
                />

                <MobileFooter
                    activePage={activePage}
                    setActivePage={setActivePage}
                    badgeCount={badgeCount}
                    taskBadgeCount={taskBadgeCount} // ✅ Pass the new count
                    liveSession={liveSession}
                    onScan={openNativeCameraForQR}
                    onChat={() => setIsChatOpen(true)}
                />
            </main>

            {user && (
                <AiChatbot
                    user={user}
                    isOpenProp={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                    initialMessage={chatInitialMessage}
                />
            )}

            {/* Hidden QR Reader for image decoding */}
            <div id="qr-reader-temp" style={{ display: 'none' }}></div>
            {/* 📸 MANDATORY FACE SETUP MODAL */}
            {showFaceSetup && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.95)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: 'white', padding: '40px 30px', borderRadius: '24px', textAlign: 'center', maxWidth: '400px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ background: '#fce7f3', color: '#db2777', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', fontSize: '24px' }}>
                            <i className="fas fa-user-shield"></i>
                        </div>
                        <h2 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>Mandatory Security Update</h2>
                        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>To prevent proxy attendance, you must register your face. This is a one-time setup and takes 5 seconds.</p>

                        <div style={{ width: '100%', height: '250px', background: '#e2e8f0', borderRadius: '16px', margin: '20px 0', overflow: 'hidden', border: '4px solid #f8fafc' }}>
                            <video ref={videoSetupRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                        </div>

                        <button
                            onClick={handleFaceRegistration}
                            disabled={isScanningSetup}
                            style={{ background: isScanningSetup ? '#94a3b8' : '#db2777', color: 'white', padding: '16px', width: '100%', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: isScanningSetup ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
                            {isScanningSetup ? "Scanning..." : "Start Face Scan"}
                        </button>
                    </div>
                </div>
            )}
            {/* 📸 DAILY SECURE FACE ATTENDANCE MODAL */}
            {showFaceScanner && ReactDOM.createPortal(
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 999999,
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)'
                }}>
                    <h2 style={{ color: 'white', marginBottom: '30px', fontWeight: '800' }}>Secure Face Check</h2>

                    <div style={{ position: 'relative', width: '280px', height: '280px', borderRadius: '50%', overflow: 'hidden', border: '5px solid #10b981', boxShadow: '0 0 40px rgba(16, 185, 129, 0.4)' }}>
                        <video ref={faceVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />

                        {/* Cool Scanning Laser Effect */}
                        {isScanningFace && (
                            <div style={{
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: '#10b981',
                                boxShadow: '0 0 15px 5px rgba(16, 185, 129, 0.6)', animation: 'scanFace 2s infinite linear'
                            }}>
                                <style>{`@keyframes scanFace { 0% { top: -10% } 50% { top: 110% } 100% { top: -10% } }`}</style>
                            </div>
                        )}
                    </div>

                    {/* 🔥 NEW: Dynamic Liveness Instructions */}
                    <div style={{ background: 'rgba(0,0,0,0.6)', padding: '10px 25px', borderRadius: '20px', marginTop: '25px', backdropFilter: 'blur(5px)' }}>
                        <p style={{ color: '#10b981', margin: 0, fontSize: '18px', fontWeight: '800', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            {livenessPrompt || "Starting camera..."}
                        </p>
                    </div>

                    <p style={{ color: '#94a3b8', marginTop: '25px', fontSize: '16px', fontWeight: '500' }}>
                        {isScanningFace ? "Hold still, analyzing..." : "Starting camera..."}
                    </p>

                    <button
                        onClick={() => {
                            setShowFaceScanner(false);
                            setIsScanningFace(false);
                            if (faceVideoRef.current && faceVideoRef.current.srcObject) {
                                faceVideoRef.current.srcObject.getTracks().forEach(t => t.stop());
                            }
                        }}
                        style={{
                            marginTop: '40px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white', padding: '14px 40px', borderRadius: '30px', fontWeight: '700', fontSize: '16px', backdropFilter: 'blur(5px)', cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
}