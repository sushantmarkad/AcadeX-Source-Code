import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db, sendPasswordResetEmail } from '../firebase';
// ✅ Updated imports to include addDoc and serverTimestamp for Announcements
import { doc, getDoc, collection, query, where, onSnapshot, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import toast, { Toaster } from 'react-hot-toast';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import logo from "../assets/logo.png";
import './Dashboard.css';

import ManageTimetable from './ManageTimetable';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function HODDashboard() {
    const [hodInfo, setHodInfo] = useState(null);
    const [studentRequests, setStudentRequests] = useState([]);
    const [deptUsers, setDeptUsers] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [totalClasses, setTotalClasses] = useState(0);
    const [searchQuery, setSearchQuery] = useState(""); // Search for Analytics

    const [selectedRequestIds, setSelectedRequestIds] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]);

    // ✅ Added Announcement State
    const [announcements, setAnnouncements] = useState([]);
    const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', targetYear: 'All' });

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

                // Fetch Stats
                const statsDoc = await getDoc(doc(db, "department_stats", `${data.instituteId}_${data.department}`));
                if (statsDoc.exists()) setTotalClasses(statsDoc.data().totalClasses || 0);

                // Fetch Requests
                const qRequests = query(collection(db, 'student_requests'), where('instituteId', '==', data.instituteId), where('department', '==', data.department), where('status', '==', 'pending'));
                onSnapshot(qRequests, (snap) => setStudentRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

                // Fetch Users
                const qUsers = query(collection(db, 'users'), where('instituteId', '==', data.instituteId), where('department', '==', data.department));
                onSnapshot(qUsers, (snap) => setDeptUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

                // Fetch Leaves
                const qLeaves = query(collection(db, 'leave_requests'), where('instituteId', '==', data.instituteId), where('department', '==', data.department), where('status', '==', 'pending'));
                onSnapshot(qLeaves, (snap) => setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

                // ✅ Fetch Announcements
                const qAnnouncements = query(collection(db, 'announcements'), where('instituteId', '==', data.instituteId), where('department', '==', data.department));
                onSnapshot(qAnnouncements, (snap) => {
                    const annData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    // Sort by createdAt descending (newest first)
                    annData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                    setAnnouncements(annData);
                });
            }
        };
        init();
    }, []);

    // --- ANALYTICS CALCULATIONS ---
    const studentsList = deptUsers.filter(u => u.role === 'student');
    const teachersList = deptUsers.filter(u => u.role === 'teacher');

    const processedStudents = studentsList.map(s => {
        const attended = s.attendanceCount || 0;
        const percentage = totalClasses > 0 ? (attended / totalClasses) * 100 : 100;
        return { ...s, percentage };
    });

    const atRiskStudents = processedStudents.filter(s => s.percentage < 75);
    const safeStudents = processedStudents.filter(s => s.percentage >= 75);

    const filteredDefaulters = atRiskStudents.filter(s =>
        s.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNo.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

    // ✅ Handle Post Announcement
    const handlePostAnnouncement = async (e) => {
        e.preventDefault();
        const toastId = toast.loading("Posting...");
        try {
            await addDoc(collection(db, 'announcements'), {
                ...announcementForm,
                instituteId: hodInfo.instituteId,
                department: hodInfo.department,
                teacherName: `${hodInfo.firstName} ${hodInfo.lastName} (HOD)`,
                role: 'hod',
                createdAt: serverTimestamp()
            });
            toast.success("Announcement Sent!", { id: toastId });
            setAnnouncementForm({ title: '', message: '', targetYear: 'All' });
        } catch (err) {
            toast.error("Failed to post.", { id: toastId });
        }
    };

    // ✅ Handle Delete Announcement
    const handleDeleteAnnouncement = async (id) => {
        if (!window.confirm("Delete this announcement?")) return;
        try {
            await deleteDoc(doc(db, 'announcements', id));
            toast.success("Deleted.");
        } catch (e) { toast.error("Failed."); }
    };

    // 2. Send Notice Action
    const handleSendNotice = (student) => {
        toast.success(`Notice sent to ${student.firstName} (${student.email})`, {
            icon: '📨',
            style: { border: '1px solid #3b82f6', color: '#1e3a8a', background: '#eff6ff' }
        });
        // In a real app, call backend API to send email here
    };

    const handleDeleteUsers = () => {
        if (selectedUserIds.length === 0) return;
        confirmAction('Delete Users?', `Delete ${selectedUserIds.length} users permanently?`, async () => {
            closeModal();
            const toastId = toast.loading("Deleting...");
            try {
                await fetch(`${BACKEND_URL}/deleteUsers`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userIds: selectedUserIds })
                });
                toast.success("Users Deleted!", { id: toastId });
                setSelectedUserIds([]);
            } catch (error) { toast.error("Delete Failed", { id: toastId }); }
        }, 'danger');
    };

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

    const executeBulkApprove = async () => {
        closeModal();
        const toastId = toast.loading(`Approving ${selectedRequestIds.length} students...`);
        try {
            const promises = selectedRequestIds.map(async (id) => {
                const req = studentRequests.find(r => r.id === id);
                if (!req) return;
                const finalPassword = req.password || Math.random().toString(36).slice(-8);

                const response = await fetch(`${BACKEND_URL}/createUser`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: req.email, password: finalPassword, firstName: req.firstName, lastName: req.lastName, role: 'student', instituteId: req.instituteId, instituteName: req.instituteName, department: req.department,
                        subject: null, rollNo: req.rollNo,
                        extras: { collegeId: req.collegeId, year: req.year, semester: req.semester }
                    })
                });
                if (!response.ok) throw new Error(`Failed: ${req.email}`);
                await sendPasswordResetEmail(auth, req.email);
                await deleteDoc(doc(db, 'student_requests', id));
            });
            await Promise.all(promises);
            toast.success("Selected students approved!", { id: toastId });
            setSelectedRequestIds([]);
        } catch (err) { toast.error("Error: " + err.message, { id: toastId }); }
    };

    const executeSingleApprove = async (req) => {
        closeModal();
        const toastId = toast.loading(`Approving ${req.firstName}...`);
        try {
            const finalPassword = req.password || Math.random().toString(36).slice(-8);
            const response = await fetch(`${BACKEND_URL}/createUser`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: req.email, password: finalPassword, firstName: req.firstName, lastName: req.lastName, role: 'student', instituteId: req.instituteId, instituteName: req.instituteName, department: req.department,
                    subject: null, rollNo: req.rollNo,
                    extras: { collegeId: req.collegeId, year: req.year, semester: req.semester }
                })
            });

            if (!response.ok) throw new Error("Backend creation failed");
            await sendPasswordResetEmail(auth, req.email);
            await deleteDoc(doc(db, 'student_requests', req.id));
            toast.success("Student Approved!", { id: toastId });
        } catch (e) { toast.error(e.message, { id: toastId }); }
    };

    const executeReject = async (reqId) => {
        closeModal();
        const toastId = toast.loading("Rejecting...");
        try {
            await deleteDoc(doc(db, 'student_requests', reqId));
            toast.success("Rejected", { id: toastId });
        } catch (e) { toast.error("Error rejecting", { id: toastId }); }
    };

    const handleAddTeacher = async (e) => {
        e.preventDefault(); setLoading(true);
        const toastId = toast.loading("Adding Teacher...");
        try {
            await fetch(`${BACKEND_URL}/createUser`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...teacherForm, role: 'teacher', instituteId: hodInfo.instituteId, instituteName: hodInfo.instituteName, department: hodInfo.department, subject: teacherForm.subject, extras: { qualification: 'Added by HOD' } })
            });
            await sendPasswordResetEmail(auth, teacherForm.email);
            toast.success(`Teacher Added!`, { id: toastId });
            setTeacherForm({ firstName: '', lastName: '', email: '', password: '', subject: '' });
        } catch (error) { toast.error("Error: " + error.message, { id: toastId }); } finally { setLoading(false); }
    };

    const NavLink = ({ page, iconClass, label, count }) => (
        <li className={activeTab === page ? 'active' : ''} onClick={() => { setActiveTab(page); setIsMobileNavOpen(false); }}>
            <i className={`fas ${iconClass}`} style={{ width: '20px', textAlign: 'center' }}></i>
            <span>{label}</span>
            {count > 0 && <span className="nav-badge">{count}</span>}
        </li>
    );

    return (
        <div className="dashboard-container">
           <Toaster 
            position="bottom-center" 
            toastOptions={{ duration: 4000, style: { background: '#1e293b', color: '#fff', marginBottom: '20px' } }} 
        />

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
                <div className="logo-container"><img src={logo} alt="Logo" className="sidebar-logo" /><span className="logo-text">Acadex</span></div>
                {hodInfo && <div className="teacher-info"><h4>{hodInfo.firstName} (HOD)</h4><p>{hodInfo.department}</p></div>}
                <ul className="menu">
                    <NavLink page="dashboard" iconClass="fa-th-large" label="Dashboard" />
                    <NavLink page="analytics" iconClass="fa-chart-pie" label="Analytics" />
                    {/* ✅ Added Announcements Tab */}
                    <NavLink page="announcements" iconClass="fa-bullhorn" label="Announcements" />
                    <NavLink page="leaves" iconClass="fa-calendar-check" label="Leave Requests" count={leaves.length} />
                    <NavLink page="requests" iconClass="fa-user-clock" label="Applications" count={studentRequests.length} />
                    <NavLink page="manage" iconClass="fa-users" label="Dept Users" />
                    <NavLink page="timetable" iconClass="fa-calendar-alt" label="Timetable" />
                    <NavLink page="addTeacher" iconClass="fa-chalkboard-teacher" label="Add Teacher" />
                </ul>
                <div className="sidebar-footer">
                    {/* 1. Fixed Logout Button */}
                    <button className="logout-btn" onClick={() => signOut(auth).then(() => navigate('/'))}>
                        <i className="fas fa-sign-out-alt" style={{ marginRight: '10px' }}></i> Logout
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <header className="mobile-header">
                    <button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}><i className="fas fa-bars"></i></button>
                    <div className="mobile-brand"><img src={logo} alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">AcadeX</span></div>
                    <div style={{ width: '40px' }}></div>
                </header>

                {activeTab === 'dashboard' && (
                    <div className="content-section">
                        <h2 className="content-title">Overview</h2>
                        <div className="cards-grid">
                            <div className="card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)', border: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div className="icon-box-modern" style={{ background: 'white', color: '#2563eb', width: '50px', height: '50px', fontSize: '20px' }}><i className="fas fa-user-graduate"></i></div>
                                    <div><h3 style={{ margin: 0, color: '#1e3a8a', fontSize: '16px' }}>Students</h3><p style={{ margin: 0, fontSize: '36px', fontWeight: '800', color: '#1e40af', lineHeight: '1.2' }}>{studentsList.length}</p></div>
                                </div>
                            </div>
                            <div className="card" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #a7f3d0 100%)', border: 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div className="icon-box-modern" style={{ background: 'white', color: '#059669', width: '50px', height: '50px', fontSize: '20px' }}><i className="fas fa-chalkboard-teacher"></i></div>
                                    <div><h3 style={{ margin: 0, color: '#064e3b', fontSize: '16px' }}>Teachers</h3><p style={{ margin: 0, fontSize: '36px', fontWeight: '800', color: '#065f46', lineHeight: '1.2' }}>{teachersList.length}</p></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="content-section">
                        <h2 className="content-title">Attendance Analytics</h2>
                        {/* MODERN SEARCH BAR */}
                        <div className="search-box-wrapper">
                            <i className="fas fa-search search-icon"></i>
                            <input
                                type="text"
                                placeholder="Search by name or roll no..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input-modern"
                            />
                        </div>

                        <div className="cards-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            {/* 3. Modern Donut Chart with Fixed Legend */}
                            <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <h3 style={{ alignSelf: 'flex-start', marginBottom: '10px' }}>Overview</h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={70}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Defaulters List */}
                            <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
                                <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                                    ⚠️ Defaulters List <span className="nav-badge" style={{ background: '#ef4444' }}>{filteredDefaulters.length}</span>
                                </h3>
                                <div className="table-wrapper" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                                    <table className="attendance-table">
                                        <thead><tr><th>Name</th><th>%</th><th>Action</th></tr></thead>
                                        <tbody>
                                            {filteredDefaulters.map(s => (
                                                <tr key={s.id}>
                                                    <td>
                                                        <div style={{ fontWeight: '600' }}>{s.firstName} {s.lastName}</div>
                                                        {/* SHOW YEAR */}
                                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                            {s.rollNo} • <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{s.year || 'N/A'}</span>
                                                        </div>
                                                    </td>
                                                    <td><span className="status-badge-pill" style={{ background: '#fef2f2', color: '#dc2626' }}>{s.percentage.toFixed(0)}%</span></td>
                                                    <td>
                                                        {/* 2. Send Notice Button */}
                                                        <button
                                                            onClick={() => handleSendNotice(s)}
                                                            className="btn-action"
                                                            style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', fontSize: '12px', padding: '4px 10px' }}
                                                        >
                                                            Send Notice
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredDefaulters.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: 'green' }}>All students are safe!</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ✅ ADDED ANNOUNCEMENTS SECTION */}
                {activeTab === 'announcements' && (
                    <div className="content-section">
                        <h2 className="content-title">📢 Announcements</h2>
                        <p className="content-subtitle">Broadcast messages to specific years or the whole department.</p>
                        <div className="cards-grid">
                            {/* Form */}
                            <div className="card">
                                <h3>Create Announcement</h3>
                                <form onSubmit={handlePostAnnouncement} style={{ marginTop: '15px' }}>
                                    <div className="input-group">
                                        <label>Target Audience</label>
                                        <select value={announcementForm.targetYear} onChange={e => setAnnouncementForm({ ...announcementForm, targetYear: e.target.value })} required>
                                            <option value="All">All Students</option>
                                            <option value="FE">FE (First Year)</option>
                                            <option value="SE">SE (Second Year)</option>
                                            <option value="TE">TE (Third Year)</option>
                                            <option value="BE">BE (Final Year)</option>
                                        </select>
                                    </div>
                                    <div className="input-group"><label>Title</label><input type="text" required value={announcementForm.title} onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })} /></div>
                                    <div className="input-group"><label>Message</label><textarea className="modern-input" rows="3" required value={announcementForm.message} onChange={e => setAnnouncementForm({ ...announcementForm, message: e.target.value })} /></div>
                                    <button className="btn-primary">Post</button>
                                </form>
                            </div>

                            {/* History */}
                            <div className="card">
                                <h3>History</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto', marginTop: '10px' }}>
                                    {announcements.map(a => (
                                        <div key={a.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', position: 'relative' }}>
                                            <span className="status-badge-pill" style={{ fontSize: '10px', marginBottom: '5px' }}>{a.targetYear === 'All' ? 'Everyone' : a.targetYear}</span>
                                            <h4 style={{ margin: '0 0 5px 0' }}>{a.title}</h4>
                                            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>{a.message}</p>
                                            <button onClick={() => handleDeleteAnnouncement(a.id)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><i className="fas fa-trash"></i></button>
                                        </div>
                                    ))}
                                    {announcements.length === 0 && <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No announcements.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'leaves' && (
                    <div className="content-section">
                        <h2 className="content-title">Leave Requests</h2>
                        <div className="card card-full-width">
                            <div className="table-wrapper">
                                <table className="attendance-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Reason & Proof</th> {/* Updated Header */}
                                            <th>Dates</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaves.map(l => (
                                            <tr key={l.id}>
                                                <td>
                                                    <div style={{ fontWeight: '600' }}>{l.studentName}</div>
                                                    <div style={{ fontSize: '12px', color: '#64748b' }}>{l.rollNo}</div>
                                                </td>
                                                <td>
                                                    <div>{l.reason}</div>
                                                    {/* ✅ View Document Link */}
                                                    {l.documentUrl && (
                                                        <a
                                                            href={l.documentUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            style={{
                                                                display: 'inline-block', marginTop: '5px', fontSize: '11px',
                                                                color: '#2563eb', fontWeight: '600', textDecoration: 'none'
                                                            }}
                                                        >
                                                            <i className="fas fa-external-link-alt"></i> View Document
                                                        </a>
                                                    )}
                                                </td>
                                                <td>{l.fromDate} <br /><span style={{ fontSize: '12px', color: '#94a3b8' }}>to</span><br /> {l.toDate}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button onClick={() => handleLeaveAction(l.id, 'approved')} className="status-badge status-approved" style={{ border: 'none', cursor: 'pointer' }}>Approve</button>
                                                        <button onClick={() => handleLeaveAction(l.id, 'rejected')} className="status-badge status-denied" style={{ border: 'none', cursor: 'pointer' }}>Reject</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {leaves.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'gray' }}>No pending leaves.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'requests' && (
                    <div className="content-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 className="content-title">Student Applications</h2>
                            {selectedRequestIds.length > 0 && (
                                <button
                                    onClick={() => confirmAction('Approve Selected?', `Approve ${selectedRequestIds.length} students?`, executeBulkApprove)}
                                    className="btn-primary"
                                    style={{ width: 'auto', padding: '8px 16px' }}
                                >
                                    {loading ? 'Processing...' : `Approve (${selectedRequestIds.length})`}
                                </button>
                            )}
                        </div>
                        <div className="card card-full-width">
                            <div className="table-wrapper">
                                <table className="attendance-table">
                                    <thead><tr><th style={{ width: '40px' }}><input type="checkbox" className="custom-checkbox" checked={studentRequests.length > 0 && selectedRequestIds.length === studentRequests.length} onChange={toggleSelectRequestAll} /></th><th>Name</th><th>Class</th><th>College ID</th><th>Roll No</th><th>Email</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {studentRequests.map(req => (
                                            <tr key={req.id} className={selectedRequestIds.includes(req.id) ? 'row-selected' : ''}>
                                                <td><input type="checkbox" className="custom-checkbox" checked={selectedRequestIds.includes(req.id)} onChange={() => toggleSelectRequestOne(req.id)} /></td>
                                                <td>{req.firstName} {req.lastName}</td>
                                                <td><span className="status-badge-pill" style={{ background: '#e0f2fe', color: '#0284c7' }}>{req.year || '-'}</span></td>
                                                <td style={{ fontWeight: 'bold' }}>{req.collegeId}</td>
                                                <td>{req.rollNo}</td>
                                                <td>{req.email}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button onClick={() => confirmAction('Approve?', `Approve ${req.firstName}?`, () => executeSingleApprove(req))} className="status-badge status-approved" style={{ border: 'none', cursor: 'pointer' }}>Approve</button>
                                                        <button onClick={() => confirmAction('Reject?', `Reject?`, () => executeReject(req.id), 'danger')} className="status-badge status-denied" style={{ border: 'none', cursor: 'pointer' }}>Reject</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {studentRequests.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No pending requests.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'manage' && (
                    <div className="content-section">
                        <h2 className="content-title">Department Users</h2>
                        <div className="card card-full-width" style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                                <div className="icon-box-modern" style={{ background: '#ecfdf5', color: '#059669', width: '32px', height: '32px', fontSize: '14px' }}><i className="fas fa-chalkboard-teacher"></i></div>
                                <h3 style={{ margin: 0 }}>Teachers ({teachersList.length})</h3>
                            </div>
                            <div className="table-wrapper">
                                <table className="attendance-table"><thead><tr><th style={{ width: '40px' }}></th><th>Name</th><th>Email</th><th>Subject</th></tr></thead><tbody>{teachersList.map(t => (<tr key={t.id}><td><input type="checkbox" checked={selectedUserIds.includes(t.id)} onChange={() => toggleSelectUser(t.id)} className="custom-checkbox" /></td><td>{t.firstName} {t.lastName}</td><td>{t.email}</td><td><span className="status-badge-pill">{t.subject}</span></td></tr>))}</tbody></table>
                            </div>
                        </div>
                        <div className="card card-full-width">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                                <div className="icon-box-modern" style={{ background: '#eff6ff', color: '#2563eb', width: '32px', height: '32px', fontSize: '14px' }}><i className="fas fa-user-graduate"></i></div>
                                <h3 style={{ margin: 0 }}>Students ({studentsList.length})</h3>
                            </div>
                            <div className="table-wrapper">
                                <table className="attendance-table"><thead><tr><th style={{ width: '40px' }}></th><th>Roll No</th><th>Name</th><th>Class</th><th>Email</th></tr></thead><tbody>{studentsList.sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo, undefined, { numeric: true })).map(s => (<tr key={s.id}><td><input type="checkbox" checked={selectedUserIds.includes(s.id)} onChange={() => toggleSelectUser(s.id)} className="custom-checkbox" /></td><td style={{ fontWeight: 'bold' }}>{s.rollNo}</td><td>{s.firstName} {s.lastName}</td><td><span className="status-badge-pill">{s.year || '-'}</span></td><td>{s.email}</td></tr>))}</tbody></table>
                            </div>
                        </div>
                        {selectedUserIds.length > 0 && (
                            <button className="floating-delete-btn" onClick={handleDeleteUsers}>
                                <i className="fas fa-trash-alt"></i> Delete ({selectedUserIds.length})
                            </button>
                        )}
                    </div>
                )}

                {activeTab === 'timetable' && <ManageTimetable hodInfo={hodInfo} />}

                {activeTab === 'addTeacher' && (
                    <div className="content-section">
                        <h2 className="content-title">Add New Teacher</h2>
                        <div className="card">
                            <form onSubmit={handleAddTeacher}>
                                <div className="input-group"><label>First Name</label><input type="text" required value={teacherForm.firstName} onChange={e => setTeacherForm({ ...teacherForm, firstName: e.target.value })} /></div>
                                <div className="input-group"><label>Last Name</label><input type="text" required value={teacherForm.lastName} onChange={e => setTeacherForm({ ...teacherForm, lastName: e.target.value })} /></div>
                                <div className="input-group"><label>Subject</label><input type="text" placeholder="e.g. Data Structures" required value={teacherForm.subject} onChange={e => setTeacherForm({ ...teacherForm, subject: e.target.value })} /></div>
                                <div className="input-group"><label>Email</label><input type="email" required value={teacherForm.email} onChange={e => setTeacherForm({ ...teacherForm, email: e.target.value })} /></div>
                                <div className="input-group"><label>Password</label><input type="password" required value={teacherForm.password} onChange={e => setTeacherForm({ ...teacherForm, password: e.target.value })} /></div>
                                <button className="btn-primary" disabled={loading}>{loading ? 'Adding...' : 'Add Teacher'}</button>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}