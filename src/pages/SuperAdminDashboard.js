import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db, sendPasswordResetEmail } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore'; 
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion'; 
import './Dashboard.css'; 
import logo from "../assets/logo.png";

// ✅ 2FA Imports REMOVED completely to prevent login crashes

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// --- CUSTOM MODAL COMPONENT ---
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, isDanger }) => {
    if (!isOpen) return null;
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: isDanger ? '#fee2e2' : '#f3f4f6', color: isDanger ? '#dc2626' : '#4b5563', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 20px auto' }}>
                    <i className={`fas ${isDanger ? 'fa-exclamation-triangle' : 'fa-info-circle'}`}></i>
                </div>
                <h3 style={{ margin: '0 0 10px 0', color: '#111827', fontSize:'18px' }}>{title}</h3>
                <p style={{ margin: '0 0 25px 0', color: '#6b7280', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-line' }}>{message}</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Cancel</button>
                    <button onClick={onConfirm} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: isDanger ? '#dc2626' : '#2563eb', cursor: 'pointer', fontWeight: '600', color: 'white', boxShadow: isDanger ? '0 4px 14px 0 rgba(220, 38, 38, 0.39)' : '0 4px 14px 0 rgba(37, 99, 235, 0.39)' }}>{isDanger ? 'Yes, Delete' : 'Confirm'}</button>
                </div>
            </motion.div>
        </div>
    );
};

export default function SuperAdminDashboard() {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    
    // ✅ REMOVED adminProfile state (was causing issues)
    const [activeTab, setActiveTab] = useState('applications'); 

    const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: false });
    const navigate = useNavigate();

    // 1. Fetch Applications
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "applications"), (snap) => {
            setApplications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // ✅ REMOVED: The useEffect that fetched user profile for 2FA

    const openConfirm = (title, message, onConfirm, isDanger = false) => {
        setModalConfig({ isOpen: true, title, message, onConfirm, isDanger });
    };
    const closeConfirm = () => setModalConfig({ ...modalConfig, isOpen: false });

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
        <div className="dashboard-container">
            <Toaster position="top-center" reverseOrder={false} />
            <AnimatePresence>{modalConfig.isOpen && <ConfirmModal {...modalConfig} onClose={closeConfirm} />}</AnimatePresence>
            {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)}></div>}

            <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`}>
                <div className="logo-container"><img src={logo} alt="Logo" className="sidebar-logo"/><span className="logo-text">AcadeX</span></div>
                <div className="teacher-info"><h4>Super Admin</h4><p>Platform Manager</p></div>
                <ul className="menu">
                    <li className={activeTab === 'applications' ? 'active' : ''} onClick={() => { setActiveTab('applications'); setIsMobileNavOpen(false); }}>
                        <i className="fas fa-shield-alt" style={{width:'20px'}}></i><span>Applications</span>
                    </li>
                    <li className={activeTab === 'security' ? 'active' : ''} onClick={() => { setActiveTab('security'); setIsMobileNavOpen(false); }}>
                        <i className="fas fa-user-shield" style={{width:'20px'}}></i><span>My Security</span>
                    </li>
                </ul>
                <div className="sidebar-footer"><button onClick={() => signOut(auth).then(() => navigate('/'))} className="logout-btn"><i className="fas fa-sign-out-alt"></i><span>Logout</span></button></div>
            </aside>

            <main className="main-content">
                <header className="mobile-header">
                    <button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}><i className="fas fa-bars"></i></button>
                    <div className="mobile-brand"><img src={logo} alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">AcadeX</span></div>
                    <div style={{width:'40px'}}></div>
                </header>

                {activeTab === 'security' ? (
                    <div className="content-section">
                        <h2 className="content-title">Super Admin Security</h2>
                        <div className="cards-grid">
                            <div className="card">
                                <h3>My Profile</h3>
                                <p><strong>Role:</strong> Super Admin</p>
                                <p><strong>Email:</strong> {auth.currentUser?.email}</p>
                                <p><strong>Status:</strong> Active</p>
                            </div>
                            {/* ✅ 2FA COMPONENT REMOVED COMPLETELY */}
                            <div className="card" style={{opacity: 0.6}}>
                                <h3>Security Settings</h3>
                                <p>Two-Factor Authentication is currently disabled for maintenance.</p>
                            </div>
                        </div>
                    </div>
                ) : (
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
        </div>
    );
}