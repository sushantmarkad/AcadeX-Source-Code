import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import toast, { Toaster } from 'react-hot-toast';
import './Dashboard.css';
import logo from "../assets/logo.png";
import TwoFactorSetup from '../components/TwoFactorSetup';

import AddHOD from './AddHOD';
import AddDepartment from './AddDepartment';
import ManageInstituteUsers from './ManageInstituteUsers';
import BulkAddStudents from './BulkAddStudents'; 

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// --- REUSABLE INPUT COMPONENT ---
const ProfInput = ({ label, value, onChange, disabled, type = "text", placeholder, lockIcon }) => (
    <div className="prof-input-group">
        <label className="prof-label">
            {label}
            {lockIcon && <i className="fas fa-lock" style={{ fontSize: '10px', color: '#94a3b8' }}></i>}
        </label>
        <input
            type={type}
            className="prof-input"
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
        />
    </div>
);

const DashboardHome = ({ instituteName, instituteId }) => {
    const [code, setCode] = useState(null);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({});
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        const fetchCode = async () => {
            if (!instituteId) return;
            try {
                const docRef = doc(db, "institutes", instituteId);
                const snap = await getDoc(docRef);
                if (snap.exists() && snap.data().code) setCode(snap.data().code);
            } catch (err) { console.error(err); }
        };
        fetchCode();
    }, [instituteId]);

    useEffect(() => {
        if (!instituteId) return;
        const q = query(collection(db, 'users'), where('instituteId', '==', instituteId));
        const unsub = onSnapshot(q, (snap) => {
            const tempStats = {};
            snap.docs.forEach(doc => {
                const data = doc.data();
                const dept = data.department || 'General';
                if (!tempStats[dept]) tempStats[dept] = { students: 0, teachers: 0 };
                if (data.role === 'student') tempStats[dept].students++;
                if (data.role === 'teacher') tempStats[dept].teachers++;
            });
            setStats(tempStats);
            setStatsLoading(false);
        });
        return () => unsub();
    }, [instituteId]);

    const generateCode = async () => {
        if (!instituteId) return toast.error("Institute ID missing.");
        setLoading(true);
        const prefix = instituteName ? instituteName.substring(0, 3).toUpperCase() : "INS";
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const newCode = `${prefix}-${randomNum}`;
        try {
            await setDoc(doc(db, "institutes", instituteId), { code: newCode, instituteName, instituteId }, { merge: true });
            setCode(newCode);
            toast.success(`New Code: ${newCode}`);
        } catch (err) { toast.error("Failed."); } 
        finally { setLoading(false); }
    };

    return (
        <div className="content-section">
            <div style={{ marginBottom: '30px' }}>
                <h2 className="content-title">Welcome, Admin!</h2>
                <p className="content-subtitle">Overview of {instituteName || 'your institute'}.</p>
            </div>

            {/* CODE CARD */}
            <div className="card" style={{ background: 'linear-gradient(120deg, #2563eb 0%, #1d4ed8 100%)', border: 'none', marginBottom: '40px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                        <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '8px', borderRadius: '8px', color: 'white' }}>
                            <i className="fas fa-key"></i>
                        </div>
                        <h3 style={{ margin: 0, fontSize: '18px', color: 'white' }}>Institute Code</h3>
                    </div>
                    <p style={{ margin: '0 0 20px 0', opacity: 0.9, fontSize: '14px', color: 'white' }}>
                        Share this code with students for registration.
                    </p>
                    {code ? (
                        <div style={{ background: 'white', color: '#1e40af', padding: '12px 24px', borderRadius: '10px', fontSize: '24px', fontWeight: '800', display: 'inline-block', letterSpacing: '2px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                            {code}
                        </div>
                    ) : (
                        <button onClick={generateCode} style={{ background: 'white', color: '#2563eb', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                            {loading ? "Generating..." : "Generate Code"}
                        </button>
                    )}
                </div>
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '150px', height: '150px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
                <div style={{ position: 'absolute', bottom: '-40px', right: '50px', width: '100px', height: '100px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}></div>
            </div>

            {/* DEPARTMENT CARDS */}
            <h3 style={{ marginBottom: '20px', color: '#334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-chart-pie" style={{ color: '#64748b' }}></i> Department Statistics
            </h3>
            
            {statsLoading ? <p>Loading stats...</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {Object.keys(stats).sort().map((dept, index) => (
                        <div key={dept} style={{ 
                            background: 'white', borderRadius: '16px', padding: '20px',
                            border: '1px solid #f1f5f9',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            borderTop: `4px solid ${['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][index % 4]}`
                        }}>
                            <h4 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#1e293b' }}>{dept}</h4>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fas fa-user-graduate" style={{ fontSize: '12px' }}></i></div>
                                    <span style={{ color: '#64748b', fontSize: '13px' }}>Students</span>
                                </div>
                                <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '16px' }}>{stats[dept].students}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fas fa-chalkboard-teacher" style={{ fontSize: '12px' }}></i></div>
                                    <span style={{ color: '#64748b', fontSize: '13px' }}>Teachers</span>
                                </div>
                                <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '16px' }}>{stats[dept].teachers}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function InstituteAdminDashboard() {
    const [adminInfo, setAdminInfo] = useState(null);
    const [activePage, setActivePage] = useState('dashboard');
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });

    // --- PROFILE STATE ---
    const [profileTab, setProfileTab] = useState('details');
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ firstName: '', lastName: '', phone: '' });
    const [passData, setPassData] = useState({ newPass: '', confirmPass: '' });
    const [passLoading, setPassLoading] = useState(false);
    
    // --- BULK PROMOTE STATE ---
    const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
    const [newTargetYear, setNewTargetYear] = useState('2026-2027');
    const [isPromoting, setIsPromoting] = useState(false);
    const [classToPromote, setClassToPromote] = useState('ALL');

    const navigate = useNavigate();

    useEffect(() => {
        const fetchAdminData = async () => {
            if (auth.currentUser) {
                try {
                    // Real-time listener for profile updates
                    const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            setAdminInfo(data);
                            if (!isEditing) {
                                setFormData({
                                    firstName: data.firstName || '',
                                    lastName: data.lastName || '',
                                    phone: data.phone || ''
                                });
                            }
                        }
                    });
                    return () => unsub();
                } catch (e) {
                    console.error("Error fetching admin data:", e);
                }
            } else {
                navigate('/'); 
            }
        };
        fetchAdminData();
    }, [navigate, isEditing]);

    const handleLogout = async () => { await signOut(auth); navigate('/'); };

    const showModal = (title, message, type = 'info', onConfirm = null) => {
        setModal({ isOpen: true, title, message, type, onConfirm });
    };
    const closeModal = () => setModal({ ...modal, isOpen: false });

    // --- PROFILE ACTIONS ---
    const handleSaveProfile = async () => {
        const toastId = toast.loading("Saving changes...");
        try {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone
            });
            toast.success("Profile Updated!", { id: toastId });
            setIsEditing(false);
        } catch (err) {
            toast.error(err.message, { id: toastId });
        }
    };

    // --- COMPONENT: Admin Face ID Requests & Stats View ---
const FaceRequestsManager = ({ user }) => {
    const [requests, setRequests] = useState([]);
    const [registrationStats, setRegistrationStats] = useState({ total: 0, registered: 0, pending: 0, percentage: 0 });

    useEffect(() => {
        if (!user?.instituteId) return;
        
        // Try a simpler query first to verify data is reaching Firestore
        const q = query(
            collection(db, 'face_update_requests'), 
            where('instituteId', '==', user.instituteId)
        );
        
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Admin received requests:", data); // Check your browser console!
            setRequests(data);
        }, (err) => {
            console.error("Firestore Listen Error:", err);
        });
        return () => unsub();
    }, [user]);

    // 2. Fetch Global Face Registration Stats
    useEffect(() => {
        if (!user?.instituteId) return;
        
        // Query ALL students in this institute
        const q = query(
            collection(db, 'users'),
            where('instituteId', '==', user.instituteId),
            where('role', '==', 'student')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            let totalCount = 0;
            let registeredCount = 0;

            snapshot.docs.forEach(doc => {
                totalCount++;
                const studentData = doc.data();
                // Check if the 128-number math array exists
                if (studentData.registeredFace && Array.isArray(studentData.registeredFace) && studentData.registeredFace.length === 128) {
                    registeredCount++;
                }
            });

            setRegistrationStats({
                total: totalCount,
                registered: registeredCount,
                pending: totalCount - registeredCount,
                percentage: totalCount === 0 ? 0 : Math.round((registeredCount / totalCount) * 100)
            });
        });

        return () => unsub();
    }, [user]);

    const handleAction = async (requestId, studentId, action) => {
        const toastId = toast.loading(`Marking as ${action}...`);
        try {
            const token = await auth.currentUser.getIdToken();
            const res = await fetch(`${BACKEND_URL}/handleFaceUpdate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ requestId, studentId, action })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success(data.message, { id: toastId });
        } catch (err) {
            toast.error(err.message, { id: toastId });
        }
    };

    return (
        <div className="admin-content">
            <h2 className="admin-page-title">Face ID Management</h2>
            <p style={{ color: '#64748b', marginBottom: '20px' }}>Monitor rollout progress and manage reset requests.</p>

            {/* --- NEW: REAL-TIME STATS TRACKER --- */}
            <div className="admin-card" style={{ padding: '25px', marginBottom: '30px', background: 'linear-gradient(to right, #ffffff, #f8fafc)' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fas fa-chart-pie" style={{ color: '#3b82f6' }}></i> Rollout Progress
                </h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
                    <div>
                        <span style={{ fontSize: '32px', fontWeight: '800', color: '#1e293b' }}>{registrationStats.registered}</span>
                        <span style={{ fontSize: '16px', color: '#64748b', fontWeight: '600' }}> / {registrationStats.total} Students</span>
                    </div>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: registrationStats.percentage === 100 ? '#10b981' : '#3b82f6' }}>
                        {registrationStats.percentage}%
                    </span>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ 
                        width: `${registrationStats.percentage}%`, 
                        height: '100%', 
                        background: registrationStats.percentage === 100 ? '#10b981' : '#3b82f6',
                        transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}></div>
                </div>

                <div style={{ display: 'flex', gap: '20px', marginTop: '15px', fontSize: '14px' }}>
                    <span style={{ color: '#10b981', fontWeight: '600' }}><i className="fas fa-check-circle"></i> {registrationStats.registered} Secured</span>
                    <span style={{ color: '#f59e0b', fontWeight: '600' }}><i className="fas fa-clock"></i> {registrationStats.pending} Pending Setup</span>
                </div>
            </div>

            {/* --- EXISTING: PENDING REQUESTS --- */}
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#1e293b' }}>Pending Reset Requests</h3>
            <div className="cards-grid">
                {requests.map(req => (
                    <div key={req.id} className="admin-card" style={{ padding: '20px', borderLeft: '5px solid #db2777' }}>
                        <h3 style={{ margin: '0 0 5px 0' }}>{req.studentName}</h3>
                        <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#64748b' }}>Roll No: {req.rollNo} | {req.department}</p>
                        
                        <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #fee2e2' }}>
                            <strong style={{ fontSize: '12px', color: '#ef4444' }}>Reason Provided:</strong>
                            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#7f1d1d' }}>"{req.reason}"</p>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                                onClick={() => handleAction(req.id, req.studentId, 'approved')}
                                style={{ flex: 1, padding: '10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}>
                                Approve Reset
                            </button>
                            <button 
                                onClick={() => handleAction(req.id, req.studentId, 'rejected')}
                                style={{ flex: 1, padding: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}>
                                Reject
                            </button>
                        </div>
                    </div>
                ))}
                {requests.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                        <i className="fas fa-check-double" style={{ fontSize: '24px', color: '#94a3b8', marginBottom: '10px' }}></i>
                        <p style={{ margin: 0, color: '#64748b', fontWeight: '500' }}>No pending face reset requests.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (passData.newPass.length < 6) return toast.error("Password too short (min 6 chars)");
        if (passData.newPass !== passData.confirmPass) return toast.error("Passwords do not match");

        setPassLoading(true);
        const toastId = toast.loading("Updating Password...");
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch(`${BACKEND_URL}/updatePassword`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ newPassword: passData.newPass })
            });

            if (response.ok) {
                toast.success("Password Updated!", { id: toastId });
                setPassData({ newPass: '', confirmPass: '' });
            } else {
                throw new Error("Update failed");
            }
        } catch (err) {
            toast.error(err.message, { id: toastId });
        } finally {
            setPassLoading(false);
        }
    };

    const handleBulkPromote = async () => {
        if (!newTargetYear.match(/^\d{4}-\d{4}$/)) {
            return toast.error("Please format year as YYYY-YYYY (e.g., 2026-2027)");
        }

        setIsPromoting(true);
        const toastId = toast.loading(`Promoting ${classToPromote === 'ALL' ? 'All' : classToPromote} students... Please wait.`);

        try {
            const response = await fetch(`${BACKEND_URL}/bulkPromoteStudents`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instituteId: adminInfo.instituteId, 
                    newAcademicYear: newTargetYear,
                    targetClass: classToPromote // PASSING THE SPECIFIC CLASS
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                toast.success(data.message, { id: toastId, duration: 5000 });
                setIsPromoteModalOpen(false);
            } else {
                throw new Error(data.error || "Failed to promote");
            }
        } catch (error) {
            console.error(error);
            toast.error(error.message, { id: toastId });
        } finally {
            setIsPromoting(false);
        }
    };

    const NavLink = ({ page, iconClass, label }) => (
        <li className={activePage === page ? 'active' : ''} onClick={() => { setActivePage(page); setIsMobileNavOpen(false); }}>
            <i className={`fas ${iconClass}`}></i> <span>{label}</span>
        </li>
    );

    const renderContent = () => {
        if (!adminInfo) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;
        const { instituteName, instituteId } = adminInfo;

        switch (activePage) {
            case 'dashboard': return <DashboardHome instituteName={instituteName} instituteId={instituteId} />;
            case 'addDepartment': return <AddDepartment instituteId={instituteId} instituteName={instituteName} showModal={showModal} />;
            case 'addHOD': return <AddHOD instituteId={instituteId} instituteName={instituteName} showModal={showModal} />;
            
            case 'bulkStudents': return <BulkAddStudents instituteId={instituteId} instituteName={instituteName} />;
            case 'manageUsers': return <ManageInstituteUsers instituteId={instituteId} showModal={showModal} />;
            case 'faceRequests': return <FaceRequestsManager user={adminInfo} />;

            // ✅ MODERN, ANIMATED PROMOTE PAGE
            case 'promote': return (
                <div className="content-section" style={{ maxWidth: '1050px', margin: '0 auto', animation: 'fadeIn 0.5s ease-out' }}>
                    
                    {/* Deep Space Glowing Banner */}
                    <div className="promo-banner">
                        <div className="promo-banner-glow-1"></div>
                        <div className="promo-banner-glow-2"></div>
                        <div className="promo-banner-content">
                            <div className="promo-banner-icon">
                                <i className="fas fa-layer-group"></i>
                            </div>
                            <div className="promo-banner-text">
                                <h2>Academic Promotion Center</h2>
                                <p>Seamlessly transition students to their next academic year. Ensure all final grades and CCE marks are submitted before proceeding.</p>
                            </div>
                        </div>
                    </div>

                    <div className="promo-section-header stagger-1">
                        <h3><i className="fas fa-level-up-alt"></i> Class-wise Transition</h3>
                        <span className="promo-badge-outline">Recommended</span>
                    </div>
                    
                    {/* Modern Interactive Grid */}
                    <div className="promo-cards-grid">
                        {/* FE -> SE */}
                        <div className="promo-card theme-blue stagger-2">
                            <div className="promo-card-icon-wrapper">
                                <i className="fas fa-seedling"></i>
                            </div>
                            <div className="promo-card-body">
                                <h4>First Year (FE)</h4>
                                <p>Move all active FE students into Second Year (SE).</p>
                            </div>
                            <button className="promo-card-btn" onClick={() => { setClassToPromote('FE'); setIsPromoteModalOpen(true); }}>
                                Promote to SE <i className="fas fa-arrow-right"></i>
                            </button>
                        </div>

                        {/* SE -> TE */}
                        <div className="promo-card theme-green stagger-3">
                            <div className="promo-card-icon-wrapper">
                                <i className="fas fa-leaf"></i>
                            </div>
                            <div className="promo-card-body">
                                <h4>Second Year (SE)</h4>
                                <p>Move all active SE students into Third Year (TE).</p>
                            </div>
                            <button className="promo-card-btn" onClick={() => { setClassToPromote('SE'); setIsPromoteModalOpen(true); }}>
                                Promote to TE <i className="fas fa-arrow-right"></i>
                            </button>
                        </div>

                        {/* TE -> BE */}
                        <div className="promo-card theme-purple stagger-4">
                            <div className="promo-card-icon-wrapper">
                                <i className="fas fa-tree"></i>
                            </div>
                            <div className="promo-card-body">
                                <h4>Third Year (TE)</h4>
                                <p>Move all active TE students into Final Year (BE).</p>
                            </div>
                            <button className="promo-card-btn" onClick={() => { setClassToPromote('TE'); setIsPromoteModalOpen(true); }}>
                                Promote to BE <i className="fas fa-arrow-right"></i>
                            </button>
                        </div>

                        {/* BE -> Alumni */}
                        <div className="promo-card theme-orange stagger-5">
                            <div className="promo-card-icon-wrapper">
                                <i className="fas fa-graduation-cap"></i>
                            </div>
                            <div className="promo-card-body">
                                <h4>Final Year (BE)</h4>
                                <p>Graduate BE students and assign Alumni status.</p>
                            </div>
                            <button className="promo-card-btn" onClick={() => { setClassToPromote('BE'); setIsPromoteModalOpen(true); }}>
                                Graduate Class <i className="fas fa-check-circle"></i>
                            </button>
                        </div>
                    </div>

                    {/* Danger Zone: Bulk Promote All */}
                    <div className="promo-danger-zone stagger-6">
                        <div className="promo-danger-content">
                            <div className="promo-danger-icon"><i className="fas fa-exclamation-triangle"></i></div>
                            <div className="promo-danger-text">
                                <h3>Promote Entire Institute</h3>
                                <p>Executes all 4 class transitions simultaneously. Recommended only at the very end of the academic year.</p>
                            </div>
                        </div>
                        <button className="promo-danger-btn" onClick={() => { setClassToPromote('ALL'); setIsPromoteModalOpen(true); }}>
                            <i className="fas fa-bolt"></i> Execute Bulk Promotion
                        </button>
                    </div>

                    {/* Enhanced Modal */}
                    {isPromoteModalOpen && (
                        <div className="custom-modal-overlay" style={{ backdropFilter: 'blur(8px)' }}>
                            <div className="custom-modal-box" style={{ animation: 'springUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
                                <div className="modal-icon" style={{ background: '#fef2f2', color: '#ef4444', width: '60px', height: '60px', fontSize: '24px', margin: '0 auto 20px auto', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <i className="fas fa-radiation"></i>
                                </div>
                                <h3 style={{ textAlign: 'center', fontSize: '22px', color: '#1e293b', marginBottom: '10px' }}>Confirm Action</h3>
                                <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', textAlign: 'center', marginBottom: '25px' }}>
                                    You are about to promote <strong>{classToPromote === 'ALL' ? 'THE ENTIRE INSTITUTE' : `${classToPromote} Students`}</strong>. 
                                    This will transition their classes and assign a new Academic Year string.
                                </p>
                                
                                <div className="prof-input-group" style={{ textAlign: 'left' }}>
                                    <label className="prof-label" style={{ color: '#475569', fontWeight: 'bold' }}>Target Academic Year</label>
                                    <input 
                                        type="text" 
                                        className="prof-input"
                                        value={newTargetYear}
                                        onChange={(e) => setNewTargetYear(e.target.value)}
                                        placeholder="e.g., 2026-2027"
                                        disabled={isPromoting}
                                        style={{ fontSize: '18px', letterSpacing: '2px', fontWeight: '800', textAlign: 'center', background: '#f8fafc', border: '2px solid #e2e8f0' }}
                                    />
                                </div>

                                <div className="modal-actions" style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
                                    <button onClick={() => setIsPromoteModalOpen(false)} className="btn-secondary" style={{ flex: 1, padding: '12px', borderRadius: '12px', fontSize: '16px', fontWeight: '600' }} disabled={isPromoting}>
                                        Cancel
                                    </button>
                                    <button onClick={handleBulkPromote} className="btn-primary" style={{ flex: 1, background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', boxShadow: '0 10px 20px -5px rgba(239, 68, 68, 0.4)', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', color: 'white' }} disabled={isPromoting}>
                                        {isPromoting ? <><i className="fas fa-spinner fa-spin"></i> Processing</> : 'Confirm Transition'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ✅ INJECTED CSS JUST FOR THE PROMOTE TAB */}
                    <style>{`
                        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                        @keyframes springUp { from { opacity: 0; transform: scale(0.8) translateY(40px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                        @keyframes slideUpFade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                        
                        .stagger-1 { animation: slideUpFade 0.5s ease-out 0.1s forwards; opacity: 0; }
                        .stagger-2 { animation: slideUpFade 0.5s ease-out 0.2s forwards; opacity: 0; }
                        .stagger-3 { animation: slideUpFade 0.5s ease-out 0.3s forwards; opacity: 0; }
                        .stagger-4 { animation: slideUpFade 0.5s ease-out 0.4s forwards; opacity: 0; }
                        .stagger-5 { animation: slideUpFade 0.5s ease-out 0.5s forwards; opacity: 0; }
                        .stagger-6 { animation: slideUpFade 0.5s ease-out 0.6s forwards; opacity: 0; }

                        /* Deep Space Banner */
                        .promo-banner { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 24px; padding: 40px; margin-bottom: 40px; position: relative; overflow: hidden; box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.05); }
                        .promo-banner-glow-1 { position: absolute; top: -50px; right: -50px; width: 250px; height: 250px; background: rgba(56, 189, 248, 0.2); filter: blur(60px); border-radius: 50%; }
                        .promo-banner-glow-2 { position: absolute; bottom: -80px; left: 10%; width: 200px; height: 200px; background: rgba(139, 92, 246, 0.2); filter: blur(60px); border-radius: 50%; }
                        .promo-banner-content { display: flex; align-items: center; gap: 25px; position: relative; z-index: 2; }
                        .promo-banner-icon { width: 75px; height: 75px; min-width: 75px; border-radius: 20px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); display: flex; justify-content: center; align-items: center; font-size: 30px; color: #38bdf8; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
                        .promo-banner-text h2 { margin: 0 0 8px 0; color: white; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
                        .promo-banner-text p { margin: 0; color: #94a3b8; font-size: 15px; line-height: 1.6; max-width: 650px; }

                        @media (max-width: 768px) {
                            .promo-banner-content { flex-direction: column; text-align: center; }
                        }

                        /* Section Header */
                        .promo-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px; }
                        .promo-section-header h3 { margin: 0; color: #1e293b; font-size: 20px; display: flex; align-items: center; gap: 10px; }
                        .promo-section-header h3 i { color: #64748b; background: #f1f5f9; padding: 10px; border-radius: 10px; }
                        .promo-badge-outline { padding: 6px 12px; border-radius: 20px; border: 1px solid #cbd5e1; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }

                        /* Cards Grid */
                        .promo-cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; margin-bottom: 40px; }
                        .promo-card { background: white; border-radius: 24px; padding: 30px 25px; border: 1px solid #f1f5f9; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05); display: flex; flex-direction: column; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); position: relative; overflow: hidden; }
                        .promo-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.12); }
                        .promo-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px; opacity: 0.8; }
                        
                        .promo-card-icon-wrapper { width: 55px; height: 55px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 22px; margin-bottom: 20px; transition: transform 0.3s ease; }
                        .promo-card:hover .promo-card-icon-wrapper { transform: scale(1.1) rotate(5deg); }
                        
                        .promo-card-body { flex-grow: 1; margin-bottom: 25px; }
                        .promo-card-body h4 { margin: 0 0 10px 0; font-size: 18px; color: #1e293b; font-weight: 800; }
                        .promo-card-body p { margin: 0; font-size: 14px; color: #64748b; line-height: 1.6; }
                        
                        .promo-card-btn { width: 100%; padding: 14px; border-radius: 14px; border: none; font-size: 14px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.3s ease; }
                        .promo-card-btn i { transition: transform 0.3s ease; }
                        .promo-card:hover .promo-card-btn i { transform: translateX(5px); }
                        
                        /* Themes */
                        .theme-blue::before { background: #3b82f6; }
                        .theme-blue .promo-card-icon-wrapper { background: #eff6ff; color: #3b82f6; }
                        .theme-blue .promo-card-btn { background: #eff6ff; color: #1d4ed8; }
                        .theme-blue:hover .promo-card-btn { background: #3b82f6; color: white; box-shadow: 0 8px 20px -5px rgba(59, 130, 246, 0.4); }

                        .theme-green::before { background: #10b981; }
                        .theme-green .promo-card-icon-wrapper { background: #ecfdf5; color: #10b981; }
                        .theme-green .promo-card-btn { background: #ecfdf5; color: #047857; }
                        .theme-green:hover .promo-card-btn { background: #10b981; color: white; box-shadow: 0 8px 20px -5px rgba(16, 185, 129, 0.4); }

                        .theme-purple::before { background: #8b5cf6; }
                        .theme-purple .promo-card-icon-wrapper { background: #f5f3ff; color: #8b5cf6; }
                        .theme-purple .promo-card-btn { background: #f5f3ff; color: #6d28d9; }
                        .theme-purple:hover .promo-card-btn { background: #8b5cf6; color: white; box-shadow: 0 8px 20px -5px rgba(139, 92, 246, 0.4); }

                        .theme-orange::before { background: #f59e0b; }
                        .theme-orange .promo-card-icon-wrapper { background: #fffbeb; color: #f59e0b; }
                        .theme-orange .promo-card-btn { background: #fffbeb; color: #b45309; }
                        .theme-orange:hover .promo-card-btn { background: #f59e0b; color: white; box-shadow: 0 8px 20px -5px rgba(245, 158, 11, 0.4); }

                        /* Danger Zone */
                        .promo-danger-zone { background: white; border: 1px solid #fecaca; border-radius: 24px; padding: 30px; display: flex; justify-content: space-between; align-items: center; gap: 30px; box-shadow: 0 10px 30px -10px rgba(239, 68, 68, 0.1); position: relative; overflow: hidden; }
                        .promo-danger-zone::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: #ef4444; }
                        .promo-danger-content { display: flex; align-items: center; gap: 20px; }
                        .promo-danger-icon { width: 60px; height: 60px; border-radius: 16px; background: #fef2f2; color: #ef4444; font-size: 24px; display: flex; justify-content: center; align-items: center; }
                        .promo-danger-text h3 { margin: 0 0 5px 0; color: #b91c1c; font-size: 20px; font-weight: 800; }
                        .promo-danger-text p { margin: 0; color: #7f1d1d; font-size: 14px; line-height: 1.5; max-width: 500px; }
                        
                        .promo-danger-btn { padding: 16px 32px; border-radius: 14px; background: #ef4444; color: white; border: none; font-size: 15px; font-weight: bold; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; gap: 10px; white-space: nowrap; box-shadow: 0 10px 20px -5px rgba(239, 68, 68, 0.4); }
                        .promo-danger-btn:hover { background: #dc2626; transform: translateY(-3px); box-shadow: 0 15px 25px -5px rgba(239, 68, 68, 0.5); }

                        @media (max-width: 768px) {
                            .promo-danger-zone { flex-direction: column; align-items: flex-start; padding: 25px; }
                            .promo-danger-btn { width: 100%; justify-content: center; }
                        }
                    `}</style>
                </div>
            );
            
            // ✅ UPDATED PROFILE & SECURITY SECTION
            case 'security': return (
                <div className="content-section" style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    
                    {/* --- PREMIUM HEADER CARD --- */}
                    <div className="prof-header-card">
                        <div className="prof-header-content">
                            <div className="prof-avatar">
                                {adminInfo?.firstName?.[0] || 'A'}{adminInfo?.lastName?.[0] || 'D'}
                            </div>
                            
                            <div className="prof-info">
                                <h2 className="prof-name">{adminInfo?.firstName} {adminInfo?.lastName}</h2>
                                <div className="prof-badges">
                                    <span className="prof-badge-glass">INSTITUTE ADMIN</span>
                                    <span className="prof-badge-glass">{instituteName}</span>
                                </div>
                            </div>

                            <button
                                className={`prof-btn ${isEditing ? 'prof-btn-save' : 'prof-btn-edit'}`}
                                onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
                            >
                                <i className={`fas ${isEditing ? 'fa-check' : 'fa-pen'}`}></i>
                                {isEditing ? 'Save Changes' : 'Edit Profile'}
                            </button>
                        </div>
                    </div>

                    {/* --- TABS --- */}
                    <div className="prof-tabs-container">
                        <div className="prof-tabs">
                            <button
                                className={`prof-tab-item ${profileTab === 'details' ? 'active' : ''}`}
                                onClick={() => setProfileTab('details')}
                            >
                                Personal Details
                            </button>
                            <button
                                className={`prof-tab-item ${profileTab === 'security' ? 'active' : ''}`}
                                onClick={() => setProfileTab('security')}
                            >
                                Security & 2FA
                            </button>
                        </div>
                    </div>

                    {/* --- DETAILS TAB --- */}
                    {profileTab === 'details' && (
                        <div className="prof-grid">
                            <div className="prof-card" style={{ width: '100%' }}>
                                <div className="prof-card-header">
                                    <div className="prof-icon-box" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                                        <i className="fas fa-user"></i>
                                    </div>
                                    <h3>Basic Information</h3>
                                </div>

                                <div className="prof-form-grid">
                                    <ProfInput label="First Name" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} disabled={!isEditing} />
                                    <ProfInput label="Last Name" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} disabled={!isEditing} />
                                    <ProfInput label="Phone Number" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} disabled={!isEditing} />
                                    <ProfInput label="Email Address" value={auth.currentUser?.email} disabled={true} lockIcon={true} />
                                    <ProfInput label="Role" value="Institute Admin" disabled={true} lockIcon={true} />
                                    <ProfInput label="Institute" value={instituteName} disabled={true} lockIcon={true} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- SECURITY TAB --- */}
                    {profileTab === 'security' && (
                        <div className="prof-grid">
                            {/* 2FA SETUP */}
                            <div className="prof-card" style={{ borderLeft: '4px solid #10b981' }}>
                                <div className="prof-card-header">
                                    <div className="prof-icon-box" style={{ background: '#dcfce7', color: '#16a34a' }}>
                                        <i className="fas fa-shield-alt"></i>
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0 }}>Two-Factor Authentication</h3>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Secure your dashboard access.</p>
                                    </div>
                                </div>
                                <div style={{ padding: '0 5px' }}>
                                    <TwoFactorSetup user={adminInfo} />
                                </div>
                            </div>

                            {/* CHANGE PASSWORD */}
                            <div className="prof-card">
                                <div className="prof-card-header">
                                    <div className="prof-icon-box" style={{ background: '#fee2e2', color: '#ef4444' }}>
                                        <i className="fas fa-key"></i>
                                    </div>
                                    <h3>Change Password</h3>
                                </div>
                                <form onSubmit={handleUpdatePassword} className="prof-form-stack">
                                    <ProfInput
                                        label="New Password"
                                        type="password"
                                        value={passData.newPass}
                                        onChange={e => setPassData({ ...passData, newPass: e.target.value })}
                                        placeholder="Enter new password"
                                    />
                                    <ProfInput
                                        label="Confirm Password"
                                        type="password"
                                        value={passData.confirmPass}
                                        onChange={e => setPassData({ ...passData, confirmPass: e.target.value })}
                                        placeholder="Re-enter new password"
                                    />
                                    <button className="prof-btn prof-btn-save" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }} disabled={passLoading}>
                                        {passLoading ? "Updating..." : "Update Password"}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* --- EMBEDDED STYLES FOR PROFILE TAB --- */}
                    <style>{`
                        .prof-header-card { background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); border-radius: 20px; box-shadow: 0 10px 30px rgba(219, 39, 119, 0.25); margin-bottom: 30px; position: relative; border: 1px solid rgba(255,255,255,0.2); }
                        .prof-header-content { padding: 40px; display: flex; align-items: center; gap: 30px; }
                        .prof-avatar { width: 100px; height: 100px; min-width: 100px; border-radius: 50%; background: rgba(255, 255, 255, 0.95); border: 4px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; color: #db2777; font-size: 36px; font-weight: 800; box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
                        .prof-info { flex: 1; }
                        .prof-name { margin: 0; font-size: 32px; color: white; font-weight: 800; letter-spacing: -0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                        .prof-badges { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
                        .prof-badge-glass { background: rgba(255, 255, 255, 0.2); color: white; padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid rgba(255, 255, 255, 0.3); backdrop-filter: blur(5px); }
                        .prof-btn { padding: 10px 24px; border-radius: 12px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(0,0,0,0.1); white-space: nowrap; }
                        .prof-btn:hover { transform: translateY(-2px); }
                        .prof-btn-edit { background: white; color: #db2777; }
                        .prof-btn-save { background: #10b981; color: white; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4); }
                        .prof-tabs-container { margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; }
                        .prof-tabs { display: flex; gap: 30px; overflow-x: auto; }
                        .prof-tab-item { background: none; border: none; padding: 12px 0; font-size: 15px; font-weight: 600; color: #64748b; cursor: pointer; position: relative; transition: color 0.2s; white-space: nowrap; }
                        .prof-tab-item:hover { color: #334155; }
                        .prof-tab-item.active { color: #db2777; }
                        .prof-tab-item.active::after { content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 3px; background: #db2777; border-radius: 3px 3px 0 0; }
                        .prof-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 30px; }
                        .prof-card { background: white; border-radius: 20px; padding: 30px; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); transition: transform 0.3s ease; }
                        .prof-card:hover { transform: translateY(-3px); box-shadow: 0 12px 25px -5px rgba(0,0,0,0.08); }
                        .prof-card-header { display: flex; align-items: center; gap: 15px; margin-bottom: 25px; }
                        .prof-card-header h3 { margin: 0; font-size: 18px; color: #1e293b; font-weight: 700; }
                        .prof-icon-box { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
                        .prof-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                        .prof-form-stack { display: flex; flex-direction: column; gap: 20px; }
                        .prof-input-group { position: relative; }
                        .prof-label { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.6px; }
                        .prof-input { width: 100%; padding: 12px 16px; border-radius: 12px; border: 2px solid #f1f5f9; background: #f8fafc; color: #1e293b; font-size: 14px; font-weight: 500; transition: all 0.2s; box-sizing: border-box; }
                        .prof-input:focus { background: white; border-color: #d946ef; outline: none; box-shadow: 0 0 0 4px rgba(217, 70, 239, 0.1); }
                        .prof-input:disabled { background: #f1f5f9; border-color: transparent; color: #64748b; cursor: not-allowed; }
                        @media (max-width: 768px) {
                            .prof-header-content { flex-direction: column; text-align: center; padding: 30px; }
                            .prof-avatar { width: 90px; height: 90px; font-size: 32px; }
                            .prof-name { font-size: 24px; }
                            .prof-badges { justify-content: center; }
                            .prof-btn { width: 100%; justify-content: center; margin-top: 10px; }
                            .prof-grid { grid-template-columns: 1fr; }
                            .prof-form-grid { grid-template-columns: 1fr; }
                            .prof-tabs { justify-content: space-between; }
                            .prof-tab-item { flex: 1; text-align: center; }
                        }
                    `}</style>
                </div>
            );

            default: return <DashboardHome instituteName={instituteName} instituteId={instituteId} />;
        }
    };

    return (
        <div className="dashboard-container">
            <Toaster position="center" reverseOrder={false} />

            {modal.isOpen && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal-box">
                        <div className={`modal-icon ${modal.type === 'danger' ? 'icon-danger' : 'icon-info'}`}>
                            <i className={`fas ${modal.type === 'danger' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`}></i>
                        </div>
                        <h3>{modal.title}</h3>
                        <p>{modal.message}</p>
                        <div className="modal-actions">
                            {modal.onConfirm ? (
                                <>
                                    <button className="btn-secondary" onClick={closeModal}>Cancel</button>
                                    <button className={`btn-primary ${modal.type === 'danger' ? 'btn-danger-solid' : ''}`} onClick={() => { modal.onConfirm(); closeModal(); }}>Confirm</button>
                                </>
                            ) : (
                                <button className="btn-primary" onClick={closeModal}>Okay</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)}></div>}
            
            <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`}>
                <div className="logo-container">
                    <img src={logo} alt="Logo" className="sidebar-logo" />
                    <span className="logo-text">trackee</span>
                </div>
                
                {adminInfo && (
                    <div className="teacher-info">
                        <h4>{adminInfo.firstName} {adminInfo.lastName}</h4>
                        <p>Institute Admin</p>
                    </div>
                )}
                
                <ul className="menu">
                    <NavLink page="dashboard" iconClass="fa-tachometer-alt" label="Dashboard" />
                    <NavLink page="addDepartment" iconClass="fa-building" label="Departments" />
                    <NavLink page="addHOD" iconClass="fa-user-tie" label="Add HOD" />
                    <NavLink page="bulkStudents" iconClass="fa-file-upload" label="Bulk Upload" />
                    <NavLink page="manageUsers" iconClass="fa-users" label="Manage Users" />
                    <NavLink page="promote" iconClass="fa-level-up-alt" label="Promote Students" />
                    <NavLink page="faceRequests" iconClass="fa-user-shield" label="Face ID Resets" />
                    <NavLink page="security" iconClass="fa-user-circle" label="Profile & Security" />
                </ul>
                
                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="logout-btn">
                        <i className="fas fa-sign-out-alt"></i><span>Logout</span>
                    </button>
                </div>
            </aside>
            
            <main className="main-content">
                <header className="mobile-header">
                    <button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}>
                        <i className="fas fa-bars"></i>
                    </button>
                    <div className="mobile-brand">
                        <img src={logo} alt="Logo" className="mobile-logo-img" />
                        <span className="mobile-logo-text">trackee</span>
                    </div>
                    <div style={{ width: '40px' }}></div>
                </header>
                {renderContent()}
            </main>
        </div>
    );
}