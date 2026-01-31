import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot } from "firebase/firestore";
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

// ✅ IMPORT THE NEW BULK UPLOAD COMPONENT
import BulkAddStudents from './BulkAddStudents'; 

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
            {/* CODE CARD */}
            <div className="card" style={{ background: 'linear-gradient(120deg, #2563eb 0%, #1d4ed8 100%)', border: 'none', marginBottom: '40px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                        {/* Icon Box */}
                        <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '8px', borderRadius: '8px', color: 'white' }}>
                            <i className="fas fa-key"></i>
                        </div>
                        {/* ✅ FIX: Added color: 'white' explicitly */}
                        <h3 style={{ margin: 0, fontSize: '18px', color: 'white' }}>Institute Code</h3>
                    </div>

                    {/* ✅ FIX: Added color: 'white' explicitly */}
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
                
                {/* Decorative Background Circles */}
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

    const navigate = useNavigate();

    useEffect(() => {
        const fetchAdminData = async () => {
            if (auth.currentUser) {
                try {
                    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
                    if (userDoc.exists()) {
                        setAdminInfo(userDoc.data());
                    }
                } catch (e) {
                    console.error("Error fetching admin data:", e);
                }
            } else {
                navigate('/'); 
            }
        };
        fetchAdminData();
    }, [navigate]);

    const handleLogout = async () => { await signOut(auth); navigate('/'); };

    const showModal = (title, message, type = 'info', onConfirm = null) => {
        setModal({ isOpen: true, title, message, type, onConfirm });
    };
    const closeModal = () => setModal({ ...modal, isOpen: false });

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
            
            // ✅ ADDED: Route for Bulk Upload
            case 'bulkStudents': return <BulkAddStudents instituteId={instituteId} instituteName={instituteName} />;
            
            case 'manageUsers': return <ManageInstituteUsers instituteId={instituteId} showModal={showModal} />;
            case 'security': return (
                <div className="content-section">
                    <div style={{ marginBottom: '30px' }}>
                        <h2 className="content-title">Security Center</h2>
                        <p className="content-subtitle">Manage account protection and institute access.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
                        
                        {/* 1. ADMIN PROFILE CARD */}
                        <div className="card" style={{ borderTop: '4px solid #3b82f6' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                    <i className="fas fa-user-shield"></i>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Admin Profile</h3>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Primary Account Holder</p>
                                </div>
                            </div>
                            
                            <div style={{ display: 'grid', gap: '15px' }}>
                                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Full Name</label>
                                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>{adminInfo.firstName} {adminInfo.lastName}</div>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Institute</label>
                                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>{adminInfo.instituteName}</div>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Admin Role</label>
                                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                        <span className="status-badge status-approved">Super User</span>
                                        <span style={{fontSize:'12px', color:'#64748b'}}>• Full Access</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. 2FA SETUP CARD (Wrapped) */}
                        <div className="card" style={{ borderTop: '4px solid #10b981' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                    <i className="fas fa-lock"></i>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Two-Factor Authentication</h3>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Secure your dashboard access</p>
                                </div>
                            </div>
                            
                            {/* We invoke the component here */}
                            <TwoFactorSetup user={adminInfo} />
                            
                            <div style={{ marginTop: '20px', padding: '15px', background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '10px', display: 'flex', gap: '10px' }}>
                                <i className="fas fa-info-circle" style={{ color: '#3b82f6', marginTop: '3px' }}></i>
                                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                                    Enabling 2FA is highly recommended for Institute Admins. It prevents unauthorized access even if your password is compromised.
                                </p>
                            </div>
                        </div>

                    </div>
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
                    
                    {/* ✅ ADDED: Sidebar Link for Bulk Upload */}
                    <NavLink page="bulkStudents" iconClass="fa-file-upload" label="Bulk Upload" />
                    
                    <NavLink page="manageUsers" iconClass="fa-users" label="Manage Users" />
                    <NavLink page="security" iconClass="fa-lock" label="Security" />
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