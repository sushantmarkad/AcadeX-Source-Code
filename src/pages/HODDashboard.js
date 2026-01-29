import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db, sendPasswordResetEmail } from '../firebase';
import { doc, getDoc, collection, query, where, onSnapshot, deleteDoc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import toast, { Toaster } from 'react-hot-toast';
import { 
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { Timestamp } from 'firebase/firestore';
import logo from "../assets/logo.png";
import './Dashboard.css';
import './HODDashboard.css'; 

import ManageTimetable from './ManageTimetable';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function HODDashboard() {
    const [hodInfo, setHodInfo] = useState(null);
    const [studentRequests, setStudentRequests] = useState([]);
    const [deptUsers, setDeptUsers] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [totalClasses, setTotalClasses] = useState(0);
    const [searchQuery, setSearchQuery] = useState(""); 

    const [selectedRequestIds, setSelectedRequestIds] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]);

    // ✅ Announcement State (Fixed naming consistency)
    const [announcements, setAnnouncements] = useState([]);
    const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', targetYear: 'All' });

    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'info' });
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    // ✅ Teacher Form (Includes Academic Year)
    const [teacherForm, setTeacherForm] = useState({ 
        firstName: '', lastName: '', email: '', password: '', 
        academicYear: '2024-2025', 
        assignedClasses: [] 
    });
    
    // ✅ Profile Editing State
    const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', qualification: '', phone: '' });
    const [isEditingProfile, setIsEditingProfile] = useState(false);

    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            if (!auth.currentUser) return;
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setHodInfo(data);
                
                // Initialize Profile Form
                setProfileForm({
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    qualification: data.qualification || '',
                    phone: data.phone || ''
                });

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

                // Fetch Announcements
                const qAnnouncements = query(collection(db, 'announcements'), where('instituteId', '==', data.instituteId), where('department', '==', data.department));
                onSnapshot(qAnnouncements, (snap) => {
                    const annData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    annData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                    setAnnouncements(annData);
                });
            }
        };
        init();
    }, []);

    // --- ✅ NEW: ATTENDANCE ANALYTICS LOGIC ---
    const [attendanceGraph, setAttendanceGraph] = useState([]);
    const [timeRange, setTimeRange] = useState('week'); // 'week' | 'month'

    useEffect(() => {
        const fetchAttendanceStats = async () => {
            if (!hodInfo || deptUsers.length === 0) return;

            // 1. Calculate Total Students per Year
            const studentsByYear = { FE: 0, SE: 0, TE: 0, BE: 0 };
            const studentYearMap = {}; // Map uid -> year
            
            deptUsers.forEach(u => {
                if (u.role === 'student' && u.year) {
                    studentsByYear[u.year] = (studentsByYear[u.year] || 0) + 1;
                    studentYearMap[u.id] = u.year;
                }
            });

            // 2. Define Time Range
            const now = new Date();
            const startDate = new Date();
            if (timeRange === 'week') startDate.setDate(now.getDate() - 7);
            else startDate.setDate(now.getDate() - 30); // Monthly

            // 3. Fetch Attendance Logs (Optimized for recent only)
            try {
                const q = query(
                    collection(db, 'attendance'),
                    where('instituteId', '==', hodInfo.instituteId),
                    where('department', '==', hodInfo.department),
                    where('timestamp', '>=', Timestamp.fromDate(startDate))
                );
                
                // Note: onSnapshot is better for real-time, but getDocs is fine for analytics to save reads
                onSnapshot(q, (snap) => {
                    const yearCounts = { FE: 0, SE: 0, TE: 0, BE: 0 }; // Total 'Present' count
                    const sessionsByYear = { FE: new Set(), SE: new Set(), TE: new Set(), BE: new Set() };

                    snap.docs.forEach(doc => {
                        const data = doc.data();
                        const studentYear = studentYearMap[data.studentId];
                        
                        if (studentYear && yearCounts[studentYear] !== undefined) {
                            yearCounts[studentYear]++;
                            sessionsByYear[studentYear].add(data.sessionId);
                        }
                    });

                    // 4. Calculate Percentage per Year
                    const graphData = ['FE', 'SE', 'TE', 'BE'].map(year => {
                        const totalStudents = studentsByYear[year] || 1; // Avoid divide by zero
                        const totalSessions = sessionsByYear[year].size || 1;
                        const totalPresent = yearCounts[year];
                        
                        // Avg Present % = (Total Present) / (Total Sessions * Total Students) * 100
                        const avgPct = Math.round((totalPresent / (totalSessions * totalStudents)) * 100) || 0;

                        return { name: year, attendance: avgPct, totalStudents: studentsByYear[year] };
                    });

                    setAttendanceGraph(graphData);
                });

            } catch (err) {
                console.error("Error fetching analytics:", err);
            }
        };

        fetchAttendanceStats();
    }, [hodInfo, deptUsers, timeRange]);

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

    // Handle Class/Year Selection for New Teacher
    const handleClassToggle = (year) => {
        setTeacherForm(prev => {
            const exists = prev.assignedClasses.find(c => c.year === year);
            if (exists) {
                return { ...prev, assignedClasses: prev.assignedClasses.filter(c => c.year !== year) };
            } else {
                return { ...prev, assignedClasses: [...prev.assignedClasses, { year, subject: '' }] };
            }
        });
    };

    const handleSubjectChange = (year, subject) => {
        setTeacherForm(prev => ({
            ...prev,
            assignedClasses: prev.assignedClasses.map(c => c.year === year ? { ...c, subject } : c)
        }));
    };

    // --- ACTIONS ---

    // 1. Update Profile
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                firstName: profileForm.firstName,
                lastName: profileForm.lastName,
                qualification: profileForm.qualification,
                phone: profileForm.phone
            });
            setHodInfo(prev => ({ ...prev, ...profileForm }));
            setIsEditingProfile(false);
            toast.success("Profile Updated!");
        } catch (error) {
            toast.error("Update Failed");
        } finally {
            setLoading(false);
        }
    };

    // 2. Post Announcement
    const handlePostAnnouncement = async (e) => {
        e.preventDefault();
        const toastId = toast.loading("Posting...");
        try {
            await addDoc(collection(db, 'announcements'), {
                title: announcementForm.title,
                message: announcementForm.message,
                targetYear: announcementForm.targetYear,
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

    const handleDeleteAnnouncement = async (id) => {
        if (!window.confirm("Delete this announcement?")) return;
        try {
            await deleteDoc(doc(db, 'announcements', id));
            toast.success("Deleted.");
        } catch (e) { toast.error("Failed."); }
    };

    const handleSendNotice = (student) => {
        toast.success(`Notice sent to ${student.firstName} (${student.email})`, {
            icon: '📨',
            style: { border: '1px solid #3b82f6', color: '#1e3a8a', background: '#eff6ff' }
        });
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

    // 3. Add Teacher (Sends assignedClasses and Academic Year)
    const handleAddTeacher = async (e) => {
        e.preventDefault();

        if (teacherForm.assignedClasses.length === 0) {
            toast.error("Please assign at least one class.");
            return;
        }
        const incomplete = teacherForm.assignedClasses.find(c => !c.subject || c.subject.trim() === "");
        if (incomplete) {
            toast.error(`Please enter a subject for ${incomplete.year} year.`);
            return;
        }

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
                    assignedClasses: teacherForm.assignedClasses,
                    extras: { 
                        academicYear: teacherForm.academicYear,
                        qualification: 'Added by HOD' 
                    }
                })
            });
            await sendPasswordResetEmail(auth, teacherForm.email);
            toast.success(`Teacher Added!`, { id: toastId });
            setTeacherForm({ firstName: '', lastName: '', email: '', password: '', academicYear: '2024-2025', assignedClasses: [] });
        } catch (error) { toast.error("Error: " + error.message, { id: toastId }); } finally { setLoading(false); }
    };

    const MobileFooter = () => (
        // ✅ Updated Class Name
        <div className="hod-mobile-footer">
            <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
                <i className="fas fa-th-large"></i><span>Home</span>
            </button>
            <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}>
                <i className="fas fa-chart-pie"></i><span>Stats</span>
            </button>
            <button className={activeTab === 'announcements' ? 'active' : ''} onClick={() => setActiveTab('announcements')}>
                <i className="fas fa-bullhorn"></i><span>Notices</span>
            </button>
            <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>
                <i className="fas fa-user"></i><span>Profile</span>
            </button>
        </div>
    );

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
                toastOptions={{ duration: 4000, style: { background: '#1e293b', color: '#fff', marginBottom: '60px' } }}
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
                    <NavLink page="announcements" iconClass="fa-bullhorn" label="Announcements" />
                    <NavLink page="leaves" iconClass="fa-calendar-check" label="Leave Requests" count={leaves.length} />
                    <NavLink page="requests" iconClass="fa-user-clock" label="Applications" count={studentRequests.length} />
                    <NavLink page="manage" iconClass="fa-users" label="Dept Users" />
                    <NavLink page="timetable" iconClass="fa-calendar-alt" label="Timetable" />
                    <NavLink page="addTeacher" iconClass="fa-chalkboard-teacher" label="Add Teacher" />
                    <NavLink page="profile" iconClass="fa-user-cog" label="My Profile" />
                </ul>
                <div className="sidebar-footer">
                    <button className="logout-btn" onClick={() => signOut(auth).then(() => navigate('/'))}>
                        <i className="fas fa-sign-out-alt" style={{ marginRight: '10px' }}></i> Logout
                    </button>
                </div>
            </aside>

            <main className="main-content" style={{paddingBottom: '70px'}}>
                <header className="mobile-header">
                    <button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}><i className="fas fa-bars"></i></button>
                    <div className="mobile-brand"><img src={logo} alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">AcadeX</span></div>
                    <div style={{ width: '40px' }}></div>
                </header>

               {/* ✅ UPDATED DASHBOARD TAB */}
                {activeTab === 'dashboard' && (
                    <div className="content-section">
                        <h2 className="content-title">Department Overview</h2>
                        
                        {/* 1. Student Count by Year (Cards) */}
                        <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom:'20px' }}>
                            {['FE', 'SE', 'TE', 'BE'].map(year => {
                                const count = studentsList.filter(s => s.year === year).length;
                                const colors = { FE: '#3b82f6', SE: '#8b5cf6', TE: '#f59e0b', BE: '#10b981' };
                                const bgs = { FE: '#eff6ff', SE: '#f5f3ff', TE: '#fffbeb', BE: '#ecfdf5' };
                                return (
                                    <div key={year} className="card" style={{ background: bgs[year], border: 'none', borderLeft: `4px solid ${colors[year]}` }}>
                                        <h3 style={{ margin: 0, color: colors[year], fontSize: '14px' }}>{year} Students</h3>
                                        <p style={{ margin: '5px 0 0', fontSize: '28px', fontWeight: '800', color: '#1e293b' }}>{count}</p>
                                    </div>
                                );
                            })}
                            <div className="card" style={{ background: '#f8fafc', border: 'none', borderLeft: '4px solid #64748b' }}>
                                <h3 style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Total Faculty</h3>
                                <p style={{ margin: '5px 0 0', fontSize: '28px', fontWeight: '800', color: '#1e293b' }}>{teachersList.length}</p>
                            </div>
                        </div>

                        {/* 2. Attendance Analytics Graph */}
                        <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div>
                                    <h3 style={{ margin: 0, color: '#1e293b' }}>Average Attendance</h3>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Performance by Class Year</p>
                                </div>
                                <div style={{ background: '#f1f5f9', padding: '4px', borderRadius: '8px', display: 'flex' }}>
                                    <button onClick={() => setTimeRange('week')} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', background: timeRange === 'week' ? 'white' : 'transparent', color: timeRange === 'week' ? '#0f172a' : '#64748b', boxShadow: timeRange === 'week' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none' }}>This Week</button>
                                    <button onClick={() => setTimeRange('month')} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', background: timeRange === 'month' ? 'white' : 'transparent', color: timeRange === 'month' ? '#0f172a' : '#64748b', boxShadow: timeRange === 'month' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none' }}>This Month</button>
                                </div>
                            </div>

                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={attendanceGraph} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <Tooltip 
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="attendance" name="Avg Attendance %" radius={[6, 6, 0, 0]} barSize={50}>
                                        {attendanceGraph.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'FE' ? '#3b82f6' : entry.name === 'SE' ? '#8b5cf6' : entry.name === 'TE' ? '#f59e0b' : '#10b981'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="content-section">
                        <h2 className="content-title">Attendance Analytics</h2>
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
                                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                            {s.rollNo} • <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{s.year || 'N/A'}</span>
                                                        </div>
                                                    </td>
                                                    <td><span className="status-badge-pill" style={{ background: '#fef2f2', color: '#dc2626' }}>{s.percentage.toFixed(0)}%</span></td>
                                                    <td>
                                                        <button onClick={() => handleSendNotice(s)} className="btn-action" style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', fontSize: '12px', padding: '4px 10px' }}>
                                                            Send Notice
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'profile' && (
    <div className="content-section">
        <h2 className="content-title">My Profile</h2>
        <div className="card" style={{ padding: 0, overflow: 'hidden', maxWidth: '800px' }}>
            
            {/* 1. Cover Photo & Avatar Area */}
            <div className="profile-cover">
                <div className="profile-avatar-wrapper">
                    <div className="profile-avatar-img">
                        {hodInfo?.firstName?.charAt(0)}
                    </div>
                </div>
                {/* Edit Button positioned on Cover */}
                <div style={{ position: 'absolute', bottom: '-50px', right: '20px' }}>
                    <button className="edit-btn-floating" onClick={() => setIsEditingProfile(!isEditingProfile)}>
                        {isEditingProfile ? 'Cancel Editing' : <><i className="fas fa-pen"></i> Edit Profile</>}
                    </button>
                </div>
            </div>

            {/* 2. Header Info */}
            <div className="profile-header-content">
                <div style={{ marginTop: '10px' }}>
                    <h2 style={{ margin: 0, fontSize: '24px', color: '#1e293b' }}>
                        {hodInfo?.firstName} {hodInfo?.lastName}
                    </h2>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
                        Head of Department • {hodInfo?.department}
                    </p>
                </div>
            </div>

            {/* 3. Details Grid (View Mode) */}
            {!isEditingProfile ? (
                <div className="profile-grid">
                    <div className="profile-field">
                        <label>Institute</label>
                        <div><i className="fas fa-university" style={{color:'#6366f1'}}></i> {hodInfo?.instituteName}</div>
                    </div>
                    <div className="profile-field">
                        <label>Email Address</label>
                        <div><i className="fas fa-envelope" style={{color:'#ef4444'}}></i> {hodInfo?.email}</div>
                    </div>
                    <div className="profile-field">
                        <label>Qualification</label>
                        <div><i className="fas fa-graduation-cap" style={{color:'#f59e0b'}}></i> {hodInfo?.qualification || 'Not Added'}</div>
                    </div>
                    <div className="profile-field">
                        <label>Phone Number</label>
                        <div><i className="fas fa-phone" style={{color:'#10b981'}}></i> {hodInfo?.phone || 'Not Added'}</div>
                    </div>
                </div>
            ) : (
                // 4. Edit Form
                <form onSubmit={handleUpdateProfile} style={{ padding: '20px' }}>
                    <div style={{display:'flex', gap:'15px', marginBottom:'15px'}}>
                        <div className="input-group" style={{flex:1}}>
                            <label>First Name</label>
                            <input type="text" value={profileForm.firstName} onChange={e => setProfileForm({...profileForm, firstName: e.target.value})} className="modern-input" />
                        </div>
                        <div className="input-group" style={{flex:1}}>
                            <label>Last Name</label>
                            <input type="text" value={profileForm.lastName} onChange={e => setProfileForm({...profileForm, lastName: e.target.value})} className="modern-input" />
                        </div>
                    </div>
                    
                    <div style={{display:'flex', gap:'15px', marginBottom:'15px'}}>
                        <div className="input-group" style={{flex:1}}>
                            <label>Qualification</label>
                            <input type="text" value={profileForm.qualification} onChange={e => setProfileForm({...profileForm, qualification: e.target.value})} className="modern-input" placeholder="e.g. PhD" />
                        </div>
                        <div className="input-group" style={{flex:1}}>
                            <label>Phone</label>
                            <input type="text" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} className="modern-input" placeholder="+91..." />
                        </div>
                    </div>

                    <button className="btn-primary" disabled={loading} style={{width:'100%'}}>
                        {loading ? 'Saving Changes...' : 'Save Updates'}
                    </button>
                </form>
            )}
        </div>
    </div>
)}
                {activeTab === 'announcements' && (
                    <div className="content-section">
                        <h2 className="content-title">📢 Announcements</h2>
                        <div className="cards-grid">
                            <div className="card">
                                <h3>Create Announcement</h3>
                                <form onSubmit={handlePostAnnouncement} style={{ marginTop: '15px' }}>
                                    <div className="input-group">
                                        <label>Target Audience</label>
                                        <select value={announcementForm.targetYear} onChange={e => setAnnouncementForm({ ...announcementForm, targetYear: e.target.value })} required className="modern-select">
                                            <option value="All">All Students & Teachers</option>
                                            <option value="Teachers">Teachers Only</option>
                                            <option value="FE">First Year (FE)</option>
                                            <option value="SE">Second Year (SE)</option>
                                            <option value="TE">Third Year (TE)</option>
                                            <option value="BE">Final Year (BE)</option>
                                        </select>
                                    </div>
                                    <div className="input-group"><label>Title</label><input type="text" required value={announcementForm.title} onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })} /></div>
                                    <div className="input-group"><label>Message</label><textarea className="modern-input" rows="3" required value={announcementForm.message} onChange={e => setAnnouncementForm({ ...announcementForm, message: e.target.value })} /></div>
                                    <button className="btn-primary">Post</button>
                                </form>
                            </div>
                            <div className="card">
                                <h3>History</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto', marginTop: '10px' }}>
                                    {announcements.map(a => (
                                        <div key={a.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', position: 'relative' }}>
                                            <span className="status-badge-pill" style={{ fontSize: '10px', marginBottom: '5px', background: a.targetYear === 'Teachers' ? '#fef3c7' : '#e0f2fe', color: a.targetYear === 'Teachers' ? '#d97706' : '#0284c7' }}>
                                                {a.targetYear === 'All' ? 'Everyone' : a.targetYear}
                                            </span>
                                            <h4 style={{ margin: '0 0 5px 0' }}>{a.title}</h4>
                                            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>{a.message}</p>
                                            <small style={{fontSize:'11px', color:'#94a3b8'}}>By: {a.teacherName}</small>
                                            <button onClick={() => handleDeleteAnnouncement(a.id)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><i className="fas fa-trash"></i></button>
                                        </div>
                                    ))}
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
                                    <thead><tr><th>Name</th><th>Reason & Proof</th><th>Dates</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {leaves.map(l => (
                                            <tr key={l.id}>
                                                <td><div style={{ fontWeight: '600' }}>{l.studentName}</div><div style={{ fontSize: '12px', color: '#64748b' }}>{l.rollNo}</div></td>
                                                <td>
                                                    <div>{l.reason}</div>
                                                    {l.documentUrl && (<a href={l.documentUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '5px', fontSize: '11px', color: '#2563eb', fontWeight: '600', textDecoration: 'none' }}><i className="fas fa-external-link-alt"></i> View Document</a>)}
                                                </td>
                                                <td>{l.fromDate} <br /><span style={{ fontSize: '12px', color: '#94a3b8' }}>to</span><br /> {l.toDate}</td>
                                                <td><div style={{ display: 'flex', gap: '8px' }}><button onClick={() => handleLeaveAction(l.id, 'approved')} className="status-badge status-approved" style={{ border: 'none', cursor: 'pointer' }}>Approve</button><button onClick={() => handleLeaveAction(l.id, 'rejected')} className="status-badge status-denied" style={{ border: 'none', cursor: 'pointer' }}>Reject</button></div></td>
                                            </tr>
                                        ))}
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
                            {selectedRequestIds.length > 0 && <button onClick={() => confirmAction('Approve Selected?', `Approve ${selectedRequestIds.length} students?`, executeBulkApprove)} className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }}>{loading ? 'Processing...' : `Approve (${selectedRequestIds.length})`}</button>}
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
                                                <td><div style={{ display: 'flex', gap: '8px' }}><button onClick={() => confirmAction('Approve?', `Approve ${req.firstName}?`, () => executeSingleApprove(req))} className="status-badge status-approved" style={{ border: 'none', cursor: 'pointer' }}>Approve</button><button onClick={() => confirmAction('Reject?', `Reject?`, () => executeReject(req.id), 'danger')} className="status-badge status-denied" style={{ border: 'none', cursor: 'pointer' }}>Reject</button></div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ✅ DEPT USERS - Year-wise Scrollable Cards */}
                {activeTab === 'manage' && (
                    <div className="content-section">
                        <h2 className="content-title">Department Users</h2>
                        
                        {/* Teachers Table */}
                        <div className="card card-full-width" style={{ marginBottom: '24px' }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Teachers ({teachersList.length})</h3>
                            <div className="table-wrapper">
                                <table className="attendance-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}></th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Classes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teachersList.map(t => (
                                            <tr key={t.id}>
                                                <td>
                                                    <input type="checkbox" checked={selectedUserIds.includes(t.id)} onChange={() => toggleSelectUser(t.id)} className="custom-checkbox" />
                                                </td>
                                                <td>{t.firstName} {t.lastName}</td>
                                                <td>{t.email}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                                        {t.assignedClasses && t.assignedClasses.length > 0 ? 
                                                            t.assignedClasses.map((cls, idx) => (
                                                                <span key={idx} className="status-badge-pill" style={{ fontSize: '11px', padding: '2px 8px' }}>
                                                                    {cls.year} - {cls.subject}
                                                                </span>
                                                            ))
                                                            : (
                                                                <span className="status-badge-pill" style={{ background: '#f1f5f9', color: '#64748b' }}>
                                                                    {t.subject || 'N/A'}
                                                                </span>
                                                            )
                                                        }
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Students Section - Year Wise Scrollable Cards */}
                        <h3 style={{ margin: '0 0 15px 0' }}>Students ({studentsList.length})</h3>
                        <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                            {['FE', 'SE', 'TE', 'BE'].map(year => {
                                const yearStudents = studentsList.filter(s => s.year === year);
                                return (
                                    <div key={year} className="card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
                                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #e2e8f0', paddingBottom:'10px', marginBottom:'10px' }}>
                                            <h3 style={{ margin: 0, color: '#2563eb' }}>{year} Students</h3>
                                            <span className="nav-badge" style={{background:'#eff6ff', color:'#2563eb', fontSize:'12px'}}>{yearStudents.length}</span>
                                        </div>
                                        
                                        <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                                            {yearStudents.length > 0 ? (
                                                <table className="attendance-table" style={{ fontSize: '13px' }}>
                                                    <thead><tr><th>Roll</th><th>Name</th></tr></thead>
                                                    <tbody>
                                                        {yearStudents.sort((a,b) => (a.rollNo || "").localeCompare(b.rollNo, undefined, {numeric:true})).map(s => (
                                                            <tr key={s.id}>
                                                                <td style={{fontWeight:'bold'}}>{s.rollNo}</td>
                                                                <td>{s.firstName} {s.lastName}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : <p style={{textAlign:'center', color:'#94a3b8', marginTop:'20px'}}>No students found.</p>}
                                        </div>
                                    </div>
                                );
                            })}
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
                                <div style={{display:'flex', gap:'15px'}}>
                                    <div className="input-group" style={{flex:1}}><label>First Name</label><input type="text" required value={teacherForm.firstName} onChange={e => setTeacherForm({ ...teacherForm, firstName: e.target.value })} /></div>
                                    <div className="input-group" style={{flex:1}}><label>Last Name</label><input type="text" required value={teacherForm.lastName} onChange={e => setTeacherForm({ ...teacherForm, lastName: e.target.value })} /></div>
                                </div>

                                <div className="input-group">
                                    <label>Department</label>
                                    <input type="text" value={hodInfo?.department || ''} disabled style={{ background: '#f1f5f9', cursor: 'not-allowed' }} />
                                </div>

                                {/* ✅ Academic Year */}
                                <div className="input-group">
                                    <label>Academic Year</label>
                                    <select value={teacherForm.academicYear} onChange={e => setTeacherForm({...teacherForm, academicYear: e.target.value})} className="modern-select">
                                        <option value="2024-2025">2024-2025</option>
                                        <option value="2025-2026">2025-2026</option>
                                        <option value="2026-2027">2026-2027</option>
                                    </select>
                                </div>

                                <div className="input-group">
                                    <label>Assign Classes & Subjects</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                                        {['FE', 'SE', 'TE', 'BE'].map(year => {
                                            const assigned = teacherForm.assignedClasses.find(c => c.year === year);
                                            return (
                                                <div key={year} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: assigned ? '#eff6ff' : '#f8fafc', padding: '10px', borderRadius: '8px', border: assigned ? '1px solid #bfdbfe' : '1px solid #e2e8f0' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={!!assigned}
                                                        onChange={() => handleClassToggle(year)}
                                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                    />
                                                    <span style={{ fontWeight: 'bold', width: '40px' }}>{year}</span>

                                                    {assigned && (
                                                        <input
                                                            type="text"
                                                            placeholder={`Subject for ${year} (e.g. Maths)`}
                                                            value={assigned.subject}
                                                            onChange={(e) => handleSubjectChange(year, e.target.value)}
                                                            style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                                            required
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <small style={{ color: '#64748b', display: 'block', marginTop: '5px' }}>Check the year box to assign a subject.</small>
                                </div>

                                <div className="input-group"><label>Email</label><input type="email" required value={teacherForm.email} onChange={e => setTeacherForm({ ...teacherForm, email: e.target.value })} /></div>
                                <div className="input-group"><label>Password</label><input type="password" required value={teacherForm.password} onChange={e => setTeacherForm({ ...teacherForm, password: e.target.value })} /></div>
                                <button className="btn-primary" disabled={loading}>{loading ? 'Adding...' : 'Add Teacher'}</button>
                            </form>
                        </div>
                    </div>
                )}
            </main>
            
            {/* Mobile Footer Bar */}
            <MobileFooter />
        </div>
    );
}