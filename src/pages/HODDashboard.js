import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db, sendPasswordResetEmail } from '../firebase';
import { doc, getDoc, collection, query, where, onSnapshot, deleteDoc } from "firebase/firestore";
import toast, { Toaster } from 'react-hot-toast'; 
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './Dashboard.css';

import ManageTimetable from './ManageTimetable';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function HODDashboard() {
    const [hodInfo, setHodInfo] = useState(null);
    const [studentRequests, setStudentRequests] = useState([]);
    const [deptUsers, setDeptUsers] = useState([]); 
    const [leaves, setLeaves] = useState([]);
    const [totalClasses, setTotalClasses] = useState(0);

    const [selectedRequestIds, setSelectedRequestIds] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]); 

    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'info' });
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    
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
                
                // 1. Fetch Department Stats (Total Classes Held)
                const statsDoc = await getDoc(doc(db, "department_stats", `${data.instituteId}_${data.department}`));
                if (statsDoc.exists()) setTotalClasses(statsDoc.data().totalClasses || 0);

                // 2. Fetch Pending Student Requests
                const qRequests = query(
                    collection(db, 'student_requests'), 
                    where('instituteId', '==', data.instituteId), 
                    where('department', '==', data.department), 
                    where('status', '==', 'pending')
                );
                onSnapshot(qRequests, (snap) => setStudentRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

                // 3. Fetch All Users (Teachers + Students)
                const qUsers = query(
                    collection(db, 'users'), 
                    where('instituteId', '==', data.instituteId), 
                    where('department', '==', data.department)
                );
                onSnapshot(qUsers, (snap) => setDeptUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

                // 4. Fetch Pending Leaves
                const qLeaves = query(
                    collection(db, 'leave_requests'),
                    where('instituteId', '==', data.instituteId),
                    where('department', '==', data.department),
                    where('status', '==', 'pending')
                );
                onSnapshot(qLeaves, (snap) => setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
            }
        };
        init();
    }, []);

    // --- ANALYTICS CALCULATIONS ---
    const studentsList = deptUsers.filter(u => u.role === 'student');
    const teachersList = deptUsers.filter(u => u.role === 'teacher');

    // Calculate Safe vs At-Risk Students
    const processedStudents = studentsList.map(s => {
        const attended = s.attendanceCount || 0;
        // Avoid division by zero
        const percentage = totalClasses > 0 ? (attended / totalClasses) * 100 : 100; 
        return { ...s, percentage };
    });

    const atRiskStudents = processedStudents.filter(s => s.percentage < 75);
    const safeStudents = processedStudents.filter(s => s.percentage >= 75);

    const chartData = [
        { name: 'Safe (>75%)', value: safeStudents.length, color: '#10b981' },
        { name: 'At Risk (<75%)', value: atRiskStudents.length, color: '#ef4444' },
    ];

    // --- HELPERS ---
    const confirmAction = (title, message, action, type = 'info') => {
        setModal({ isOpen: true, title, message, onConfirm: action, type });
    };
    const closeModal = () => setModal({ ...modal, isOpen: false });

    const toggleSelectUser = (id) => {
        if (selectedUserIds.includes(id)) setSelectedUserIds(prev => prev.filter(i => i !== id));
        else setSelectedUserIds(prev => [...prev, id]);
    };

    const toggleSelectRequestOne = (id) => {
        if (selectedRequestIds.includes(id)) setSelectedRequestIds(prev => prev.filter(i => i !== id));
        else setSelectedRequestIds(prev => [...prev, id]);
    };

    const toggleSelectRequestAll = () => {
        if (selectedRequestIds.length === studentRequests.length) setSelectedRequestIds([]); 
        else setSelectedRequestIds(studentRequests.map(r => r.id)); 
    };

    // --- ACTIONS ---

    // 1. Delete Users
    const handleDeleteUsers = () => {
        if (selectedUserIds.length === 0) return;
        
        confirmAction('Delete Users?', `Delete ${selectedUserIds.length} users permanently?`, async () => {
            closeModal();
            const toastId = toast.loading("Deleting...");
            try {
                await fetch(`${BACKEND_URL}/deleteUsers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userIds: selectedUserIds })
                });
                toast.success("Users Deleted!", { id: toastId });
                setSelectedUserIds([]);
            } catch (error) {
                toast.error("Delete Failed", { id: toastId });
            }
        }, 'danger');
    };

    // 2. Handle Leave
    const handleLeaveAction = async (leaveId, status) => {
        const toastId = toast.loading("Processing...");
        try {
            await fetch(`${BACKEND_URL}/actionLeave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leaveId, status })
            });
            toast.success(`Leave ${status}`, { id: toastId });
        } catch (e) { toast.error("Failed", { id: toastId }); }
    };

    // 3. Bulk Approve Students
    const executeBulkApprove = async () => {
        closeModal();
        const toastId = toast.loading(`Approving ${selectedRequestIds.length} students...`);
        try {
            const promises = selectedRequestIds.map(async (id) => {
                const req = studentRequests.find(r => r.id === id);
                if (!req) return;
                
                const finalPassword = req.password || Math.random().toString(36).slice(-8);
                
                // Create User
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
                        subject: null,
                        rollNo: req.rollNo,
                        extras: { collegeId: req.collegeId, year: req.year, semester: req.semester } 
                    })
                });
                if (!response.ok) throw new Error(`Failed: ${req.email}`);
                
                // Send Email & Delete Request
                await sendPasswordResetEmail(auth, req.email);
                await deleteDoc(doc(db, 'student_requests', id));
            });

            await Promise.all(promises);
            toast.success("Selected students approved!", { id: toastId });
            setSelectedRequestIds([]);
        } catch (err) { 
            toast.error("Error: " + err.message, { id: toastId });
        }
    };

    // 4. Single Approve
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
                    subject: null,
                    rollNo: req.rollNo,
                    extras: { collegeId: req.collegeId, year: req.year, semester: req.semester } 
                })
            });

            if(!response.ok) throw new Error("Backend creation failed");
            await sendPasswordResetEmail(auth, req.email);
            await deleteDoc(doc(db, 'student_requests', req.id));
            
            toast.success("Student Approved!", { id: toastId });
        } catch(e) { toast.error(e.message, { id: toastId }); }
    };

    // 5. Reject Request
    const executeReject = async (reqId) => {
        closeModal();
        const toastId = toast.loading("Rejecting...");
        try {
            await deleteDoc(doc(db, 'student_requests', reqId));
            toast.success("Rejected", { id: toastId });
        } catch (e) { toast.error("Error rejecting", { id: toastId }); }
    };

    // 6. Add Teacher
    const handleAddTeacher = async (e) => {
        e.preventDefault(); 
        setLoading(true);
        const toastId = toast.loading("Adding Teacher...");
        try {
            await fetch(`${BACKEND_URL}/createUser`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...teacherForm, 
                    role: 'teacher', 
                    instituteId: hodInfo.instituteId, 
                    instituteName: hodInfo.instituteName, 
                    department: hodInfo.department, 
                    subject: teacherForm.subject, 
                    extras: { qualification: 'Added by HOD' } 
                })
            });
            await sendPasswordResetEmail(auth, teacherForm.email);
            toast.success(`Teacher Added!`, { id: toastId });
            setTeacherForm({ firstName: '', lastName: '', email: '', password: '', subject: '' });
        } catch (error) { toast.error("Error: " + error.message, { id: toastId }); } finally { setLoading(false); }
    };

    const NavLink = ({ page, iconClass, label, count }) => (
        <li className={activeTab === page ? 'active' : ''} onClick={() => {setActiveTab(page); setIsMobileNavOpen(false);}}>
            <i className={`fas ${iconClass}`} style={{ width: '20px', textAlign: 'center' }}></i> 
            <span>{label}</span>
            {count > 0 && <span className="nav-badge">{count}</span>}
        </li>
    );

    // --- RENDER LOGIC ---
    return (
        <div className="dashboard-container">
            <Toaster position="top-right" reverseOrder={false} />

            {modal.isOpen && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal-box">
                        <h3>{modal.title}</h3> <p>{modal.message}</p>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={closeModal}>Cancel</button>
                            <button className="btn-primary" onClick={modal.onConfirm}>Confirm</button>
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
                    <NavLink page="analytics" iconClass="fa-chart-pie" label="Analytics" /> 
                    <NavLink page="leaves" iconClass="fa-calendar-check" label="Leave Requests" count={leaves.length} />
                    <NavLink page="requests" iconClass="fa-user-clock" label="Student Requests" count={studentRequests.length} />
                    <NavLink page="manage" iconClass="fa-users" label="Dept Users" />
                    <NavLink page="timetable" iconClass="fa-calendar-alt" label="Timetable" />
                    <NavLink page="addTeacher" iconClass="fa-chalkboard-teacher" label="Add Teacher" />
                </ul>
                <div className="sidebar-footer"><button className="logout-btn" onClick={() => signOut(auth).then(() => navigate('/'))}>Logout</button></div>
            </aside>

            <main className="main-content">
                <header className="mobile-header">
                    <button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}><i className="fas fa-bars"></i></button>
                    <div className="mobile-brand"><img src="https://iili.io/KoAVeZg.md.png" alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">AcadeX</span></div>
                    <div style={{width:'40px'}}></div>
                </header>

                {/* TAB 1: DASHBOARD OVERVIEW */}
                {activeTab === 'dashboard' && (
                    <div className="content-section">
                        <h2 className="content-title">Overview</h2>
                        <div className="cards-grid">
                            <div className="card" style={{background: 'linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)', border: 'none'}}>
                                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                    <div className="icon-box-modern" style={{background:'white', color:'#2563eb', width:'50px', height:'50px', fontSize:'20px'}}>
                                        <i className="fas fa-user-graduate"></i>
                                    </div>
                                    <div><h3 style={{margin:0, color:'#1e3a8a', fontSize:'16px'}}>Students</h3><p style={{margin:0, fontSize:'36px', fontWeight:'800', color:'#1e40af', lineHeight: '1.2'}}>{studentsList.length}</p></div>
                                </div>
                            </div>
                            <div className="card" style={{background: 'linear-gradient(135deg, #ecfdf5 0%, #a7f3d0 100%)', border: 'none'}}>
                                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                    <div className="icon-box-modern" style={{background:'white', color:'#059669', width:'50px', height:'50px', fontSize:'20px'}}>
                                        <i className="fas fa-chalkboard-teacher"></i>
                                    </div>
                                    <div><h3 style={{margin:0, color:'#064e3b', fontSize:'16px'}}>Teachers</h3><p style={{margin:0, fontSize:'36px', fontWeight:'800', color:'#065f46', lineHeight: '1.2'}}>{teachersList.length}</p></div>
                                </div>
                            </div>
                        </div>
                        {/* Recent Analytics Preview */}
                        <div className="card" style={{marginTop:'20px', height:'300px'}}>
                            <h3>Attendance Health</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* TAB 2: ANALYTICS */}
                {activeTab === 'analytics' && (
                    <div className="content-section">
                        <h2 className="content-title">Attendance Analytics</h2>
                        <div className="cards-grid" style={{gridTemplateColumns: '1fr 1fr'}}>
                            <div className="card">
                                <h3 style={{color:'#ef4444'}}>⚠️ Low Attendance ({atRiskStudents.length})</h3>
                                <div className="table-wrapper" style={{maxHeight:'400px', overflowY:'auto'}}>
                                    <table className="attendance-table">
                                        <thead><tr><th>Name</th><th>%</th></tr></thead>
                                        <tbody>
                                            {atRiskStudents.map(s => (
                                                <tr key={s.id}>
                                                    <td>{s.firstName} {s.lastName}</td>
                                                    <td><span className="status-badge-pill" style={{background:'#fef2f2', color:'#dc2626'}}>{s.percentage.toFixed(0)}%</span></td>
                                                </tr>
                                            ))}
                                            {atRiskStudents.length === 0 && <tr><td colSpan="2" style={{textAlign:'center', color:'green'}}>All safe!</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="card">
                                <h3 style={{color:'#10b981'}}>✅ Eligible ({safeStudents.length})</h3>
                                <div className="table-wrapper" style={{maxHeight:'400px', overflowY:'auto'}}>
                                     <table className="attendance-table">
                                        <thead><tr><th>Name</th><th>%</th></tr></thead>
                                        <tbody>
                                            {safeStudents.map(s => (
                                                <tr key={s.id}>
                                                    <td>{s.firstName} {s.lastName}</td>
                                                    <td><span className="status-badge-pill" style={{background:'#ecfdf5', color:'#059669'}}>{s.percentage.toFixed(0)}%</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: LEAVES */}
                {activeTab === 'leaves' && (
                    <div className="content-section">
                        <h2 className="content-title">Leave Requests</h2>
                        <div className="card card-full-width">
                            <div className="table-wrapper">
                                <table className="attendance-table">
                                    <thead><tr><th>Name</th><th>Reason</th><th>Dates</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {leaves.map(l => (
                                            <tr key={l.id}>
                                                <td>{l.studentName}</td><td>{l.reason}</td><td>{l.fromDate} - {l.toDate}</td>
                                                <td>
                                                    <div style={{display:'flex', gap:'8px'}}>
                                                        <button onClick={() => handleLeaveAction(l.id, 'approved')} className="status-badge status-approved" style={{border:'none', cursor:'pointer'}}>Approve</button>
                                                        <button onClick={() => handleLeaveAction(l.id, 'rejected')} className="status-badge status-denied" style={{border:'none', cursor:'pointer'}}>Reject</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {leaves.length === 0 && <tr><td colSpan="4" style={{textAlign:'center', padding:'20px', color:'gray'}}>No pending leaves.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 4: REQUESTS */}
                {activeTab === 'requests' && (
                    <div className="content-section">
                        <h2 className="content-title">Student Applications</h2>
                        <div className="card card-full-width">
                            <div className="table-wrapper">
                                <table className="attendance-table">
                                    <thead><tr><th style={{width:'40px'}}><input type="checkbox" className="custom-checkbox" checked={studentRequests.length > 0 && selectedRequestIds.length === studentRequests.length} onChange={toggleSelectRequestAll}/></th><th>Name</th><th>Class</th><th>College ID</th><th>Roll No</th><th>Email</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {studentRequests.map(req => (
                                            <tr key={req.id} className={selectedRequestIds.includes(req.id) ? 'row-selected' : ''}>
                                                <td><input type="checkbox" className="custom-checkbox" checked={selectedRequestIds.includes(req.id)} onChange={() => toggleSelectRequestOne(req.id)}/></td>
                                                <td>{req.firstName} {req.lastName}</td>
                                                <td><span className="status-badge-pill" style={{background:'#e0f2fe', color:'#0284c7'}}>{req.year || '-'}</span></td>
                                                <td style={{fontWeight:'bold'}}>{req.collegeId}</td>
                                                <td>{req.rollNo}</td>
                                                <td>{req.email}</td>
                                                <td>
                                                    <div style={{display:'flex', gap:'8px'}}>
                                                        <button onClick={() => confirmAction('Approve?', `Approve ${req.firstName}?`, () => executeSingleApprove(req))} className="status-badge status-approved">Approve</button>
                                                        <button onClick={() => confirmAction('Reject?', `Reject?`, () => executeReject(req.id), 'danger')} className="status-badge status-denied">Reject</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {studentRequests.length === 0 && <tr><td colSpan="7" style={{textAlign:'center', padding:'30px', color:'#64748b'}}>No pending requests.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            {selectedRequestIds.length > 0 && <button onClick={() => confirmAction('Approve Selected?', `Approve ${selectedRequestIds.length} students?`, executeBulkApprove)} className="btn-primary" style={{marginTop:'15px'}}>Approve Selected</button>}
                        </div>
                    </div>
                )}

                {/* TAB 5: MANAGE USERS */}
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
                                <table className="attendance-table"><thead><tr><th style={{width:'40px'}}></th><th>Name</th><th>Email</th><th>Subject</th></tr></thead><tbody>{teachersList.map(t => (<tr key={t.id}><td><input type="checkbox" checked={selectedUserIds.includes(t.id)} onChange={() => toggleSelectUser(t.id)} className="custom-checkbox"/></td><td>{t.firstName} {t.lastName}</td><td>{t.email}</td><td><span className="status-badge-pill">{t.subject}</span></td></tr>))}</tbody></table>
                            </div>
                        </div>
                        {/* Students */}
                        <div className="card card-full-width">
                             <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px', borderBottom:'1px solid #f1f5f9', paddingBottom:'10px'}}>
                                <div className="icon-box-modern" style={{background:'#eff6ff', color:'#2563eb', width:'32px', height:'32px', fontSize:'14px'}}><i className="fas fa-user-graduate"></i></div>
                                <h3 style={{margin:0}}>Students ({studentsList.length})</h3>
                            </div>
                            <div className="table-wrapper">
                                <table className="attendance-table"><thead><tr><th style={{width:'40px'}}></th><th>Roll No</th><th>Name</th><th>Class</th><th>Email</th></tr></thead><tbody>{studentsList.sort((a,b) => (a.rollNo || "").localeCompare(b.rollNo, undefined, {numeric: true})).map(s => (<tr key={s.id}><td><input type="checkbox" checked={selectedUserIds.includes(s.id)} onChange={() => toggleSelectUser(s.id)} className="custom-checkbox"/></td><td style={{fontWeight:'bold'}}>{s.rollNo}</td><td>{s.firstName} {s.lastName}</td><td><span className="status-badge-pill">{s.year || '-'}</span></td><td>{s.email}</td></tr>))}</tbody></table>
                            </div>
                        </div>
                        
                        {/* ✅ Floating Delete Button */}
                        {selectedUserIds.length > 0 && (
                            <button className="floating-delete-btn" onClick={handleDeleteUsers}>
                                <i className="fas fa-trash-alt"></i> Delete ({selectedUserIds.length})
                            </button>
                        )}
                    </div>
                )}

                {/* TAB 6: TIMETABLE */}
                {activeTab === 'timetable' && <ManageTimetable hodInfo={hodInfo} />}
                
                {/* TAB 7: ADD TEACHER */}
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