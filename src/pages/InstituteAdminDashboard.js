import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from "firebase/firestore";
import toast, { Toaster } from 'react-hot-toast'; 
import './Dashboard.css';

// Import components
import AddTeacher from './AddTeacher';
import AddStudent from './AddStudent';
import AddHOD from './AddHOD';
import AddDepartment from './AddDepartment';
import ManageInstituteUsers from './ManageInstituteUsers';

const DashboardHome = ({ instituteName, instituteId }) => {
    const [code, setCode] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchCode = async () => {
            if (!instituteId) return;
            try {
                const docRef = doc(db, "institutes", instituteId);
                const snap = await getDoc(docRef);
                if (snap.exists() && snap.data().code) {
                    setCode(snap.data().code);
                }
            } catch (err) { console.error(err); }
        };
        fetchCode();
    }, [instituteId]);

    const generateCode = async () => {
        setLoading(true);
        const prefix = instituteName ? instituteName.substring(0, 3).toUpperCase() : "INS";
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const newCode = `${prefix}-${randomNum}`;

        try {
            await setDoc(doc(db, "institutes", instituteId), { 
                code: newCode, instituteName, instituteId
            }, { merge: true });
            setCode(newCode);
            toast.success(`New Code Generated: ${newCode}`);
        } catch (err) {
            toast.error("Failed to generate code.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="content-section">
            <div style={{marginBottom:'30px'}}>
                <h2 className="content-title">Welcome, Admin!</h2>
                <p className="content-subtitle">Manage {instituteName || 'your institute'}.</p>
            </div>
            
            <div className="card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: 'none' }}>
                <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'15px'}}>
                    <div className="icon-box-modern" style={{background:'white', color:'var(--tech-blue)'}}>
                        <i className="fas fa-key"></i>
                    </div>
                    <h3 style={{margin:0, color:'#1e3a8a'}}>Institute Code</h3>
                </div>
                <p style={{ color: '#1e40af', marginBottom: '20px', fontSize:'14px' }}>
                    Share this unique code with your students for registration.
                </p>
                {code ? (
                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#1e3a8a', background: 'rgba(255,255,255,0.6)', padding: '15px', borderRadius: '12px', textAlign:'center', letterSpacing:'2px', border:'1px solid rgba(255,255,255,0.8)' }}>
                        {code}
                    </div>
                ) : (
                    <button onClick={generateCode} className="btn-primary" disabled={loading}>
                        {loading ? "Generating..." : "Generate Unique Code"}
                    </button>
                )}
            </div>
        </div>
    );
};

export default function InstituteAdminDashboard() {
    const [adminInfo, setAdminInfo] = useState(null);
    const [activePage, setActivePage] = useState('dashboard');
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    
    // ✅ MODAL STATE (Required for Delete Confirmation)
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });

    const navigate = useNavigate();

    useEffect(() => {
        const fetchAdminData = async () => {
            if (auth.currentUser) {
                const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
                if (userDoc.exists()) setAdminInfo(userDoc.data());
            }
        };
        fetchAdminData();
    }, []);

    const handleLogout = async () => { await signOut(auth); navigate('/'); };
    
    // ✅ HELPER FUNCTIONS (Passed to children)
    const showModal = (title, message, type = 'info', onConfirm = null) => {
        setModal({ isOpen: true, title, message, type, onConfirm });
    };
    const closeModal = () => setModal({ ...modal, isOpen: false });

    const NavLink = ({ page, iconClass, label }) => (
      <li className={activePage === page ? 'active' : ''} onClick={() => {setActivePage(page); setIsMobileNavOpen(false);}}>
          <i className={`fas ${iconClass}`}></i> <span>{label}</span>
      </li>
    );

    const renderContent = () => {
        if (!adminInfo) return <div style={{textAlign:'center', marginTop:'50px'}}>Loading...</div>;
        const { instituteName, instituteId } = adminInfo;

        switch (activePage) {
            case 'dashboard': return <DashboardHome instituteName={instituteName} instituteId={instituteId} />;
            
            // ✅ FIXED: PASSING showModal TO ALL COMPONENTS
            case 'addDepartment': return <AddDepartment instituteId={instituteId} instituteName={instituteName} showModal={showModal} />;
            case 'addHOD': return <AddHOD instituteId={instituteId} instituteName={instituteName} showModal={showModal} />;
            case 'addTeacher': return <AddTeacher instituteId={instituteId} instituteName={instituteName} showModal={showModal} />;
            case 'addStudent': return <AddStudent instituteId={instituteId} instituteName={instituteName} showModal={showModal} />;
            case 'manageUsers': return <ManageInstituteUsers instituteId={instituteId} showModal={showModal} />;
            
            default: return <DashboardHome instituteName={instituteName} instituteId={instituteId} />;
        }
    };

    return (
        <div className="dashboard-container">
            {/* ✅ TOAST (For Success/Info) */}
            <Toaster position="top-right" reverseOrder={false} />

            {/* ✅ MODAL (For Delete Confirmation) */}
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
                <div className="logo-container"><img src="https://iili.io/KoAVeZg.md.png" alt="Logo" className="sidebar-logo"/><span className="logo-text">Acadex</span></div>
                {adminInfo && <div className="teacher-info"><h4>{adminInfo.firstName} {adminInfo.lastName}</h4><p>Institute Admin</p></div>}
                <ul className="menu">
                    <NavLink page="dashboard" iconClass="fa-tachometer-alt" label="Dashboard" />
                    <NavLink page="addDepartment" iconClass="fa-building" label="Departments" />
                    <NavLink page="addHOD" iconClass="fa-user-tie" label="Add HOD" />
                    <NavLink page="addTeacher" iconClass="fa-chalkboard-teacher" label="Add Teacher" />
                    <NavLink page="addStudent" iconClass="fa-user-graduate" label="Add Student" />
                    <NavLink page="manageUsers" iconClass="fa-users" label="Manage Users" />
                </ul>
                <div className="sidebar-footer"><button onClick={handleLogout} className="logout-btn"><i className="fas fa-sign-out-alt"></i><span>Logout</span></button></div>
            </aside>
            <main className="main-content">
                 <header className="mobile-header">
                    <button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}><i className="fas fa-bars"></i></button>
                    <div className="mobile-brand"><img src="https://iili.io/KoAVeZg.md.png" alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">AcadeX</span></div>
                    <div style={{width:'40px'}}></div>
                 </header>
                {renderContent()}
            </main>
        </div>
    );
}