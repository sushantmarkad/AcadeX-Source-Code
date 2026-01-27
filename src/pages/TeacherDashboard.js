import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, doc, getDoc, serverTimestamp, onSnapshot, query, where, getDocs, addDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { CSVLink } from 'react-csv';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import './Dashboard.css';

// Component Imports
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
//  COMPONENT: TEACHER ANALYTICS
// ------------------------------------
const TeacherAnalytics = ({ teacherInfo, selectedYear }) => {
    const [weeklyData, setWeeklyData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!teacherInfo || !selectedYear) return;
            setLoading(true);

            let currentSubject = teacherInfo.subject;
            if (teacherInfo.assignedClasses) {
                const classData = teacherInfo.assignedClasses.find(c => c.year === selectedYear);
                if (classData) currentSubject = classData.subject;
            }

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);

            try {
                // 1. Get Total Class Size
                const qStudents = query(
                    collection(db, 'users'), 
                    where('instituteId', '==', teacherInfo.instituteId),
                    where('role', '==', 'student'),
                    where('year', '==', selectedYear),
                    where('department', '==', teacherInfo.department)
                );
                const studentsSnap = await getDocs(qStudents);
                const totalStudents = studentsSnap.size;

                // 2. Get Attendance
                const q = query(
                    collection(db, 'attendance'),
                    where('instituteId', '==', teacherInfo.instituteId),
                    where('subject', '==', currentSubject),
                    where('timestamp', '>=', Timestamp.fromDate(startDate))
                );
                const snap = await getDocs(q);

                // 3. Process Data: Group by Date AND Session
                const dayStats = {}; // { 'Mon': { sessions: Set(sessionIds), presentCount: 0 } }

                snap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.year === selectedYear || data.targetYear === selectedYear || data.year === 'All') {
                        const date = data.timestamp.toDate();
                        const dayStr = date.toLocaleDateString('en-GB', { weekday: 'short' });
                        const sessId = data.sessionId;

                        if (!dayStats[dayStr]) dayStats[dayStr] = { sessions: new Set(), presentCount: 0 };
                        
                        // We count TOTAL presents across all sessions for that day
                        dayStats[dayStr].presentCount++;
                        dayStats[dayStr].sessions.add(sessId);
                    }
                });

                const chartData = Object.keys(dayStats).map(key => {
                    const sessionsCount = dayStats[key].sessions.size || 1;
                    const totalCapacity = totalStudents * sessionsCount; 
                    const actualPresent = dayStats[key].presentCount;
                    
                    return {
                        name: key,
                        present: actualPresent,
                        absent: Math.max(0, totalCapacity - actualPresent)
                    };
                });

                setWeeklyData(chartData);

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [teacherInfo, selectedYear]);

    return (
        <div className="content-section">
            <h2 className="content-title">Weekly Analytics</h2>
            <div className="card">
                <h3>Attendance Overview ({selectedYear})</h3>
                {loading ? <p>Loading...</p> : (
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="present" name="Present" fill="#10b981" stackId="a" />
                                <Bar dataKey="absent" name="Absent" fill="#ef4444" stackId="a" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
};

// ------------------------------------
//  DASHBOARD HOME (Updated with Lab/Practical Logic)
// ------------------------------------
const DashboardHome = ({ teacherInfo, activeSession, attendanceList, onSessionToggle, viewMode, setViewMode, selectedDate, setSelectedDate, historySessions, selectedYear, sessionLoading, sessionType, setSessionType, selectedBatch, setSelectedBatch, rollStart, setRollStart, rollEnd, setRollEnd }) => {
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

    // SORTING FIX: Ensure list is sorted by Roll No (Numeric)
    const sortedAttendanceList = [...attendanceList].sort((a, b) => {
        return parseInt(a.rollNo) - parseInt(b.rollNo);
    });

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
                    subject: currentSubject,
                    type: activeSession.type || 'theory', // Send type
                    batch: activeSession.batch || 'All'   // Send batch
                })
            });
            const data = await response.json();
            if (response.ok) {
                toast.success(data.message, { id: toastId });
                setAbsentList("");
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
                    {/* --- START SESSION CARD --- */}
                    <div className="card" style={{ background: isSessionRelevant ? 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)' : 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)', border: isSessionRelevant ? '1px solid #a7f3d0' : '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <div className="icon-box-modern" style={{ background: 'white', color: isSessionRelevant ? '#15803d' : '#1e40af' }}><i className={`fas ${isSessionRelevant ? 'fa-broadcast-tower' : 'fa-play'}`}></i></div>
                                <div>
                                    <h3 style={{ margin: 0, color: isSessionRelevant ? '#14532d' : '#1e3a8a', fontSize: '18px', fontWeight: '700' }}>{isSessionRelevant ? 'Session Live' : 'Start Class'}</h3>
                                    {isSessionRelevant && <span className="status-badge-pill" style={{ background: 'white', color: '#15803d', fontSize: '10px', padding: '2px 8px', marginTop: '4px' }}>ACTIVE</span>}
                                </div>
                            </div>

                            {!isSessionRelevant && (
                                <div style={{ marginBottom: '15px' }}>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                        <button
                                            onClick={() => setSessionType('theory')}
                                            style={{ flex: 1, padding: '6px', borderRadius: '6px', border: 'none', background: sessionType === 'theory' ? '#2563eb' : 'white', color: sessionType === 'theory' ? 'white' : '#64748b', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Theory
                                        </button>
                                        <button
                                            onClick={() => setSessionType('practical')}
                                            style={{ flex: 1, padding: '6px', borderRadius: '6px', border: 'none', background: sessionType === 'practical' ? '#2563eb' : 'white', color: sessionType === 'practical' ? 'white' : '#64748b', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Practical
                                        </button>
                                    </div>

                                    {sessionType === 'practical' && (
                                        <div style={{ marginTop: '15px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <div className="input-group" style={{ marginBottom: '10px' }}>
                                                <label style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold' }}>Select Batch Name</label>
                                                <select
                                                    value={selectedBatch}
                                                    onChange={(e) => setSelectedBatch(e.target.value)}
                                                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '13px' }}
                                                >
                                                    {['A', 'B', 'C', 'D', 'E'].map(b => <option key={b} value={b}>Batch {b}</option>)}
                                                </select>
                                            </div>

                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <div className="input-group" style={{ marginBottom: '0', flex: 1 }}>
                                                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>Start Roll No.</label>
                                                    <input
                                                        type="number"
                                                        value={rollStart}
                                                        onChange={(e) => setRollStart(e.target.value)}
                                                        placeholder="1"
                                                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '13px' }}
                                                    />
                                                </div>
                                                <div className="input-group" style={{ marginBottom: '0', flex: 1 }}>
                                                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>End Roll No.</label>
                                                    <input
                                                        type="number"
                                                        value={rollEnd}
                                                        onChange={(e) => setRollEnd(e.target.value)}
                                                        placeholder="20"
                                                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '13px' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <p style={{ color: isSessionRelevant ? '#166534' : '#1e40af', marginBottom: '20px', fontSize: '13px', opacity: 0.9 }}>
                                {isSessionRelevant
                                    ? `Subject: ${currentSubject} ${activeSession.type === 'practical' ? `(Lab - Batch ${activeSession.batch})` : '(Theory)'} | Refresh: ${timer}s`
                                    : `Start ${sessionType === 'practical' ? `Lab (Batch ${selectedBatch})` : 'Theory'} for ${selectedYear} Year.`
                                }
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
                        <div style={{ marginTop: 'auto' }}><div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}><span style={{ fontSize: '56px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1' }}>{isSessionRelevant ? sortedAttendanceList.length : 0}</span><span style={{ color: 'var(--text-secondary)', fontSize: '16px', fontWeight: 500 }}>Students</span></div></div>
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
                                    <tbody>{sortedAttendanceList.map(s => (<tr key={s.id}><td style={{ fontWeight: '600', color: '#334155' }}>{s.rollNo}</td><td style={{ fontWeight: '500' }}>{s.firstName} {s.lastName}</td></tr>))}{sortedAttendanceList.length === 0 && <tr><td colSpan="2" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}><i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Waiting for scans...</td></tr>}</tbody>
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

            {/* --- NEW HISTORY VIEW: SESSION BASED --- */}
            {viewMode === 'history' && (
                <div className="cards-grid">
                    {/* DATE SELECTOR HEADER */}
                    <div className="card card-full-width" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: '#f8fafc' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Select Date</label>
                            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '15px' }} />
                        </div>
                        <div style={{ flex: 2 }}>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Viewing Report for:</p>
                            <h3 style={{ margin: '4px 0 0 0', fontSize: '22px', color: '#1e293b' }}>{formattedDate} ({selectedYear})</h3>
                        </div>
                    </div>

                    {/* SESSION CARDS */}
                    {historySessions.length === 0 ? (
                        <div className="card card-full-width" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                            <i className="fas fa-calendar-times" style={{ fontSize: '30px', marginBottom: '10px' }}></i>
                            <p>No sessions found for this date.</p>
                        </div>
                    ) : (
                        historySessions.map((session, index) => (
                            <div key={session.sessionId} className="card card-full-width" style={{ marginTop: '20px', borderLeft: session.type === 'practical' ? '5px solid #8b5cf6' : '5px solid #3b82f6' }}>
                                {/* SESSION HEADER */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '15px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                            {/* Time Badge */}
                                            <span style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                                                {session.startTime}
                                            </span>
                                            
                                            {/* Type Badge (THEORY vs PRACTICAL) */}
                                            {session.type === 'practical' ? (
                                                <span style={{ background: '#ede9fe', color: '#7c3aed', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                    🧪 Practical (Batch {session.batch})
                                                </span>
                                            ) : (
                                                <span style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                    📚 Theory
                                                </span>
                                            )}
                                        </div>
                                        
                                        <p style={{ fontSize: '13px', color: '#64748b', margin: '8px 0 0 0' }}>
                                            Present: <strong style={{ color: '#166534' }}>{session.presentCount}</strong> | Absent: <strong style={{ color: '#dc2626' }}>{session.absentCount}</strong>
                                        </p>
                                    </div>

                                    {/* ✅ FIXED CSV: Pass Type and Batch directly as data, use strings for keys */}
                                    <CSVLink 
                                        data={session.students.map(s => ({
                                            ...s,
                                            type: session.type === 'practical' ? 'Practical' : 'Theory',
                                            batch: session.type === 'practical' ? session.batch : 'All'
                                        }))} 
                                        headers={[
                                            { label: "Roll No", key: "rollNo" },
                                            { label: "Name", key: "name" },
                                            { label: "Status", key: "status" },
                                            { label: "Time In", key: "timeIn" },
                                            { label: "Type", key: "type" },
                                            { label: "Batch", key: "batch" }
                                        ]}
                                        filename={`${session.type}-Attendance-${formattedDate}-${session.batch}.csv`}
                                        style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: '600' }}
                                    >
                                        <i className="fas fa-download"></i> CSV
                                    </CSVLink>
                                </div>

                                {/* STUDENT TABLE */}
                                <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    <table className="attendance-table">
                                        <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                                            <tr><th>Roll No</th><th>Name</th><th>Status</th></tr>
                                        </thead>
                                        <tbody>
                                            {session.students.map(s => (
                                                <tr key={s.id} style={{ background: s.status === 'Absent' ? '#fef2f2' : 'white' }}>
                                                    <td style={{ fontWeight: 'bold' }}>{s.rollNo}</td>
                                                    <td>{s.name}</td>
                                                    <td>
                                                        <span className={`status-badge ${s.status === 'Present' ? 'status-approved' : 'status-rejected'}`}>
                                                            {s.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}
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
    const [sessionLoading, setSessionLoading] = useState(false);

    // Year & Subject Logic
    const [selectedYear, setSelectedYear] = useState(null);
    const [showYearModal, setShowYearModal] = useState(false);

    // Lab / Practical State
    const [sessionType, setSessionType] = useState('theory'); // 'theory' | 'practical'
    const [selectedBatch, setSelectedBatch] = useState('A');
    const [rollStart, setRollStart] = useState(1);
    const [rollEnd, setRollEnd] = useState(20);

    // History State
    const [viewMode, setViewMode] = useState('live');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    // ✅ NEW: Store an array of SESSIONS, not just a flat list of students
    const [historySessions, setHistorySessions] = useState([]);
    const navigate = useNavigate();

    const playSessionStartSound = () => { const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3'); audio.play().catch(error => console.log("Audio play failed:", error)); };

    useEffect(() => {
        if (!auth.currentUser) return;
        const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setTeacherInfo(data);
                if (data.assignedClasses && data.assignedClasses.length === 1) {
                    setSelectedYear(data.assignedClasses[0].year);
                } else if (data.assignedYears && data.assignedYears.length === 1 && !data.assignedClasses) {
                    setSelectedYear(data.assignedYears[0]);
                } else if ((data.assignedClasses?.length > 1 || data.assignedYears?.length > 1) && !selectedYear) {
                    setShowYearModal(true);
                } else if (!selectedYear) {
                    setSelectedYear('All');
                }
            }
        });
        return () => unsub();
    }, [auth.currentUser, selectedYear]);

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, 'live_sessions'), where('teacherId', '==', auth.currentUser.uid), where('isActive', '==', true));
        const unsub = onSnapshot(q, (snap) => setActiveSession(!snap.empty ? { sessionId: snap.docs[0].id, ...snap.docs[0].data() } : null));
        return () => unsub();
    }, []);

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

    // ✅ NEW HISTORY LOGIC: Group by Session (Separates Morning/Afternoon classes)
   // ✅ NEW HISTORY LOGIC: Filter Student List by Roll Range for Practicals
    useEffect(() => {
        const fetchHistory = async () => {
            if (!teacherInfo?.instituteId || !selectedYear) return;

            let currentSubject = teacherInfo.subject;
            if (teacherInfo.assignedClasses) {
                const cls = teacherInfo.assignedClasses.find(c => c.year === selectedYear);
                if (cls) currentSubject = cls.subject;
            }

            const start = new Date(selectedDate); start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate); end.setHours(23, 59, 59, 999);

            try {
                // 1. Get ALL Students (Master List)
                const qStudents = query(
                    collection(db, 'users'), 
                    where('instituteId', '==', teacherInfo.instituteId), 
                    where('role', '==', 'student'), 
                    where('year', '==', selectedYear),
                    where('department', '==', teacherInfo.department)
                );
                const studentsSnap = await getDocs(qStudents);
                const allStudents = studentsSnap.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(), 
                    rollNo: parseInt(doc.data().rollNo) || 9999 
                }));

                // 2. Get Attendance Records
                const qAttendance = query(
                    collection(db, 'attendance'),
                    where('instituteId', '==', teacherInfo.instituteId),
                    where('subject', '==', currentSubject),
                    where('timestamp', '>=', Timestamp.fromDate(start)),
                    where('timestamp', '<=', Timestamp.fromDate(end))
                );
                const attSnap = await getDocs(qAttendance);

                // 3. FETCH SESSION DETAILS (Type, Batch, & Roll Range)
                const uniqueSessionIds = new Set();
                attSnap.docs.forEach(d => uniqueSessionIds.add(d.data().sessionId));

                const sessionMetaMap = {};
                await Promise.all(Array.from(uniqueSessionIds).map(async (sId) => {
                    try {
                        const sDoc = await getDoc(doc(db, 'live_sessions', sId));
                        if (sDoc.exists()) {
                            sessionMetaMap[sId] = sDoc.data();
                        }
                    } catch (e) { console.error("Error fetching session details", e); }
                }));

                // 4. GROUP BY SESSION ID
                const sessionsMap = {}; 
                
                attSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const sId = data.sessionId;
                    const meta = sessionMetaMap[sId] || {};

                    if (!sessionsMap[sId]) {
                        sessionsMap[sId] = {
                            sessionId: sId,
                            startTime: data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            type: meta.type || 'theory', 
                            batch: meta.batch || 'All',
                            rollRange: meta.rollRange || null, // ✅ Capture Roll Range
                            presentRolls: new Set()
                        };
                    }
                    sessionsMap[sId].presentRolls.add(parseInt(data.rollNo));
                });

                // 5. BUILD REPORT CARDS (With Range Filtering)
                const finalSessions = Object.values(sessionsMap).map(session => {
                    
                    // ✅ KEY FIX: Filter the Class List based on Roll Range
                    let targetStudents = allStudents;

                    if (session.type === 'practical' && session.rollRange) {
                        const { start, end } = session.rollRange;
                        // Only include students who are inside the range [start, end]
                        targetStudents = allStudents.filter(s => s.rollNo >= start && s.rollNo <= end);
                    }

                    const studentsWithStatus = targetStudents.map(student => {
                        const isPresent = session.presentRolls.has(student.rollNo);
                        return {
                            id: student.id,
                            rollNo: student.rollNo,
                            name: `${student.firstName} ${student.lastName}`,
                            status: isPresent ? 'Present' : 'Absent',
                            timeIn: isPresent ? session.startTime : '-'
                        };
                    });
                    
                    studentsWithStatus.sort((a, b) => a.rollNo - b.rollNo);

                    // Recalculate stats based on the FILTERED list
                    const presentCount = studentsWithStatus.filter(s => s.status === 'Present').length;
                    const absentCount = studentsWithStatus.filter(s => s.status === 'Absent').length;

                    return {
                        sessionId: session.sessionId,
                        startTime: session.startTime,
                        type: session.type,
                        batch: session.batch,
                        totalStudents: targetStudents.length, // Correct Total for Batch
                        presentCount: presentCount,
                        absentCount: absentCount,
                        students: studentsWithStatus
                    };
                });
                
                finalSessions.sort((a, b) => a.startTime.localeCompare(b.startTime));
                setHistorySessions(finalSessions);

            } catch (err) {
                console.error("History Error:", err);
            }
        };

        if (viewMode === 'history') fetchHistory();
    }, [viewMode, selectedDate, teacherInfo, selectedYear]);

    const handleSession = async () => {
        if (activeSession) {
            const toastId = toast.loading("Ending Session...");
            try {
                await fetch(`${BACKEND_URL}/endSession`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: activeSession.sessionId }) });
                toast.success("Session Ended", { id: toastId });
            } catch (e) { toast.error("Error: " + e.message, { id: toastId }); }
        } else {
            if (!teacherInfo?.instituteId) return toast.error("Institute ID missing.");

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
                                },
                                type: sessionType, 
                                batch: sessionType === 'practical' ? selectedBatch : 'All',
                                rollRange: sessionType === 'practical' 
                                    ? { start: parseInt(rollStart), end: parseInt(rollEnd) } 
                                    : null
                            })
                        });

                        const data = await response.json();
                        if (response.ok) {
                            playSessionStartSound();
                            toast.success(`Session Started: ${currentSubject} (${sessionType})`);
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
                historySessions={historySessions}
                selectedYear={selectedYear}
                sessionLoading={sessionLoading}
                sessionType={sessionType}
                setSessionType={setSessionType}
                selectedBatch={selectedBatch}
                setSelectedBatch={setSelectedBatch}
                rollStart={rollStart} setRollStart={setRollStart}
                rollEnd={rollEnd} setRollEnd={setRollEnd}
            />;
            case 'analytics': return <TeacherAnalytics teacherInfo={teacherInfo} selectedYear={selectedYear} />;
            case 'announcements': return <TeacherAnnouncements teacherInfo={teacherInfo} />;
            case 'addTasks': return <AddTasks />;
            case 'profile': return <Profile user={teacherInfo} />;
            default: return null;
        }
    };

    // CSV Logic for Flattened Sessions (Sidebar Download)
    const rawData = viewMode === 'live' 
        ? attendanceList 
        : historySessions.flatMap(session => 
            session.students.map(s => ({
                ...s,
                timeIn: s.status === 'Present' ? session.startTime : 'N/A',
                type: session.type, // Add type to sidebar download
                batch: session.batch // Add batch to sidebar download
            }))
        );

    const sortedData = [...rawData].sort((a, b) => parseInt(a.rollNo) - parseInt(b.rollNo));
    
    const csvData = sortedData.map(student => ({
        rollNo: student.rollNo,
        studentName: student.name || `${student.firstName} ${student.lastName}`, 
        email: student.email || student.studentEmail || '-',
        timeIn: student.timeIn || (student.timestamp?.toDate ? student.timestamp.toDate().toLocaleTimeString() : 'N/A'),
        status: student.status || 'Present',
        type: student.type || (activeSession?.type === 'practical' ? 'Practical' : 'Theory'),
        batch: student.batch || (activeSession?.type === 'practical' ? activeSession.batch : 'All')
    }));

    const csvHeaders = [
        { label: "Roll No.", key: "rollNo" }, 
        { label: "Student Name", key: "studentName" }, 
        { label: "Time In", key: "timeIn" },
        { label: "Status", key: "status" },
        { label: "Type", key: "type" },
        { label: "Batch", key: "batch" }
    ];

    const csvFilename = viewMode === 'live' ? `Live-${activeSession?.subject || 'Class'}.csv` : `Report-${selectedDate}.csv`;

    const NavLink = ({ page, iconClass, label }) => (
        <li className={activePage === page ? 'active' : ''} onClick={() => { setActivePage(page); setIsMobileNavOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <i className={`fas ${iconClass}`} style={{ width: '20px', textAlign: 'center' }}></i> <span>{label}</span>
        </li>
    );

    return (
        <div className="dashboard-container">
            {showYearModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ width: '90%', maxWidth: '350px', textAlign: 'center', padding: '30px' }}>
                        <h2 style={{ color: '#1e293b', marginBottom: '10px' }}>Select Classroom</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {teacherInfo?.assignedClasses?.map(cls => (
                                <button key={cls.year} onClick={() => { setSelectedYear(cls.year); setShowYearModal(false); toast.success(`Entered ${cls.year} (${cls.subject})`); }} style={{ padding: '15px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{cls.year} - {cls.subject}</span><i className="fas fa-arrow-right" style={{ color: '#3b82f6' }}></i>
                                </button>
                            ))}
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
                        <p style={{ opacity: 0.8, fontSize: '13px' }}>
                            {teacherInfo.assignedClasses?.find(c => c.year === selectedYear)?.subject || "Select a Class"}
                        </p>
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
                <MobileFooter activePage={activePage} setActivePage={setActivePage} />
            </main>
        </div>
    );
}