import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, doc, setDoc, serverTimestamp, onSnapshot, query, where, getDocs, writeBatch, Timestamp, addDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { CSVLink } from 'react-csv';
import toast, { Toaster } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import './Dashboard.css';
import AddTasks from './AddTasks';
import Profile from './Profile';
import logo from "../assets/logo.png";

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
};

// ------------------------------------
//  COMPONENT: ANNOUNCEMENTS
// ------------------------------------
const TeacherAnnouncements = ({ teacherInfo }) => {
    const [form, setForm] = useState({ title: '', message: '', targetYear: 'All' });
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let unsubscribe;
        if (teacherInfo?.instituteId && auth.currentUser) {
            const q = query(
                collection(db, 'announcements'),
                where('teacherId', '==', auth.currentUser.uid)
            );
            unsubscribe = onSnapshot(q, (snap) => {
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                setAnnouncements(data);
            });
        }
        return () => { if (unsubscribe) unsubscribe(); };
    }, [teacherInfo]);

    const handlePost = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await addDoc(collection(db, 'announcements'), {
                ...form,
                teacherId: auth.currentUser.uid,
                teacherName: `${teacherInfo.firstName} ${teacherInfo.lastName}`,
                department: teacherInfo.department,
                instituteId: teacherInfo.instituteId,
                role: 'teacher',
                createdAt: serverTimestamp()
            });
            toast.success("Announcement Posted!");
            setForm({ title: '', message: '', targetYear: 'All' });
        } catch (err) {
            toast.error("Failed to post.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this announcement?")) {
            await deleteDoc(doc(db, 'announcements', id));
            toast.success("Deleted.");
        }
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Announcements</h2>
            <p className="content-subtitle">Broadcast messages to <strong>{teacherInfo.department}</strong> students.</p>

            <div className="cards-grid">
                <div className="card">
                    <h3>Create New</h3>
                    <form onSubmit={handlePost} style={{ marginTop: '15px' }}>
                        <div className="input-group">
                            <label>Target Audience</label>
                            <select
                                value={form.targetYear}
                                onChange={e => setForm({ ...form, targetYear: e.target.value })}
                                required
                            >
                                <option value="All">All Students</option>
                                <option value="FE">FE (First Year)</option>
                                <option value="SE">SE (Second Year)</option>
                                <option value="TE">TE (Third Year)</option>
                                <option value="BE">BE (Final Year)</option>
                            </select>
                        </div>

                        <div className="input-group"><label>Title</label><input type="text" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Exam Schedule" /></div>
                        <div className="input-group"><label>Message</label><textarea className="modern-input" rows="3" required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Type your message..." /></div>
                        <button className="btn-primary" disabled={loading}>{loading ? 'Posting...' : 'Post Announcement'}</button>
                    </form>
                </div>
                <div className="card">
                    <h3>History</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto', marginTop: '15px' }}>
                        {announcements.length > 0 ? (
                            announcements.map(ann => (
                                <div key={ann.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', position: 'relative' }}>
                                    <span className="status-badge-pill" style={{ fontSize: '10px', marginBottom: '5px' }}>{ann.targetYear || 'All'}</span>
                                    <h4 style={{ margin: '0 0 5px 0' }}>{ann.title}</h4>
                                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>{ann.message}</p>
                                    <small style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '5px' }}>{ann.createdAt?.toDate().toLocaleDateString()}</small>
                                    <button onClick={() => handleDelete(ann.id)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><i className="fas fa-trash"></i></button>
                                </div>
                            ))
                        ) : <p style={{ fontStyle: 'italic', color: '#94a3b8' }}>No announcements yet.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ------------------------------------
//  COMPONENT: TEACHER ANALYTICS (Updated)
// ------------------------------------
const TeacherAnalytics = ({ teacherInfo, selectedYear }) => {
    const [weeklyData, setWeeklyData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!teacherInfo || !selectedYear) return;
            setLoading(true);

            // 1. Determine Subject for this Year
            let currentSubject = teacherInfo.subject;
            if (teacherInfo.assignedClasses) {
                const classData = teacherInfo.assignedClasses.find(c => c.year === selectedYear);
                if (classData) currentSubject = classData.subject;
            }

            // 2. Define Time Range (Last 7 Days)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);

            try {
                // 3. Query Attendance
                const q = query(
                    collection(db, 'attendance'),
                    where('instituteId', '==', teacherInfo.instituteId),
                    where('subject', '==', currentSubject), // Filter by specific subject
                    where('timestamp', '>=', Timestamp.fromDate(startDate))
                );

                const snap = await getDocs(q);

                // 4. Process Data (Group by Day)
                const dayMap = {};
                // Initialize map with 0 for last 7 days
                for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                    const dayStr = d.toLocaleDateString('en-GB', { weekday: 'short' }); // Mon, Tue
                    dayMap[dayStr] = 0;
                }

                snap.docs.forEach(doc => {
                    const data = doc.data();
                    // Filter by year if backend saves it, else client filter
                    if (data.year === selectedYear || data.year === 'All') { // Note: using 'year' field from DB
                        const date = data.timestamp.toDate();
                        const dayStr = date.toLocaleDateString('en-GB', { weekday: 'short' });
                        if (dayMap[dayStr] !== undefined) {
                            dayMap[dayStr]++;
                        }
                    }
                });

                // Convert to Array for Recharts
                const chartData = Object.keys(dayMap).map(key => ({
                    name: key,
                    students: dayMap[key]
                }));

                setWeeklyData(chartData);
            } catch (err) {
                console.error("Analytics Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [teacherInfo, selectedYear]);

    // Subject Label
    let subjectName = teacherInfo.subject;
    if (teacherInfo.assignedClasses) {
        const cls = teacherInfo.assignedClasses.find(c => c.year === selectedYear);
        if (cls) subjectName = cls.subject;
    }

    return (
        <div className="content-section">
            <h2 className="content-title">Weekly Analytics</h2>
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>Attendance Trend ({selectedYear} - {subjectName})</h3>
                </div>

                {loading ? <p>Loading chart data...</p> : (
                    <div style={{ width: '100%', height: 300 }}>
                        {weeklyData.reduce((a, b) => a + b.students, 0) === 0 ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                No attendance data for the last 7 days.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="students" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ------------------------------------
//  DASHBOARD HOME (Updated with Subject Logic)
// ------------------------------------
const DashboardHome = ({ teacherInfo, activeSession, attendanceList, onSessionToggle, viewMode, setViewMode, selectedDate, setSelectedDate, historyList, historyStats, selectedYear, sessionLoading }) => {
    const [qrCodeValue, setQrCodeValue] = useState('');
    const [timer, setTimer] = useState(10);
    const [absentList, setAbsentList] = useState("");

    // Helper to get current subject
    const getCurrentSubject = () => {
        if (!teacherInfo) return "Class";
        if (teacherInfo.assignedClasses) {
            const cls = teacherInfo.assignedClasses.find(c => c.year === selectedYear);
            if (cls) return cls.subject;
        }
        return teacherInfo.subject;
    };
    const currentSubject = getCurrentSubject();

    const handleInverseAttendance = async () => {
        const absentees = absentList.split(',').map(s => s.trim()).filter(s => s !== "");
        const toastId = toast.loading("Processing inverse attendance...");

        try {
            const response = await fetch(`${BACKEND_URL}/markInverseAttendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacherId: auth.currentUser.uid,
                    sessionId: activeSession.sessionId,
                    absentees: absentees,
                    year: selectedYear,
                    department: teacherInfo.department,
                    instituteId: teacherInfo.instituteId,
                    subject: currentSubject 
                })
            });
            const data = await response.json();
            if (response.ok) {
                toast.success(data.message, { id: toastId });
                setAbsentList(""); // Clear input
            } else {
                toast.error("Failed: " + data.error, { id: toastId });
            }
        } catch (err) {
            toast.error("Connection error.", { id: toastId });
        }
    };

    useEffect(() => {
        let interval, countdown;
        if (activeSession) {
            setQrCodeValue(`${activeSession.sessionId}|${Date.now()}`);
            interval = setInterval(() => {
                setQrCodeValue(`${activeSession.sessionId}|${Date.now()}`);
                setTimer(10);
            }, 10000);
            countdown = setInterval(() => setTimer(p => p > 0 ? p - 1 : 0), 1000);
        }
        return () => { clearInterval(interval); clearInterval(countdown); };
    }, [activeSession]);

    const isSessionRelevant = activeSession && (activeSession.targetYear === selectedYear || activeSession.targetYear === 'All');
    const dateObj = new Date(selectedDate);
    const formattedDate = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div className="content-section">
            <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h2 className="content-title">{getGreeting()}, {teacherInfo.firstName}!</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                        <p className="content-subtitle" style={{ margin: 0 }}>Classroom:</p>
                        <span style={{ background: '#2563eb', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                            {selectedYear} Year • {currentSubject}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '5px', background: '#fff', padding: '5px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                    <button onClick={() => setViewMode('live')} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', background: viewMode === 'live' ? '#eff6ff' : 'transparent', color: viewMode === 'live' ? '#2563eb' : '#64748b' }}>Live Class</button>
                    <button onClick={() => setViewMode('history')} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', background: viewMode === 'history' ? '#eff6ff' : 'transparent', color: viewMode === 'history' ? '#2563eb' : '#64748b' }}>Past Reports</button>
                </div>
            </div>

            {viewMode === 'live' && (
                <div className="cards-grid">
                    <div className="card" style={{ background: isSessionRelevant ? 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)' : 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)', border: isSessionRelevant ? '1px solid #a7f3d0' : '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <div className="icon-box-modern" style={{ background: 'white', color: isSessionRelevant ? '#15803d' : '#1e40af' }}><i className={`fas ${isSessionRelevant ? 'fa-broadcast-tower' : 'fa-play'}`}></i></div>
                                <div>
                                    <h3 style={{ margin: 0, color: isSessionRelevant ? '#14532d' : '#1e3a8a', fontSize: '18px', fontWeight: '700' }}>{isSessionRelevant ? 'Session Live' : 'Start Class'}</h3>
                                    {isSessionRelevant && <span className="status-badge-pill" style={{ background: 'white', color: '#15803d', fontSize: '10px', padding: '2px 8px', marginTop: '4px' }}>ACTIVE</span>}
                                </div>
                            </div>
                            <p style={{ color: isSessionRelevant ? '#166534' : '#1e40af', marginBottom: '20px', fontSize: '13px', opacity: 0.9 }}>
                                {isSessionRelevant ? `Subject: ${currentSubject} | Refresh: ${timer}s` : `Start ${currentSubject} class for ${selectedYear} Year.`}
                            </p>
                        </div>
                        <button 
                            onClick={onSessionToggle} 
                            className={isSessionRelevant ? "btn-modern-danger" : "btn-modern-primary"} 
                            disabled={!teacherInfo || (activeSession && !isSessionRelevant) || sessionLoading} 
                            style={{ marginTop: 'auto', boxShadow: 'none' }}
                        >
                            {sessionLoading ? <i className="fas fa-spinner fa-spin"></i> : (activeSession && !isSessionRelevant ? 'Other Class Active' : isSessionRelevant ? 'End Session' : 'Start New Session')}
                        </button>
                    </div>
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}><div className="icon-box-modern" style={{ background: '#fff7ed', color: '#ea580c' }}><i className="fas fa-users"></i></div><h3 style={{ margin: 0, fontSize: '18px' }}>Total Present</h3></div>
                        <div style={{ marginTop: 'auto' }}><div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}><span style={{ fontSize: '56px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1' }}>{isSessionRelevant ? attendanceList.length : 0}</span><span style={{ color: 'var(--text-secondary)', fontSize: '16px', fontWeight: 500 }}>Students</span></div></div>
                    </div>
                    {isSessionRelevant && (
                        <div className="card card-full-width" style={{ textAlign: 'center', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
                            <div className="qr-code-wrapper" style={{ background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(37,99,235,0.1)', display: 'inline-block' }}><QRCodeSVG value={qrCodeValue} size={220} /></div>
                        </div>
                    )}
                    {isSessionRelevant && (
                        <div className="card card-full-width" style={{ marginTop: '20px', padding: '0', overflow: 'hidden' }}>
                            <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}><h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>Live Student List</h3><span className="status-badge-pill" style={{ background: '#dcfce7', color: '#15803d' }}>Live</span></div>
                            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                                <table className="attendance-table">
                                    <thead style={{ background: 'white' }}><tr><th>Roll No.</th><th>Name</th></tr></thead>
                                    <tbody>{attendanceList.map(s => (<tr key={s.id}><td style={{ fontWeight: '600', color: '#334155' }}>{s.rollNo}</td><td style={{ fontWeight: '500' }}>{s.firstName} {s.lastName}</td></tr>))}{attendanceList.length === 0 && <tr><td colSpan="2" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}><i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Waiting for scans...</td></tr>}</tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {isSessionRelevant && (
                        <div className="card" style={{ marginTop: '20px', borderLeft: '5px solid #f59e0b' }}>
                            <h3 style={{ fontSize: '18px', color: '#1e293b' }}><i className="fas fa-user-minus"></i> Quick Mark (Absentee Entry)</h3>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: '10px 0' }}>
                                Enter Roll Numbers of students who are <strong>ABSENT</strong>, separated by commas.
                            </p>
                            <input
                                type="text"
                                placeholder="e.g. 101, 105, 110"
                                value={absentList}
                                onChange={(e) => setAbsentList(e.target.value)}
                                className="modern-input"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    marginBottom: '15px'
                                }}
                            />
                            <button
                                className="btn-modern-primary"
                                onClick={handleInverseAttendance}
                                style={{ background: '#f59e0b', border: 'none' }}
                            >
                                Mark All Others as Present
                            </button>
                        </div>
                    )}
                </div>

            )}

            {viewMode === 'history' && (
                <div className="cards-grid">
                    <div className="card card-full-width" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: '#f8fafc' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Date</label>
                            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '15px', fontWeight: '500', outline: 'none' }} />
                        </div>
                        <div style={{ flex: 2, paddingLeft: '20px', borderLeft: '2px solid #e2e8f0' }}>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Viewing Report for:</p>
                            <h3 style={{ margin: '4px 0 0 0', fontSize: '22px', color: '#1e293b' }}>{formattedDate} ({selectedYear})</h3>
                        </div>
                    </div>
                    <div className="card" style={{ background: '#f0fdf4', borderLeft: '5px solid #10b981', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', textTransform: 'uppercase' }}>Present</span><h2 style={{ margin: '5px 0 0 0', fontSize: '32px', color: '#14532d' }}>{historyStats.present}</h2></div><div className="icon-box-modern" style={{ background: 'rgba(255,255,255,0.5)', color: '#15803d' }}><i className="fas fa-check-circle"></i></div></div>
                    </div>
                    <div className="card" style={{ background: '#fef2f2', borderLeft: '5px solid #ef4444', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><span style={{ fontSize: '11px', fontWeight: '800', color: '#991b1b', textTransform: 'uppercase' }}>Absent</span><h2 style={{ margin: '5px 0 0 0', fontSize: '32px', color: '#7f1d1d' }}>{historyStats.absent}</h2></div><div className="icon-box-modern" style={{ background: 'rgba(255,255,255,0.5)', color: '#dc2626' }}><i className="fas fa-times-circle"></i></div></div>
                    </div>
                    <div className="card" style={{ background: '#eff6ff', borderLeft: '5px solid #3b82f6', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><span style={{ fontSize: '11px', fontWeight: '800', color: '#1e40af', textTransform: 'uppercase' }}>Total</span><h2 style={{ margin: '5px 0 0 0', fontSize: '32px', color: '#1e3a8a' }}>{historyStats.total}</h2></div><div className="icon-box-modern" style={{ background: 'rgba(255,255,255,0.5)', color: '#2563eb' }}><i className="fas fa-users"></i></div></div>
                    </div>
                    <div className="card card-full-width" style={{ marginTop: '10px' }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9' }}><h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Attendance List</h3></div>
                        <div className="table-wrapper" style={{ border: 'none' }}>
                            <table className="attendance-table">
                                <thead style={{ background: '#f8fafc' }}><tr><th>Roll No</th><th>Name</th><th>Time In</th><th>Status</th></tr></thead>
                                <tbody>{historyList.map(item => (<tr key={item.id}><td style={{ fontWeight: 'bold', color: '#334155' }}>{item.rollNo}</td><td>{item.firstName} {item.lastName}</td><td style={{ color: '#64748b' }}>{item.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td><span className="status-badge status-approved">Present</span></td></tr>))}{historyList.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontStyle: 'italic' }}>No records found.</td></tr>}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- 📱 MOBILE FOOTER COMPONENT ---
const MobileFooter = ({ activePage, setActivePage }) => {
    return (
        <div className="mobile-footer">
            <button className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`} onClick={() => setActivePage('dashboard')}>
                <i className="fas fa-home"></i>
                <span>Home</span>
            </button>
            <button className={`nav-item ${activePage === 'analytics' ? 'active' : ''}`} onClick={() => setActivePage('analytics')}>
                <i className="fas fa-chart-bar"></i>
                <span>Stats</span>
            </button>
            <button className={`nav-item ${activePage === 'announcements' ? 'active' : ''}`} onClick={() => setActivePage('announcements')}>
                <i className="fas fa-bullhorn"></i>
                <span>Notice</span>
            </button>
            <button className={`nav-item ${activePage === 'addTasks' ? 'active' : ''}`} onClick={() => setActivePage('addTasks')}>
                <i className="fas fa-tasks"></i>
                <span>Tasks</span>
            </button>
            <button className={`nav-item ${activePage === 'profile' ? 'active' : ''}`} onClick={() => setActivePage('profile')}>
                <i className="fas fa-user"></i>
                <span>Profile</span>
            </button>
        </div>
    );
};

// ------------------------------------
//  MAIN TEACHER DASHBOARD WRAPPER
// ------------------------------------
export default function TeacherDashboard() {
    const [teacherInfo, setTeacherInfo] = useState(null);
    const [activePage, setActivePage] = useState('dashboard');
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [activeSession, setActiveSession] = useState(null);
    const [attendanceList, setAttendanceList] = useState([]);
    const [sessionLoading, setSessionLoading] = useState(false); // New Loading State

    // Year & Subject Logic
    const [selectedYear, setSelectedYear] = useState(null);
    const [showYearModal, setShowYearModal] = useState(false);

    // History State
    const [viewMode, setViewMode] = useState('live');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [historyList, setHistoryList] = useState([]);
    const [historyStats, setHistoryStats] = useState({ present: 0, absent: 0, total: 0 });
    const navigate = useNavigate();

    const playSessionStartSound = () => { const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3'); audio.play().catch(error => console.log("Audio play failed:", error)); };

    // 1. Fetch Teacher Info & Auto-Select Class
    useEffect(() => {
        if (!auth.currentUser) return;
        const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setTeacherInfo(data);

                // Auto Select if only 1 class exists in new structure
                if (data.assignedClasses && data.assignedClasses.length === 1) {
                    setSelectedYear(data.assignedClasses[0].year);
                }
                // Fallback for old structure
                else if (data.assignedYears && data.assignedYears.length === 1 && !data.assignedClasses) {
                    setSelectedYear(data.assignedYears[0]);
                }
                // Show modal if multiple
                else if ((data.assignedClasses?.length > 1 || data.assignedYears?.length > 1) && !selectedYear) {
                    setShowYearModal(true);
                }
                // Fallback for very old data
                else if (!selectedYear) {
                    setSelectedYear('All');
                }
            }
        });
        return () => unsub();
    }, [auth.currentUser, selectedYear]);

    // 2. Active Session Listener
    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, 'live_sessions'), where('teacherId', '==', auth.currentUser.uid), where('isActive', '==', true));
        const unsub = onSnapshot(q, (snap) => setActiveSession(!snap.empty ? { sessionId: snap.docs[0].id, ...snap.docs[0].data() } : null));
        return () => unsub();
    }, []);

    // 3. Attendance Listener (Live)
    useEffect(() => {
        let unsubscribe;
        if (activeSession && teacherInfo?.instituteId) {
            const q = query(
                collection(db, 'attendance'),
                where('sessionId', '==', activeSession.sessionId),
                where('instituteId', '==', teacherInfo.instituteId)
            );
            unsubscribe = onSnapshot(q, (snap) => setAttendanceList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        } else {
            setAttendanceList([]);
        }
        return () => { if (unsubscribe) unsubscribe(); };
    }, [activeSession, teacherInfo]);

    // 4. History Data Fetching (Updated for Dynamic Subject)
    useEffect(() => {
        const fetchHistory = async () => {
            if (!teacherInfo?.instituteId || !selectedYear) return;

            // Determine Subject
            let currentSubject = teacherInfo.subject;
            if (teacherInfo.assignedClasses) {
                const cls = teacherInfo.assignedClasses.find(c => c.year === selectedYear);
                if (cls) currentSubject = cls.subject;
            }

            const start = new Date(selectedDate); start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate); end.setHours(23, 59, 59, 999);

            // Get Total Students
            const qStudents = query(collection(db, 'users'), where('instituteId', '==', teacherInfo.instituteId), where('role', '==', 'student'), where('year', '==', selectedYear));
            const studentsSnap = await getDocs(qStudents);
            const total = studentsSnap.size;

            // Get Attendance
            const q = query(
                collection(db, 'attendance'),
                where('instituteId', '==', teacherInfo.instituteId),
                where('subject', '==', currentSubject), // ✅ Filter by Dynamic Subject
                where('timestamp', '>=', Timestamp.fromDate(start)),
                where('timestamp', '<=', Timestamp.fromDate(end))
            );

            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Optional: filter by targetYear if stored in attendance
            const filtered = list.filter(l => l.targetYear === selectedYear || l.targetYear === 'All' || !l.targetYear);

            setHistoryList(filtered);
            setHistoryStats({ total, present: filtered.length, absent: Math.max(0, total - filtered.length) });
        };
        if (viewMode === 'history') fetchHistory();
    }, [viewMode, selectedDate, teacherInfo, selectedYear]);

    // 5. Start Session Handler (Optimized)
    const handleSession = async () => {
        if (activeSession) {
            const toastId = toast.loading("Ending Session...");
            try {
                await fetch(`${BACKEND_URL}/endSession`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: activeSession.sessionId }) });
                toast.success("Session Ended", { id: toastId });
            } catch (e) { toast.error("Error: " + e.message, { id: toastId }); }
        } else {
            if (!teacherInfo?.instituteId) return toast.error("Institute ID missing.");

            // Determine Subject
            let currentSubject = teacherInfo.subject;
            if (teacherInfo.assignedClasses) {
                const cls = teacherInfo.assignedClasses.find(c => c.year === selectedYear);
                if (cls) currentSubject = cls.subject;
            }

            setSessionLoading(true);
            const startToast = toast.loading("Starting Class...");

            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(async (pos) => {
                    try {
                        const response = await fetch(`${BACKEND_URL}/startSession`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                teacherId: auth.currentUser.uid,
                                teacherName: teacherInfo.firstName,
                                subject: currentSubject,
                                department: teacherInfo.department,
                                year: selectedYear,
                                instituteId: teacherInfo.instituteId,
                                location: { 
                                    latitude: pos.coords.latitude, 
                                    longitude: pos.coords.longitude 
                                }
                            })
                        });

                        const data = await response.json();
                        if (response.ok) {
                            playSessionStartSound();
                            toast.success(`Session Started: ${currentSubject}`);
                        } else {
                            toast.error("Failed to start session: " + data.error);
                        }
                    } catch (err) {
                        toast.error("Network Error: " + err.message);
                    } finally {
                        setSessionLoading(false);
                        toast.dismiss(startToast);
                    }

                }, (err) => { 
                    toast.error("Location required."); 
                    setSessionLoading(false);
                    toast.dismiss(startToast);
                }, { enableHighAccuracy: true, timeout: 5000 });
            } else { 
                toast.error("Geolocation not supported."); 
                setSessionLoading(false);
                toast.dismiss(startToast);
            }
        }
    };

    const handleLogout = async () => { await signOut(auth); navigate('/'); };

    const renderContent = () => {
        if (!teacherInfo) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;
        if (showYearModal) return null;

        switch (activePage) {
            case 'dashboard': return <DashboardHome
                teacherInfo={teacherInfo}
                activeSession={activeSession}
                attendanceList={attendanceList}
                onSessionToggle={handleSession}
                viewMode={viewMode} setViewMode={setViewMode}
                selectedDate={selectedDate} setSelectedDate={setSelectedDate}
                historyList={historyList} historyStats={historyStats}
                selectedYear={selectedYear} // Passed selectedYear
                sessionLoading={sessionLoading} // Passed loading state
            />;
            case 'analytics': return <TeacherAnalytics teacherInfo={teacherInfo} selectedYear={selectedYear} />;
            case 'announcements': return <TeacherAnnouncements teacherInfo={teacherInfo} />;
            case 'addTasks': return <AddTasks />;
            case 'profile': return <Profile user={teacherInfo} />;
            default: return null;
        }
    };

    const csvHeaders = [{ label: "Roll No.", key: "rollNo" }, { label: "First Name", key: "firstName" }, { label: "Last Name", key: "lastName" }, { label: "Email", key: "studentEmail" }];
    const csvData = viewMode === 'live' ? attendanceList : historyList;
    const csvFilename = viewMode === 'live' ? `Live-${activeSession?.subject || 'Class'}.csv` : `Report-${selectedDate}.csv`;

    const NavLink = ({ page, iconClass, label }) => (
        <li className={activePage === page ? 'active' : ''} onClick={() => { setActivePage(page); setIsMobileNavOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <i className={`fas ${iconClass}`} style={{ width: '20px', textAlign: 'center' }}></i> <span>{label}</span>
        </li>
    );

    return (
        <div className="dashboard-container">
            {/* Year Selection Modal */}
            {showYearModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ width: '90%', maxWidth: '350px', textAlign: 'center', padding: '30px' }}>
                        <h2 style={{ color: '#1e293b', marginBottom: '10px' }}>Select Classroom</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Handle New Structure */}
                            {teacherInfo?.assignedClasses?.map(cls => (
                                <button key={cls.year} onClick={() => { setSelectedYear(cls.year); setShowYearModal(false); toast.success(`Entered ${cls.year} (${cls.subject})`); }} style={{ padding: '15px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{cls.year} - {cls.subject}</span><i className="fas fa-arrow-right" style={{ color: '#3b82f6' }}></i>
                                </button>
                            ))}
                            {/* Handle Legacy Structure */}
                            {!teacherInfo?.assignedClasses && teacherInfo?.assignedYears?.map(y => (
                                <button key={y} onClick={() => { setSelectedYear(y); setShowYearModal(false); }} style={{ padding: '15px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}><span>{y} Year</span></button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)}></div>}
            <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`}>
                <div className="logo-container"><img src={logo} alt="Logo" className="sidebar-logo" /><span className="logo-text">Acadex</span></div>
                {teacherInfo && (
                    <div className="teacher-info" onClick={() => { setActivePage('profile'); setIsMobileNavOpen(false); }} style={{ cursor: 'pointer' }}>
                        <h4>{teacherInfo.firstName} {teacherInfo.lastName}</h4>

                        {/* ✅ FIXED: Display subject based on the selected year */}
                        <p style={{ opacity: 0.8, fontSize: '13px' }}>
                            {teacherInfo.assignedClasses?.find(c => c.year === selectedYear)?.subject || "Select a Class"}
                        </p>

                        {/* Switch Class Button */}
                        {(teacherInfo.assignedClasses?.length > 1 || teacherInfo.assignedYears?.length > 1) && (
                            <div onClick={(e) => { e.stopPropagation(); setShowYearModal(true); }} className="edit-profile-pill" style={{ marginTop: '8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', justifyContent: 'center' }}>
                                <i className="fas fa-exchange-alt" style={{ fontSize: '10px' }}></i><span>Switch Class ({selectedYear})</span>
                            </div>
                        )}
                    </div>
                )}
                <ul className="menu">
                    <NavLink page="dashboard" iconClass="fa-th-large" label="Dashboard" />
                    <NavLink page="analytics" iconClass="fa-chart-bar" label="Analytics" />
                    <NavLink page="announcements" iconClass="fa-bullhorn" label="Announcements" />
                    <NavLink page="addTasks" iconClass="fa-tasks" label="Add Tasks" />
                    <li onClick={() => setIsMobileNavOpen(false)} style={{ marginTop: 'auto', marginBottom: '10px' }}>
                        <CSVLink data={csvData} headers={csvHeaders} filename={csvFilename} className="csv-link"><i className="fas fa-file-download"></i><span>Download Sheet</span></CSVLink>
                    </li>
                </ul>
                <div className="sidebar-footer"><button onClick={handleLogout} className="logout-btn"><i className="fas fa-sign-out-alt"></i><span>Logout</span></button></div>
            </aside>
            <main className="main-content">
                <header className="mobile-header"><button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}><i className="fas fa-bars"></i></button><div className="mobile-brand"><img src={logo} alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">AcadeX</span></div><div style={{ width: '40px' }}></div></header>
                {renderContent()}

                {/* ✅ MOBILE FOOTER */}
                <MobileFooter activePage={activePage} setActivePage={setActivePage} />
            </main>
        </div>
    );
}