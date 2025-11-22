import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db, sendPasswordResetEmail } from '../firebase';
import { doc, getDoc, collection, query, where, onSnapshot, deleteDoc } from "firebase/firestore";
import toast, { Toaster } from 'react-hot-toast'; 
import './Dashboard.css';

// ✅ Import Timetable Component
import ManageTimetable from './ManageTimetable';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function HODDashboard() {
    const [hodInfo, setHodInfo] = useState(null);
    const [studentRequests, setStudentRequests] = useState([]);
    const [deptUsers, setDeptUsers] = useState([]); 
    const [selectedRequestIds, setSelectedRequestIds] = useState([]);
    
    // Modal State for Confirmations
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'info' });

    const [activeTab, setActiveTab] = useState('dashboard');
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    
    // Teacher Form State
    const [teacherForm, setTeacherForm] = useState({ firstName: '', lastName: '', email: '', password: '', subject: '' });
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            if (!auth.currentUser) return;
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setHodInfo(data);
                
                // Fetch Pending Requests
                const qRequests = query(
                    collection(db, 'student_requests'), 
                    where('instituteId', '==', data.instituteId), 
                    where('department', '==', data.department), 
                    where('status', '==', 'pending')
                );
                onSnapshot(qRequests, (snap) => setStudentRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

                // Fetch Dept Users
                const qUsers = query(
                    collection(db, 'users'), 
                    where('instituteId', '==', data.instituteId), 
                    where('department', '==', data.department)
                );
                onSnapshot(qUsers, (snap) => setDeptUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
            }
        };
        init();
    }, []);

    // --- HELPER FUNCTIONS ---

    const confirmAction = (title, message, action, type = 'info') => {
        setModal({ isOpen: true, title, message, onConfirm: action, type });
    };

    const closeModal = () => setModal({ ...modal, isOpen: false });

    const toggleSelectAll = () => {
        if (selectedRequestIds.length === studentRequests.length) setSelectedRequestIds([]); 
        else setSelectedRequestIds(studentRequests.map(r => r.id)); 
    };

    const toggleSelectOne = (id) => {
        if (selectedRequestIds.includes(id)) setSelectedRequestIds(prev => prev.filter(itemId => itemId !== id));
        else setSelectedRequestIds(prev => [...prev, id]);
    };

    // --- ACTIONS ---

    const executeBulkApprove = async () => {
        closeModal();
        const toastId = toast.loading(`Approving ${selectedRequestIds.length} students...`);
        
        try {
            const promises = selectedRequestIds.map(async (id) => {
                const req = studentRequests.find(r => r.id === id);
                if (!req) return;
                
                // Use student's chosen password or generate a random one
                const finalPassword = req.password || Math.random().toString(36).slice(-8);
                
                // 1. Call Backend to Create User
                const response = await fetch(`${BACKEND_URL}/createUser`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: req.email, 
                        password: finalPassword, 
                        firstName: req.firstName, 
                        lastName: req.lastName, 
                        role: 'student', 
                        instituteId: req.instituteId, 
                        instituteName: req.instituteName, 
                        department: req.department, 
                        // ✅ Pass Year & Semester so they get the right Timetable
                        subject: null, // Students don't have subjects, but backend structure might expect the key
                        rollNo: req.rollNo,
                        extras: { 
                            collegeId: req.collegeId, 
                            year: req.year, 
                            semester: req.semester 
                        } 
                    })
                });

                if (!response.ok) throw new Error(`Failed: ${req.email}`);
                
                // 2. Send Welcome Email (Frontend)
                await sendPasswordResetEmail(auth, req.email);
                
                // 3. Delete Request
                await deleteDoc(doc(db, 'student_requests', id));
            });

            await Promise.all(promises);
            toast.success("Selected students approved!", { id: toastId });
            setSelectedRequestIds([]);

        } catch (err) { 
            toast.error("Error: " + err.message, { id: toastId });
        }
    };

    const executeSingleApprove = async (req) => {
        closeModal();
        const toastId = toast.loading(`Approving ${req.firstName}...`);
        try {
             const finalPassword = req.password || Math.random().toString(36).slice(-8);
             
             const response = await fetch(`${BACKEND_URL}/createUser`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: req.email, 
                    password: finalPassword, 
                    firstName: req.firstName, 
                    lastName: req.lastName, 
                    role: 'student', 
                    instituteId: req.instituteId, 
                    instituteName: req.instituteName, 
                    department: req.department, 
                    // ✅ Pass Year & Semester
                    subject: null,
                    rollNo: req.rollNo,
                    extras: { 
                        collegeId: req.collegeId, 
                        year: req.year, 
                        semester: req.semester 
                    } 
                })
            });

            if(!response.ok) throw new Error("Backend creation failed");
            
            await sendPasswordResetEmail(auth, req.email);
            await deleteDoc(doc(db, 'student_requests', req.id));
            
            toast.success("Student Approved!", { id: toastId });

        } catch(e) { 
            toast.error(e.message, { id: toastId });
        }
    };

    const executeReject = async (reqId) => {
        closeModal();
        const toastId = toast.loading("Rejecting...");
        try {
            await deleteDoc(doc(db, 'student_requests', reqId));
            toast.success("Application Rejected", { id: toastId });
        } catch (e) {
            toast.error("Error rejecting", { id: toastId });
        }
    };

    const handleAddTeacher = async (e) => {
        e.preventDefault(); 
        setLoading(true);
        const toastId = toast.loading("Adding Teacher...");

        try {
            const response = await fetch(`${BACKEND_URL}/createUser`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...teacherForm, 
                    role: 'teacher', 
                    instituteId: hodInfo.instituteId, 
                    instituteName: hodInfo.instituteName, 
                    department: hodInfo.department, 
                    subject: teacherForm.subject, // ✅ Pass Subject
                    extras: { qualification: 'Added by HOD' } 
                })
            });

            if (!response.ok) throw new Error("Failed to create teacher");

            await sendPasswordResetEmail(auth, teacherForm.email);
            
            toast.success(`Teacher ${teacherForm.firstName} added!`, { id: toastId });
            setTeacherForm({ firstName: '', lastName: '', email: '', password: '', subject: '' });

        } catch (error) { 
            toast.error("Error: " + error.message, { id: toastId });
        } finally { 
            setLoading(false); 
        }
    };

    const teachersList = deptUsers.filter(u => u.role === 'teacher');
    const studentsList = deptUsers.filter(u => u.role === 'student');

    const NavLink = ({ page, iconClass, label, count }) => (
        <li className={activeTab === page ? 'active' : ''} onClick={() => {setActiveTab(page); setIsMobileNavOpen(false);}}>
            <i className={`fas ${iconClass}`}></i> <span>{label}</span>
            {count > 0 && <span className="nav-badge">{count}</span>}
        </li>
    );

    return (
        <div className="dashboard-container">
           <Toaster 
    position="top-center" 
    reverseOrder={false}
    containerStyle={{
        zIndex: 99999 // ✅ Force high z-index directly in JS
    }}
/>

            {/* CONFIRMATION MODAL */}
            {modal.isOpen && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal-box">
                        <div className={`modal-icon ${modal.type === 'danger' ? 'icon-danger' : 'icon-info'}`}>
                            <i className={`fas ${modal.type === 'danger' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`}></i>
                        </div>
                        <h3>{modal.title}</h3>
                        <p>{modal.message}</p>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={closeModal}>Cancel</button>
                            <button className={`btn-primary ${modal.type === 'danger' ? 'btn-danger-solid' : ''}`} onClick={modal.onConfirm}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)}></div>}
            
            <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`}>
                <div className="logo-container"><img src="https://iili.io/KoAVeZg.md.png" alt="Logo" className="sidebar-logo"/><span className="logo-text">Acadex</span></div>
                {hodInfo && <div className="teacher-info"><h4>{hodInfo.firstName} (HOD)</h4><p>{hodInfo.department}</p></div>}
                
                <ul className="menu">
                    <NavLink page="dashboard" iconClass="fa-th-large" label="Dashboard" />
                    <NavLink page="requests" iconClass="fa-user-clock" label="Requests" count={studentRequests.length} />
                    <NavLink page="manage" iconClass="fa-users" label="Dept Users" />
                    
                    {/* ✅ TIMETABLE TAB */}
                    <NavLink page="timetable" iconClass="fa-calendar-alt" label="Timetable" />
                    
                    <NavLink page="addTeacher" iconClass="fa-chalkboard-teacher" label="Add Teacher" />
                </ul>
                <div className="sidebar-footer"><button className="logout-btn" onClick={() => signOut(auth).then(() => navigate('/'))}><i className="fas fa-sign-out-alt"></i> Logout</button></div>
            </aside>

            <main className="main-content">
                <header className="mobile-header">
                    <button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}><i className="fas fa-bars"></i></button>
                    <div className="mobile-brand"><img src="https://iili.io/KoAVeZg.md.png" alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">AcadeX</span></div>
                    <div style={{width:'40px'}}></div>
                </header>

                {/* --- DASHBOARD OVERVIEW --- */}
                {activeTab === 'dashboard' && (
                    <div className="content-section">
                        <h2 className="content-title">Department Overview</h2>
                        <div className="cards-grid">
                            <div className="card" style={{background: 'linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)', border: 'none'}}>
                                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                    <div className="icon-box-modern" style={{background:'white', color:'#2563eb'}}><i className="fas fa-user-graduate"></i></div>
                                    <div><h3 style={{margin:0, color:'#1e3a8a'}}>Students</h3><p style={{margin:0, fontSize:'32px', fontWeight:'800', color:'#1e40af'}}>{studentsList.length}</p></div>
                                </div>
                            </div>
                            <div className="card" style={{background: 'linear-gradient(135deg, #ecfdf5 0%, #a7f3d0 100%)', border: 'none'}}>
                                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                    <div className="icon-box-modern" style={{background:'white', color:'#059669'}}><i className="fas fa-chalkboard-teacher"></i></div>
                                    <div><h3 style={{margin:0, color:'#064e3b'}}>Teachers</h3><p style={{margin:0, fontSize:'32px', fontWeight:'800', color:'#065f46'}}>{teachersList.length}</p></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- STUDENT REQUESTS --- */}
                {activeTab === 'requests' && (
                    <div className="content-section">
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                            <h2 className="content-title">Student Applications</h2>
                            {selectedRequestIds.length > 0 && (
                                <button 
                                    onClick={() => confirmAction('Approve Selected?', `Approve ${selectedRequestIds.length} students?`, executeBulkApprove)} 
                                    className="btn-primary" 
                                    style={{width:'auto', padding:'8px 16px'}}
                                >
                                    {loading ? 'Processing...' : `Approve (${selectedRequestIds.length})`}
                                </button>
                            )}
                        </div>
                        <div className="card card-full-width">
                            <div className="table-wrapper">
                                <table className="attendance-table">
                                    <thead><tr><th style={{width:'40px'}}><input type="checkbox" className="custom-checkbox" checked={studentRequests.length > 0 && selectedRequestIds.length === studentRequests.length} onChange={toggleSelectAll}/></th><th>Name</th><th>Class</th><th>Roll No</th><th>Email</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {studentRequests.map(req => (
                                            <tr key={req.id} className={selectedRequestIds.includes(req.id) ? 'row-selected' : ''}>
                                                <td><input type="checkbox" className="custom-checkbox" checked={selectedRequestIds.includes(req.id)} onChange={() => toggleSelectOne(req.id)}/></td>
                                                <td>{req.firstName} {req.lastName}</td>
                                                <td><span className="status-badge-pill" style={{background:'#e0f2fe', color:'#0284c7'}}>{req.year || '-'}</span></td>
                                                <td>{req.rollNo}</td>
                                                <td>{req.email}</td>
                                                <td>
                                                    <div style={{display:'flex', gap:'8px'}}>
                                                        <button onClick={() => confirmAction('Approve?', `Approve ${req.firstName}?`, () => executeSingleApprove(req))} className="status-badge status-approved" style={{border:'none', cursor:'pointer'}}>Approve</button>
                                                        <button onClick={() => confirmAction('Reject?', `Reject ${req.firstName}?`, () => executeReject(req.id), 'danger')} className="status-badge status-denied" style={{border:'none', cursor:'pointer'}}>Reject</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {studentRequests.length === 0 && <tr><td colSpan="6" style={{textAlign:'center', padding:'30px', color:'#64748b'}}>No pending requests.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MANAGE USERS --- */}
                {activeTab === 'manage' && (
                    <div className="content-section">
                        <h2 className="content-title">Department Users</h2>
                        
                        {/* Teachers */}
                        <div className="card card-full-width" style={{marginBottom:'24px'}}>
                            <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px', borderBottom:'1px solid #f1f5f9', paddingBottom:'10px'}}>
                                <div className="icon-box-modern" style={{background:'#ecfdf5', color:'#059669', width:'32px', height:'32px', fontSize:'14px'}}><i className="fas fa-chalkboard-teacher"></i></div>
                                <h3 style={{margin:0}}>Teachers ({teachersList.length})</h3>
                            </div>
                            <div className="table-wrapper">
                                <table className="attendance-table"><thead><tr><th>Name</th><th>Email</th><th>Subject</th></tr></thead><tbody>{teachersList.map(t => (<tr key={t.id}><td style={{fontWeight:500}}>{t.firstName} {t.lastName}</td><td>{t.email}</td><td><span className="status-badge-pill" style={{background:'#e0f2fe', color:'#0369a1'}}>{t.subject}</span></td></tr>))}{teachersList.length === 0 && <tr><td colSpan="3" style={{textAlign:'center', color:'gray'}}>No teachers found.</td></tr>}</tbody></table>
                            </div>
                        </div>

                        {/* Students */}
                        <div className="card card-full-width">
                             <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px', borderBottom:'1px solid #f1f5f9', paddingBottom:'10px'}}>
                                <div className="icon-box-modern" style={{background:'#eff6ff', color:'#2563eb', width:'32px', height:'32px', fontSize:'14px'}}><i className="fas fa-user-graduate"></i></div>
                                <h3 style={{margin:0}}>Students ({studentsList.length})</h3>
                            </div>
                            <div className="table-wrapper">
                                <table className="attendance-table"><thead><tr><th>Roll No</th><th>Name</th><th>Class</th><th>Email</th></tr></thead><tbody>{studentsList.sort((a,b) => (a.rollNo || "").localeCompare(b.rollNo, undefined, {numeric: true})).map(s => (<tr key={s.id}><td style={{fontWeight:'bold', color:'#374151'}}>{s.rollNo}</td><td>{s.firstName} {s.lastName}</td><td><span className="status-badge-pill" style={{background:'#f3f4f6', color:'#374151'}}>{s.year || '-'}</span></td><td>{s.email}</td></tr>))}{studentsList.length === 0 && <tr><td colSpan="4" style={{textAlign:'center', color:'gray'}}>No students found.</td></tr>}</tbody></table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TIMETABLE --- */}
                {activeTab === 'timetable' && (
                    <ManageTimetable hodInfo={hodInfo} />
                )}

                {/* --- ADD TEACHER --- */}
                {activeTab === 'addTeacher' && (
                    <div className="content-section">
                        <h2 className="content-title">Add New Teacher</h2>
                        <div className="card">
                            <form onSubmit={handleAddTeacher}>
                                <div className="input-group"><label>First Name</label><input type="text" required value={teacherForm.firstName} onChange={e => setTeacherForm({...teacherForm, firstName: e.target.value})} /></div>
                                <div className="input-group"><label>Last Name</label><input type="text" required value={teacherForm.lastName} onChange={e => setTeacherForm({...teacherForm, lastName: e.target.value})} /></div>
                                <div className="input-group"><label>Subject</label><input type="text" placeholder="e.g. Data Structures" required value={teacherForm.subject} onChange={e => setTeacherForm({...teacherForm, subject: e.target.value})} /></div>
                                <div className="input-group"><label>Email</label><input type="email" required value={teacherForm.email} onChange={e => setTeacherForm({...teacherForm, email: e.target.value})} /></div>
                                <div className="input-group"><label>Temp Password</label><input type="password" required value={teacherForm.password} onChange={e => setTeacherForm({...teacherForm, password: e.target.value})} /></div>
                                <button className="btn-primary" disabled={loading}>{loading ? 'Adding...' : 'Add Teacher'}</button>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}