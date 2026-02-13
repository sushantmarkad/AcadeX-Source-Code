import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db, sendPasswordResetEmail } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore'; 
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion'; 
import './Dashboard.css'; 
import './SuperAdminDashboard.css'; 
import logo from "../assets/logo.png";

// ✅ Re-import 2FA Component
import TwoFactorSetup from '../components/TwoFactorSetup';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// --- HELPER: Avatar Gradient ---
const getAvatarGradient = (name) => {
    const gradients = [
        'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', // Blue
        'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Emerald
        'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Amber
        'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', // Violet
        'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'  // Pink
    ];
    return gradients[(name?.length || 0) % gradients.length];
};

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

// --- MODAL COMPONENT ---
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, isDanger }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
        }}>
            <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.9, opacity: 0, y: 20 }} 
                style={{ 
                    background: 'white', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '400px', 
                    textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', position: 'relative', zIndex: 100000 
                }}
            >
                <div style={{ 
                    width: '60px', height: '60px', borderRadius: '50%', 
                    background: isDanger ? '#fee2e2' : '#f3f4f6', color: isDanger ? '#dc2626' : '#4b5563', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 20px auto' 
                }}>
                    <i className={`fas ${isDanger ? 'fa-exclamation-triangle' : 'fa-info-circle'}`}></i>
                </div>
                <h3 style={{ margin: '0 0 10px 0', color: '#111827', fontSize:'18px', fontWeight: 'bold' }}>{title}</h3>
                <p style={{ margin: '0 0 25px 0', color: '#6b7280', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-line' }}>{message}</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontWeight: '600', color: '#374151', flex: 1 }}>Cancel</button>
                    <button onClick={onConfirm} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: isDanger ? '#dc2626' : '#2563eb', cursor: 'pointer', fontWeight: '600', color: 'white', boxShadow: isDanger ? '0 4px 14px 0 rgba(220, 38, 38, 0.39)' : '0 4px 14px 0 rgba(37, 99, 235, 0.39)', flex: 1 }}>{isDanger ? 'Yes, Delete' : 'Confirm'}</button>
                </div>
            </motion.div>
        </div>
    );
};

export default function SuperAdminDashboard() {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    
    // Tabs: 'applications', 'profile'
    const [activeTab, setActiveTab] = useState('applications'); 
    
    // --- PROFILE & SECURITY STATE ---
    const [userProfile, setUserProfile] = useState(null);
    const [profileTab, setProfileTab] = useState('details'); // 'details' or 'security'
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ firstName: '', lastName: '', phone: '' });
    
    // Password State
    const [passData, setPassData] = useState({ newPass: '', confirmPass: '' });
    const [passLoading, setPassLoading] = useState(false);

    const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: false });
    const navigate = useNavigate();

    // 1. Fetch Applications & User Profile
    useEffect(() => {
        // Fetch Apps
        const unsubApps = onSnapshot(collection(db, "applications"), (snap) => {
            setApplications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        // Fetch Current Admin Profile
        let unsubUser = () => {};
        if (auth.currentUser) {
             unsubUser = onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setUserProfile(data);
                    // Sync Form Data if not editing
                    if (!isEditing) {
                        setFormData({
                            firstName: data.firstName || '',
                            lastName: data.lastName || '',
                            phone: data.phone || ''
                        });
                    }
                }
            });
        }

        return () => { unsubApps(); unsubUser(); };
    }, [isEditing]);

    const openConfirm = (title, message, onConfirm, isDanger = false) => {
        setModalConfig({ isOpen: true, title, message, onConfirm, isDanger });
    };
    const closeConfirm = () => setModalConfig({ ...modalConfig, isOpen: false });

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

    // --- APPLICATION ACTIONS ---
    const handleApproval = async (app) => {
        const toastId = toast.loading("Creating Admin Account...");
        try {
            const tempPassword = Math.random().toString(36).slice(-8) + "Aa1@"; 
            const response = await fetch(`${BACKEND_URL}/createUser`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: app.email, password: tempPassword, firstName: app.contactName,
                    lastName: "(Admin)", role: 'institute-admin',
                    instituteName: app.instituteName, instituteId: app.id 
                })
            });
            if (!response.ok) throw new Error("Backend creation failed");
            const data = await response.json();
            await updateDoc(doc(db, "applications", app.id), { status: 'approved', adminUid: data.uid });
            await sendPasswordResetEmail(auth, app.email);
            toast.success(`Approved! Login email sent to ${app.email}`, { id: toastId });
        } catch (error) {
            toast.error("Approval Failed: " + error.message, { id: toastId });
        }
    };

    const handleDenial = (appId) => {
        openConfirm("Deny Application?", "Are you sure you want to deny this request?", async () => {
            closeConfirm();
            try { await updateDoc(doc(db, "applications", appId), { status: 'denied' }); toast.success("Application Denied"); } 
            catch(e) { toast.error("Error denying application"); }
        }, true);
    };

    const handleDeleteInstitute = (app) => {
        openConfirm("Delete Institute?", `⚠️ This will PERMANENTLY DELETE "${app.instituteName}" and all its data.`, async () => {
            closeConfirm();
            const toastId = toast.loading("Deleting Institute...");
            try {
                const response = await fetch(`${BACKEND_URL}/deleteInstitute`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instituteId: app.id })
                });
                if (!response.ok) throw new Error("Delete failed");
                toast.success(`${app.instituteName} deleted.`, { id: toastId });
            } catch (error) { toast.error("Delete Failed: " + error.message, { id: toastId }); }
        }, true);
    };

    const handleSendLoginLink = async (email) => {
        const toastId = toast.loading("Sending email...");
        try { await sendPasswordResetEmail(auth, email); toast.success(`Link sent to ${email}`, { id: toastId }); } 
        catch (e) { toast.error("Failed to send email", { id: toastId }); }
    };

    const pendingApps = applications.filter(app => app.status === 'pending');
    const approvedApps = applications.filter(app => app.status === 'approved');

    if (loading) return <div className="content-section"><p>Loading...</p></div>;

    return (
        <div className="dashboard-container" style={{ position: 'relative' }}> 
            
            
            {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)}></div>}

            <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`}>
                <div className="logo-container"><img src={logo} alt="Logo" className="sidebar-logo"/><span className="logo-text">trackee</span></div>
                <div className="teacher-info"><h4>Super Admin</h4><p>Platform Manager</p></div>
                <ul className="menu">
                    <li className={activeTab === 'applications' ? 'active' : ''} onClick={() => { setActiveTab('applications'); setIsMobileNavOpen(false); }}>
                        <i className="fas fa-shield-alt" style={{width:'20px'}}></i><span>Applications</span>
                    </li>
                    <li className={activeTab === 'profile' ? 'active' : ''} onClick={() => { setActiveTab('profile'); setIsMobileNavOpen(false); }}>
                        <i className="fas fa-user-circle" style={{width:'20px'}}></i><span>Profile & Security</span>
                    </li>
                </ul>
                <div className="sidebar-footer"><button onClick={() => signOut(auth).then(() => navigate('/'))} className="logout-btn"><i className="fas fa-sign-out-alt"></i><span>Logout</span></button></div>
            </aside>

            <main className="main-content">
                <header className="mobile-header">
                    <button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}><i className="fas fa-bars"></i></button>
                    <div className="mobile-brand"><img src={logo} alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">trackee</span></div>
                    <div style={{width:'40px'}}></div>
                </header>

                {activeTab === 'profile' ? (
                    <div className="content-section" style={{ maxWidth: '1000px', margin: '0 auto' }}>
                        
                        {/* --- PREMIUM HEADER CARD --- */}
                        <div className="prof-header-card">
                            <div className="prof-header-content">
                                <div className="prof-avatar">
                                    {userProfile?.firstName?.[0] || 'S'}{userProfile?.lastName?.[0] || 'A'}
                                </div>
                                
                                <div className="prof-info">
                                    <h2 className="prof-name">{userProfile?.firstName || 'Super'} {userProfile?.lastName || 'Admin'}</h2>
                                    <div className="prof-badges">
                                        <span className="prof-badge-glass">SUPER ADMIN</span>
                                        <span className="prof-badge-glass">SYSTEM ACCESS</span>
                                        <span className="prof-badge-glass">VERIFIED</span>
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

                        {/* --- MODERN TABS --- */}
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
                                        <ProfInput label="Role" value="Super Administrator" disabled={true} lockIcon={true} />
                                        <ProfInput label="Permissions" value="Full System Access" disabled={true} lockIcon={true} />
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
                                            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Secure your admin account with Google Authenticator.</p>
                                        </div>
                                    </div>
                                    <div style={{ padding: '0 5px' }}>
                                        <TwoFactorSetup user={userProfile} />
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

                        {/* --- EMBEDDED STYLES --- */}
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
                ) : (
                    // --- EXISTING APPLICATIONS TAB ---
                    <div className="content-section">
                        <div style={{marginBottom:'30px'}}>
                            <h2 className="content-title">Institute Applications</h2>
                            <p className="content-subtitle">Manage new registrations and active institutes.</p>
                        </div>

                        <div className="cards-grid">
                            <div className="card" style={{background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: 'none'}}>
                                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                    <div className="icon-box-modern" style={{background:'white', color:'#2563eb'}}><i className="fas fa-building"></i></div>
                                    <div><h3 style={{margin:0, color:'#1e3a8a'}}>Total Institutes</h3><p style={{margin:0, fontSize:'32px', fontWeight:'800', color:'#1e40af'}}>{approvedApps.length}</p></div>
                                </div>
                            </div>
                            <div className="card" style={{background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: 'none'}}>
                                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                    <div className="icon-box-modern" style={{background:'white', color:'#d97706'}}><i className="fas fa-clock"></i></div>
                                    <div><h3 style={{margin:0, color:'#92400e'}}>Pending Requests</h3><p style={{margin:0, fontSize:'32px', fontWeight:'800', color:'#b45309'}}>{pendingApps.length}</p></div>
                                </div>
                            </div>
                        </div>

                        {/* PENDING TABLE */}
                        <h3 style={{marginTop:'40px', marginBottom:'15px', color:'#b45309', display:'flex', alignItems:'center', gap:'10px'}}>
                            <i className="fas fa-hourglass-half"></i> Pending Applications
                        </h3>
                        <div className="card card-full-width">
                            <div className="table-wrapper">
                                <table className="attendance-table">
                                    <thead><tr><th>Institute</th><th>Contact</th><th>Email</th><th>Document</th><th>Actions</th></tr></thead>
                                    <tbody>
                                        {pendingApps.length > 0 ? pendingApps.map(app => (
                                            <tr key={app.id}>
                                                <td style={{fontWeight:'600'}}>{app.instituteName}</td>
                                                <td>{app.contactName}</td>
                                                <td>{app.email}</td>
                                                <td>
                                                    {app.documentUrl ? (
                                                        <a href={app.documentUrl} target="_blank" rel="noreferrer" style={{color: '#2563eb', textDecoration: 'none', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px'}}>
                                                            <i className="fas fa-file-alt"></i> View Doc
                                                        </a>
                                                    ) : <span style={{color: '#94a3b8', fontSize: '12px'}}>No Doc</span>}
                                                </td>
                                                <td>
                                                    <div style={{display:'flex', gap:'8px'}}>
                                                        <button onClick={() => handleApproval(app)} className="btn-action btn-action-approve">Approve</button>
                                                        <button onClick={() => handleDenial(app.id)} className="btn-action btn-action-deny">Deny</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : <tr><td colSpan="5" style={{textAlign:'center', padding:'30px', color:'#666'}}>No pending applications.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* APPROVED TABLE */}
                        <h3 style={{marginTop:'40px', marginBottom:'15px', color:'#1e3a8a', display:'flex', alignItems:'center', gap:'10px'}}>
                            <i className="fas fa-check-circle"></i> Approved Institutes
                        </h3>
                        <div className="card card-full-width">
                            <div className="table-wrapper">
                                <table className="attendance-table">
                                    <thead><tr><th>Institute</th><th>Admin Contact</th><th>Email</th><th>Document</th><th>Actions</th></tr></thead>
                                    <tbody>
                                        {approvedApps.length > 0 ? approvedApps.map(app => (
                                            <tr key={app.id}>
                                                <td style={{fontWeight:'600'}}>{app.instituteName}</td>
                                                <td>{app.contactName}</td>
                                                <td>{app.email}</td>
                                                <td>
                                                    {app.documentUrl ? (
                                                        <a href={app.documentUrl} target="_blank" rel="noreferrer" style={{color: '#2563eb', textDecoration: 'none', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px'}}>
                                                            <i className="fas fa-file-alt"></i> View Doc
                                                        </a>
                                                    ) : <span style={{color: '#94a3b8', fontSize: '12px'}}>No Doc</span>}
                                                </td>
                                                <td>
                                                    <div style={{display:'flex', gap:'8px'}}>
                                                        <button onClick={() => handleSendLoginLink(app.email)} className="btn-action btn-action-link" title="Resend Login Link"><i className="fas fa-paper-plane"></i></button>
                                                        <button onClick={() => handleDeleteInstitute(app)} className="btn-action btn-action-deny" style={{backgroundColor: '#fee2e2', color: '#dc2626', border:'1px solid #fecaca'}} title="Delete Institute"><i className="fas fa-trash-alt"></i></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : <tr><td colSpan="5" style={{textAlign:'center', padding:'30px', color:'#666'}}>No active institutes found.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* ✅ MODAL MOVED TO BOTTOM */}
            <AnimatePresence>
                {modalConfig.isOpen && <ConfirmModal {...modalConfig} onClose={closeConfirm} />}
            </AnimatePresence>
        </div>
    );
}