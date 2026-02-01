import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import toast, { Toaster } from 'react-hot-toast';
import './Dashboard.css';
import logo from "../assets/logo.png";
import TwoFactorSetup from '../components/TwoFactorSetup';

// Import components
import AddTeacher from './AddTeacher';
import AddStudent from './AddStudent';
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
            case 'addTeacher': return <AddTeacher instituteId={instituteId} instituteName={instituteName} showModal={showModal} />;
            case 'addStudent': return <AddStudent instituteId={instituteId} instituteName={instituteName} showModal={showModal} />;
            case 'bulkStudents': return <BulkAddStudents instituteId={instituteId} instituteName={instituteName} />;
            case 'manageUsers': return <ManageInstituteUsers instituteId={instituteId} showModal={showModal} />;
            
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
                    <span className="logo-text">Acadex</span>
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
                    <NavLink page="addTeacher" iconClass="fa-chalkboard-teacher" label="Add Teacher" />
                    <NavLink page="addStudent" iconClass="fa-user-graduate" label="Add Student" />
                    <NavLink page="bulkStudents" iconClass="fa-file-upload" label="Bulk Upload" />
                    <NavLink page="manageUsers" iconClass="fa-users" label="Manage Users" />
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
                        <span className="mobile-logo-text">AcadeX</span>
                    </div>
                    <div style={{ width: '40px' }}></div>
                </header>
                {renderContent()}
            </main>
        </div>
    );
}