import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../firebase';
import { collection, doc, getDoc, serverTimestamp, onSnapshot, query, where, getDocs, setDoc, addDoc, deleteDoc, updateDoc, Timestamp, writeBatch, increment } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { CSVLink } from 'react-csv';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LabelList } from 'recharts';
import './Dashboard.css';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import CustomDropdown from '../components/CustomDropdown';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

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
//  COMPONENT: ANNOUNCEMENTS (Styled like Add Tasks)
// ------------------------------------
const TeacherAnnouncements = ({ teacherInfo }) => {
    const [form, setForm] = useState({ title: '', message: '', targetYear: '' });
    const [file, setFile] = useState(null);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('create');

    const assignedYears = teacherInfo?.assignedClasses
        ? [...new Set(teacherInfo.assignedClasses.map(c => c.year))]
        : [];

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
        if (!form.targetYear) return toast.error("Please select a target class.");

        setLoading(true);
        const toastId = toast.loading("Uploading & Posting...");
        try {
            let attachmentUrl = "";
            if (file) {
                const fileRef = ref(storage, `notices/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
                await uploadBytes(fileRef, file);
                attachmentUrl = await getDownloadURL(fileRef);
            }

            // 1. Save to Firestore
            await addDoc(collection(db, 'announcements'), {
                ...form,
                attachmentUrl,
                teacherId: auth.currentUser.uid,
                teacherName: `${teacherInfo.firstName} ${teacherInfo.lastName}`,
                department: teacherInfo.department,
                instituteId: teacherInfo.instituteId,
                role: 'teacher',
                createdAt: serverTimestamp()
            });

            // 2. Trigger Notification (✅ NEW CODE)
            fetch(`${BACKEND_URL}/sendAnnouncementNotification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `📢 New Notice: ${form.title}`,
                    message: form.message, // Or a substring if too long
                    targetYear: form.targetYear,
                    instituteId: teacherInfo.instituteId,
                    department: teacherInfo.department,
                    senderName: `${teacherInfo.firstName} ${teacherInfo.lastName}`
                })
            }).catch(err => console.error("Notification trigger failed:", err));

            toast.success("Announcement Posted & Notified!", { id: toastId });
            setForm({ title: '', message: '', targetYear: '' });
            setFile(null);
            setActiveTab('history');
        } catch (err) {
            toast.error("Failed to post.", { id: toastId });
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
        <div className="task-page-container">

            {/* --- HEADER (Matches Add Tasks) --- */}
            <div className="task-header">
                <div>
                    <h2 className="gradient-text">Class Announcements</h2>
                    <p className="subtitle">Broadcast updates to your students.</p>
                </div>

                <div className="toggle-container">
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`toggle-btn ${activeTab === 'create' ? 'active-create' : ''}`}>
                        <i className="fas fa-pen-fancy"></i> Compose
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`toggle-btn ${activeTab === 'history' ? 'active-eval' : ''}`}>
                        <i className="fas fa-history"></i> History
                    </button>
                </div>
            </div>

            {/* --- CREATE MODE --- */}
            {activeTab === 'create' && (
                <div className="create-card">
                    <div className="create-card-header">
                        <h3><i className="fas fa-bullhorn"></i> New Announcement</h3>
                    </div>

                    <form onSubmit={handlePost} className="create-form">
                        {/* Main Inputs */}
                        <div className="form-main">
                            <div className="input-group">
                                <label>Title</label>
                                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Exam Schedule Changed" />
                            </div>
                            <div className="input-group">
                                <label>Message</label>
                                <textarea required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows="6" placeholder="Type your important message here..." />
                            </div>
                        </div>

                        {/* Sidebar Inputs */}
                        <div className="form-sidebar">
                            <div className="input-group">
                                <label>Target Class</label>
                                <CustomDropdown
                                    value={form.targetYear}
                                    onChange={(e) => setForm({ ...form, targetYear: e.target.value })}
                                    placeholder="Select Class"
                                    options={[
                                        { value: 'All', label: 'All My Classes' },
                                        ...assignedYears.map(year => ({ value: year, label: `${year} Year` }))
                                    ]}
                                />
                            </div>

                            {/* File Upload */}
                            <div className="input-group">
                                <label>Attachment (Optional)</label>
                                <div className="file-upload-wrapper">
                                    <input
                                        type="file"
                                        id="anno-file"
                                        onChange={e => setFile(e.target.files[0])}
                                        style={{ display: 'none' }}
                                    />
                                    <label htmlFor="anno-file" className="custom-file-upload">
                                        <i className={`fas ${file ? 'fa-check-circle' : 'fa-cloud-upload-alt'}`}></i>
                                        <span>{file ? file.name : "Click to Attach PDF / Image"}</span>
                                    </label>
                                </div>
                            </div>

                            <button className="submit-btn" disabled={loading}>
                                {loading ? 'Posting...' : 'Post Now'} <i className="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* --- HISTORY MODE (Styled like Task Cards) --- */}
            {activeTab === 'history' && (
                <div className="tasks-grid">
                    {announcements.length > 0 ? (
                        announcements.map(ann => (
                            <div key={ann.id} className="task-card-modern">
                                <div className="card-top">
                                    <span className={`badge ${ann.targetYear === 'All' ? 'badge-all' : 'badge-year'}`}>
                                        {ann.targetYear === 'All' ? 'All Classes' : `${ann.targetYear} Year`}
                                    </span>
                                    {ann.attachmentUrl && <i className="fas fa-paperclip attachment-icon"></i>}
                                </div>

                                <h4>{ann.title}</h4>
                                <p className="card-msg">{ann.message}</p>

                                {ann.attachmentUrl && (
                                    <a href={ann.attachmentUrl} target="_blank" rel="noreferrer" className="view-doc-btn" style={{ marginTop: 'auto', width: 'fit-content' }}>
                                        <i className="fas fa-eye"></i> View File
                                    </a>
                                )}

                                <div className="card-footer">
                                    <span><i className="far fa-clock"></i> {ann.createdAt?.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                    <button onClick={() => handleDelete(ann.id)} className="delete-icon-btn">
                                        <i className="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="empty-state">
                            <i className="fas fa-inbox"></i>
                            <p>No announcements posted yet.</p>
                        </div>
                    )}
                </div>
            )}

            {/* --- SHARED CSS (Copied & Adapted from AddTasks.js) --- */}
            <style>{`
                /* Container & Header */
                .task-page-container { max-width: 1200px; margin: 0 auto; padding-bottom: 120px; }
                .task-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
                
                .gradient-text { 
                    background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                    font-size: 24px; margin: 0; 
                }
                .subtitle { color: #64748b; font-size: 14px; margin-top: 5px; }

                /* Toggles */
                .toggle-container { background: white; padding: 4px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); display: flex; gap: 5px; }
                .toggle-btn { padding: 8px 16px; border: none; background: transparent; color: #64748b; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s; font-size: 13px; }
                .active-create { background: #f3e8ff; color: #7c3aed; }
                .active-eval { background: #fce7f3; color: #db2777; } /* Using pink/violet theme */

                /* Create Card */
                .create-card { background: white; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #f1f5f9; }
                .create-card-header { background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%); padding: 15px 25px; color: white; }
                .create-card-header h3 { margin: 0; font-size: 16px; font-weight: 600; }

                .create-form { padding: 25px; display: grid; grid-template-columns: 2fr 1fr; gap: 30px; }

                /* Inputs */
                .input-group label { display: block; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
                .input-group input, .input-group textarea, .input-group select { width: 100%; padding: 12px; border: 2px solid #f1f5f9; border-radius: 10px; font-size: 14px; transition: border 0.2s; background: #f8fafc; color: #334155; }
                .input-group input:focus, .input-group textarea:focus, .input-group select:focus { border-color: #d946ef; outline: none; background: white; }

                /* --- FIXED FILE UPLOAD CSS --- */
./* --- PERFECTLY CENTERED UPLOAD BOX --- */
.file-upload-wrapper {
    width: 100%;
    display: block;
}

.custom-file-upload {
    /* Flexbox Magic for Centering */
    display: flex;
    flex-direction: column;
    align-items: center;      /* Horizontal Center */
    justify-content: center;  /* Vertical Center */
    text-align: center;       /* Text Center fallback */
    
    width: 100%;
    box-sizing: border-box;
    padding: 30px 20px;
    
    border: 2px dashed #cbd5e1;
    border-radius: 12px;
    background: #f8fafc;
    cursor: pointer;
    transition: all 0.2s ease;
}

.custom-file-upload:hover {
    border-color: #d946ef;
    background: #fdf4ff;
}

.custom-file-upload i {
    font-size: 32px;
    color: #d946ef;
    
    /* ✅ FORCE ICON TO MIDDLE */
    display: block;
    margin: 0 auto 10px auto; /* Top: 0, Side: Auto (Center), Bottom: 10px */
}

.custom-file-upload span {
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
    display: block; /* Ensures text takes its own line */
}

                /* Submit Button */
                .submit-btn { width: 100%; padding: 14px; background: linear-gradient(90deg, #7c3aed, #db2777); color: white; border: none; border-radius: 10px; font-weight: 600; margin-top: 15px; cursor: pointer; box-shadow: 0 4px 15px rgba(219, 39, 119, 0.3); display: flex; justify-content: center; align-items: center; gap: 8px; }

                /* Cards Grid */
                .tasks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
                .task-card-modern { background: white; border-radius: 16px; padding: 20px; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px rgba(0,0,0,0.02); cursor: default; display: flex; flexDirection: column; transition: transform 0.2s; min-height: 200px; }
                .task-card-modern:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.08); border-color: #e2e8f0; }
                
                .card-top { display: flex; justify-content: space-between; margin-bottom: 12px; }
                .badge { font-size: 10px; padding: 4px 10px; border-radius: 20px; font-weight: 700; text-transform: uppercase; }
                .badge-all { background: #f3e8ff; color: #7c3aed; }
                .badge-year { background: #ecfeff; color: #06b6d4; }
                .attachment-icon { color: #cbd5e1; }

                .task-card-modern h4 { margin: 0 0 10px 0; color: #334155; font-size: 16px; line-height: 1.4; }
                .card-msg { font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 15px 0; flex-grow: 1; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }

                .view-doc-btn { text-decoration: none; color: #d946ef; font-weight: 600; font-size: 12px; background: #fdf4ff; padding: 6px 12px; border-radius: 15px; display: inline-flex; align-items: center; gap: 5px; }

                .card-footer { border-top: 1px solid #f8fafc; padding-top: 15px; margin-top: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #94a3b8; }
                .delete-icon-btn { background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 14px; padding: 5px; opacity: 0.7; transition: opacity 0.2s; }
                .delete-icon-btn:hover { opacity: 1; }

                .empty-state { grid-column: 1 / -1; text-align: center; padding: 60px; color: #cbd5e1; background: white; border-radius: 16px; border: 2px dashed #e2e8f0; }
                .empty-state i { font-size: 40px; margin-bottom: 15px; }

                /* --- MOBILE RESPONSIVE --- */
                @media (max-width: 768px) {
                    .task-header { flex-direction: column; align-items: flex-start; gap: 15px; }
                    .toggle-container { width: 100%; justify-content: space-between; }
                    .toggle-btn { flex: 1; text-align: center; }
                    
                    /* Stack form vertically */
                    .create-form { grid-template-columns: 1fr; gap: 20px; padding: 20px; }
                    
                    /* Adjust cards for mobile */
                    .tasks-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};
// ------------------------------------
//  COMPONENT: TEACHER ANALYTICS (With Gradient Title)
// ------------------------------------
const TeacherAnalytics = ({ teacherInfo, selectedYear }) => {
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [graphType, setGraphType] = useState('theory');
    const [timeRange, setTimeRange] = useState('week');
    const [classStrength, setClassStrength] = useState(0);

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
            if (timeRange === 'week') {
                startDate.setDate(endDate.getDate() - 6);
            } else {
                startDate.setDate(endDate.getDate() - 29);
            }
            startDate.setHours(0, 0, 0, 0);

            try {
                // 1. Get Class Strength
                const qStudents = query(
                    collection(db, 'users'),
                    where('instituteId', '==', teacherInfo.instituteId),
                    where('role', '==', 'student'),
                    where('year', '==', selectedYear),
                    where('department', '==', teacherInfo.department)
                );
                const studentsSnap = await getDocs(qStudents);
                const totalStudents = studentsSnap.size || 1;
                setClassStrength(totalStudents);

                // 2. Get Attendance Logs
                const q = query(
                    collection(db, 'attendance'),
                    where('instituteId', '==', teacherInfo.instituteId),
                    where('subject', '==', currentSubject),
                    where('timestamp', '>=', Timestamp.fromDate(startDate))
                );
                const snap = await getDocs(q);

                const sessionIds = new Set();
                snap.docs.forEach(d => sessionIds.add(d.data().sessionId));

                const sessionTypes = {};
                await Promise.all(Array.from(sessionIds).map(async (sid) => {
                    const sDoc = await getDoc(doc(db, 'live_sessions', sid));
                    if (sDoc.exists()) {
                        sessionTypes[sid] = sDoc.data().type || 'theory';
                    }
                }));

                const stats = {};
                snap.docs.forEach(doc => {
                    const data = doc.data();
                    const sType = sessionTypes[data.sessionId] || 'theory';

                    if (sType === graphType) {
                        const date = data.timestamp.toDate();
                        const dayStr = timeRange === 'week'
                            ? date.toLocaleDateString('en-GB', { weekday: 'short' })
                            : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

                        const sortKey = date.toISOString().split('T')[0];
                        if (!stats[sortKey]) {
                            stats[sortKey] = {
                                name: dayStr,
                                present: 0,
                                uniqueSessions: new Set()
                            };
                        }
                        stats[sortKey].present++;
                        stats[sortKey].uniqueSessions.add(data.sessionId);
                    }
                });

                const formattedData = Object.keys(stats).sort().map(key => {
                    const item = stats[key];
                    const sessionCount = item.uniqueSessions.size || 1;
                    const avgPresent = Math.round(item.present / sessionCount);
                    const avgAbsent = Math.max(0, totalStudents - avgPresent);
                    const percent = Math.round((avgPresent / totalStudents) * 100);

                    return {
                        name: item.name,
                        present: avgPresent,
                        absent: avgAbsent,
                        percentLabel: percent > 15 ? `${percent}%` : "",
                        classStrength: totalStudents
                    };
                });
                setChartData(formattedData);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetchAnalytics();
    }, [teacherInfo, selectedYear, graphType, timeRange]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <p style={{ margin: 0, fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>{label}</p>
                    <p style={{ margin: 0, color: '#2563eb', fontSize: '13px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', marginRight: '6px' }}></span>
                        Avg Present: <strong>{payload[0].value}</strong>
                    </p>
                    <p style={{ margin: '4px 0 0', color: '#ef4444', fontSize: '13px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginRight: '6px' }}></span>
                        Avg Absent: <strong>{payload[1].value}</strong>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="content-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                <div>
                    {/* ✅ UPDATED TITLE CLASS */}
                    <h2 className="gradient-text">Analytics</h2>
                    <p className="content-subtitle">
                        Average Attendance for <strong>{graphType === 'theory' ? 'Theory' : 'Practical'}</strong>
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ background: '#f1f5f9', padding: '4px', borderRadius: '8px', display: 'flex' }}>
                        <button onClick={() => setTimeRange('week')} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', background: timeRange === 'week' ? 'white' : 'transparent', color: timeRange === 'week' ? '#0f172a' : '#64748b', boxShadow: timeRange === 'week' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none' }}>Week</button>
                        <button onClick={() => setTimeRange('month')} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', background: timeRange === 'month' ? 'white' : 'transparent', color: timeRange === 'month' ? '#0f172a' : '#64748b', boxShadow: timeRange === 'month' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none' }}>Month</button>
                    </div>

                    <div style={{ background: '#e2e8f0', padding: '4px', borderRadius: '8px', display: 'flex' }}>
                        <button onClick={() => setGraphType('theory')} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', background: graphType === 'theory' ? 'white' : 'transparent', color: graphType === 'theory' ? '#2563eb' : '#64748b', boxShadow: graphType === 'theory' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none' }}>Theory</button>
                        <button onClick={() => setGraphType('practical')} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', background: graphType === 'practical' ? 'white' : 'transparent', color: graphType === 'practical' ? '#7c3aed' : '#64748b', boxShadow: graphType === 'practical' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none' }}>Lab</button>
                    </div>
                </div>
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
                {loading ? <p style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Loading data...</p> : (
                    <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '10px' }}>
                        <div style={{ width: timeRange === 'month' ? '1200px' : '100%', height: 320, minWidth: '100%' }}>
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="colorPresentTheory" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9} />
                                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.9} />
                                            </linearGradient>
                                            <linearGradient id="colorPresentPractical" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9} />
                                                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.9} />
                                            </linearGradient>
                                            <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#fee2e2" stopOpacity={0.9} />
                                                <stop offset="95%" stopColor="#fca5a5" stopOpacity={0.9} />
                                            </linearGradient>
                                        </defs>

                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />

                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} />
                                        <Legend wrapperStyle={{ paddingTop: '15px' }} />

                                        <Bar dataKey="present" name="Avg Present" fill={graphType === 'theory' ? "url(#colorPresentTheory)" : "url(#colorPresentPractical)"} radius={[0, 0, 4, 4]} barSize={timeRange === 'month' ? 32 : 55} stackId="a">
                                            <LabelList dataKey="percentLabel" position="center" fill="white" style={{ fontWeight: 'bold', fontSize: '12px', textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }} />
                                        </Bar>
                                        <Bar dataKey="absent" name="Avg Absent" fill="url(#colorAbsent)" radius={[6, 6, 0, 0]} barSize={timeRange === 'month' ? 32 : 55} stackId="a" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                    <i className="fas fa-chart-bar" style={{ fontSize: '24px', marginBottom: '10px', opacity: 0.5 }}></i>
                                    <p>No {graphType} sessions recorded in this period.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ✅ CSS For Gradient Text */}
            <style>{`
                .gradient-text {
                    background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    font-size: 24px;
                    margin: 0;
                    font-weight: 700;
                }
            `}</style>
        </div>
    );
};

// ------------------------------------
//  COMPONENT: DASHBOARD HOME (With Violet Gradient Greeting)
// ------------------------------------
const DashboardHome = ({ teacherInfo, activeSession, attendanceList, onSessionToggle, viewMode, setViewMode, selectedDate, setSelectedDate, historySessions, selectedYear, sessionLoading, sessionType, setSessionType, selectedBatch, setSelectedBatch, rollStart, setRollStart, rollEnd, setRollEnd }) => {
    const [qrCodeValue, setQrCodeValue] = useState('');
    const [timer, setTimer] = useState(10);
    const [manualRoll, setManualRoll] = useState("");
    const [absentList, setAbsentList] = useState("");
    const [classStrength, setClassStrength] = useState(0);

    // Fetch Class Strength for Percentage
    useEffect(() => {
        const fetchStrength = async () => {
            if (teacherInfo?.instituteId && selectedYear) {
                const q = query(
                    collection(db, 'users'),
                    where('instituteId', '==', teacherInfo.instituteId),
                    where('role', '==', 'student'),
                    where('year', '==', selectedYear),
                    where('department', '==', teacherInfo.department)
                );
                const snap = await getDocs(q);
                setClassStrength(snap.size || 1);
            }
        };
        fetchStrength();
    }, [teacherInfo, selectedYear]);

    const getCurrentSubject = () => {
        if (!teacherInfo) return "Class";
        if (teacherInfo.assignedClasses) {
            const cls = teacherInfo.assignedClasses.find(c => c.year === selectedYear);
            if (cls) return cls.subject;
        }
        return teacherInfo.subject;
    };
    const currentSubject = getCurrentSubject();

    const sortedAttendanceList = [...attendanceList].sort((a, b) => {
        return parseInt(a.rollNo) - parseInt(b.rollNo);
    });

    // --- ACTIONS ---
    const handleInverseAttendance = async () => {
        const absentees = absentList.split(',').map(s => s.trim()).filter(s => s !== "");
        if (absentees.length === 0 && !window.confirm("Mark EVERYONE as present?")) return;

        const toastId = toast.loading("Processing...");
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
                    type: activeSession.type || 'theory',
                    batch: activeSession.batch || 'All'
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

    const handleManualMarkPresent = async () => {
        if (!manualRoll) return toast.error("Enter a Roll Number");
        const toastId = toast.loading(`Marking Roll ${manualRoll}...`);

        try {
            const response = await fetch(`${BACKEND_URL}/markManualAttendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rollNo: manualRoll.toString().trim(),
                    department: teacherInfo.department,
                    year: selectedYear,
                    instituteId: teacherInfo.instituteId,
                    sessionId: activeSession.sessionId,
                    subject: currentSubject,
                    teacherId: auth.currentUser.uid
                })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(data.message, { id: toastId });
                setManualRoll("");
            } else {
                toast.error("Failed: " + data.error, { id: toastId });
            }

        } catch (err) {
            toast.error("Error: " + err.message, { id: toastId });
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

    const presentCount = isSessionRelevant ? sortedAttendanceList.length : 0;
    const percentage = classStrength > 0 ? Math.round((presentCount / classStrength) * 100) : 0;

    return (
        <div className="content-section">
            {/* --- HEADER SECTION --- */}
            <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    {/* ✅ UPDATED: Applied gradient-text class here */}
                    <h2 className="gradient-text">{getGreeting()}, {teacherInfo.firstName}!</h2>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                        <span style={{ background: '#2563eb', color: 'white', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 5px rgba(37,99,235,0.2)' }}>
                            <i className="fas fa-graduation-cap"></i> {selectedYear} Year • {currentSubject}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '5px', background: '#fff', padding: '5px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                    <button onClick={() => setViewMode('live')} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', background: viewMode === 'live' ? '#eff6ff' : 'transparent', color: viewMode === 'live' ? '#2563eb' : '#64748b' }}>Live Class</button>
                    <button onClick={() => setViewMode('history')} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', background: viewMode === 'history' ? '#eff6ff' : 'transparent', color: viewMode === 'history' ? '#2563eb' : '#64748b' }}>Reports</button>
                </div>
            </div>

            {viewMode === 'live' && (
                <div className="cards-grid">
                    {/* 1. START/STOP SESSION CARD */}
                    <div className="card" style={{ background: isSessionRelevant ? 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)' : 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)', border: isSessionRelevant ? '1px solid #a7f3d0' : '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <div className="icon-box-modern" style={{ background: 'white', color: isSessionRelevant ? '#15803d' : '#1e40af', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                    <i className={`fas ${isSessionRelevant ? 'fa-broadcast-tower' : 'fa-play'}`}></i>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, color: isSessionRelevant ? '#14532d' : '#1e3a8a', fontSize: '16px', fontWeight: '700' }}>{isSessionRelevant ? 'Session Live' : 'Start Class'}</h3>
                                    {isSessionRelevant && <span className="status-badge-pill" style={{ background: 'white', color: '#15803d', fontSize: '10px', padding: '2px 8px', marginTop: '4px', borderRadius: '10px', fontWeight: 'bold' }}>ACTIVE</span>}
                                </div>
                            </div>
                            {!isSessionRelevant && (
                                <div style={{ marginBottom: '15px' }}>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                        <button onClick={() => setSessionType('theory')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: sessionType === 'theory' ? '#2563eb' : 'white', color: sessionType === 'theory' ? 'white' : '#64748b', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: sessionType === 'theory' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}>Theory</button>
                                        <button onClick={() => setSessionType('practical')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: sessionType === 'practical' ? '#2563eb' : 'white', color: sessionType === 'practical' ? 'white' : '#64748b', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: sessionType === 'practical' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}>Practical</button>
                                    </div>
                                    {sessionType === 'practical' && (
                                        <div style={{ marginTop: '10px', background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <div className="input-group" style={{ marginBottom: '8px' }}>
                                                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Batch</label>
                                                <CustomDropdown
                                                    value={selectedBatch}
                                                    onChange={(e) => setSelectedBatch(e.target.value)}
                                                    options={['A', 'B', 'C', 'D', 'E'].map(b => ({ value: b, label: `Batch ${b}` }))}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <input type="number" value={rollStart} onChange={(e) => setRollStart(e.target.value)} placeholder="Start" style={{ flex: 1, minWidth: 0, padding: '6px', borderRadius: '6px', border: '1px solid #bfdbfe' }} />
                                                <input type="number" value={rollEnd} onChange={(e) => setRollEnd(e.target.value)} placeholder="End" style={{ flex: 1, minWidth: 0, padding: '6px', borderRadius: '6px', border: '1px solid #bfdbfe' }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <p style={{ color: isSessionRelevant ? '#166534' : '#1e40af', marginBottom: '20px', fontSize: '12px', opacity: 0.8 }}>
                                {isSessionRelevant ? `Code updates in ${timer}s` : `Configure session for ${selectedYear} Year.`}
                            </p>
                        </div>
                        <button onClick={onSessionToggle} className={isSessionRelevant ? "btn-modern-danger" : "btn-modern-primary"} disabled={!teacherInfo || (activeSession && !isSessionRelevant) || sessionLoading} style={{ marginTop: 'auto', boxShadow: 'none' }}>
                            {sessionLoading ? <i className="fas fa-spinner fa-spin"></i> : (activeSession && !isSessionRelevant ? 'Other Class Active' : isSessionRelevant ? 'End Session' : 'Start Session')}
                        </button>
                    </div>

                    {/* 2. TOTAL PRESENT CARD */}
                    <div className="card" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '80px', height: '80px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
                        <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', width: '100px', height: '100px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}></div>

                        <h3 style={{ margin: 0, fontSize: '13px', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px' }}>Total Present</h3>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginTop: '10px' }}>
                            <span style={{ fontSize: '52px', fontWeight: '800', lineHeight: 1 }}>
                                {isSessionRelevant ? sortedAttendanceList.length : 0}
                            </span>
                        </div>
                        <div style={{ marginTop: '10px', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '500' }}>
                            {isSessionRelevant ? `${percentage}% Attendance` : 'No Active Session'}
                        </div>
                    </div>

                    {/* 3. QR CODE CARD */}
                    {isSessionRelevant && (
                        <div className="card card-full-width" style={{ textAlign: 'center', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
                            <div className="qr-code-wrapper" style={{ background: 'white', padding: '15px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(37,99,235,0.1)', display: 'inline-block' }}>
                                <QRCodeSVG value={qrCodeValue} size={200} />
                            </div>
                            <p style={{ marginTop: '15px', fontSize: '13px', color: '#64748b' }}>Ask students to scan using AcadeX App</p>
                        </div>
                    )}

                    {/* 4. ACTIONS */}
                    {isSessionRelevant && (
                        <div className="card-full-width" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {/* Option A: Quick Absentee */}
                            <div className="card" style={{ borderLeft: '4px solid #f59e0b', padding: '15px', background: '#fffbeb' }}>
                                <h3 style={{ fontSize: '14px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: '700' }}>
                                    <i className="fas fa-user-minus" style={{ color: '#f59e0b' }}></i> Quick Absentee
                                </h3>
                                <input type="text" placeholder="Roll Nos (e.g. 1, 5, 12)" value={absentList} onChange={(e) => setAbsentList(e.target.value)} className="modern-input" style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid #fcd34d', borderRadius: '6px', background: 'white' }} />
                                <button className="btn-modern-primary" onClick={handleInverseAttendance} style={{ background: '#f7da72', color: '#000000', border: '1px solid #edd587', marginTop: '10px', width: '100%', fontSize: '12px', padding: '8px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '6px' }}>
                                    Mark Rest Present
                                </button>
                            </div>

                            {/* Option B: Manual Mark Present */}
                            <div className="card" style={{ borderLeft: '4px solid #2563eb', padding: '15px', background: '#eff6ff' }}>
                                <h3 style={{ fontSize: '14px', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: '700' }}>
                                    <i className="fas fa-user-check" style={{ color: '#2563eb' }}></i> Manual Present
                                </h3>
                                <input type="number" placeholder="Single Roll No." value={manualRoll} onChange={(e) => setManualRoll(e.target.value)} className="modern-input" style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid #bfdbfe', borderRadius: '6px', background: 'white' }} />
                                <button className="btn-modern-primary" onClick={handleManualMarkPresent} style={{ background: '#5091e6', color: '#2563eb', border: '1px solid #bfdbfe', marginTop: '10px', width: '100%', fontSize: '12px', padding: '8px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '6px' }}>
                                    Add Student
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 5. LIVE LIST */}
                    {isSessionRelevant && (
                        <div className="card card-full-width" style={{ marginTop: '0px', padding: '0', overflow: 'hidden' }}>
                            <div style={{ padding: '15px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>Live Student List</h3>
                                <span className="status-badge-pill" style={{ background: '#dcfce7', color: '#15803d' }}>Live</span>
                            </div>
                            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, maxHeight: '400px', overflowY: 'auto' }}>
                                <table className="attendance-table">
                                    <thead style={{ background: 'white', position: 'sticky', top: 0 }}><tr><th>Roll No.</th><th>Name</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {sortedAttendanceList.map(s => (
                                            <tr key={s.id}>
                                                <td style={{ fontWeight: '600', color: '#334155' }}>{s.rollNo}</td>
                                                <td style={{ fontWeight: '500' }}>{s.firstName} {s.lastName}</td>
                                                <td>
                                                    {s.markedBy === 'teacher_manual'
                                                        ? <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0284c7', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Manual</span>
                                                        : s.markedBy === 'teacher_inverse'
                                                            ? <span style={{ fontSize: '10px', background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Auto</span>
                                                            : <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>App</span>
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                        {sortedAttendanceList.length === 0 && (
                                            <tr>
                                                <td colSpan="3" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                                    <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '10px', color: '#cbd5e1' }}></i>
                                                    <p style={{ margin: 0, fontSize: '13px' }}>Waiting for scans...</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {viewMode === 'history' && (
                <div className="cards-grid">
                    <div className="card card-full-width" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: '#f8fafc' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', display: 'block', textTransform: 'uppercase', marginBottom: '5px' }}>Select Date</label>
                            <div style={{ position: 'relative', width: '100%' }}>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 12px 12px 40px', // Space for icon
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        background: '#ffffff',
                                        color: '#334155',
                                        outline: 'none',
                                        appearance: 'none' // Removes default browser styling
                                    }}
                                />
                                <i className="fas fa-calendar-alt" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}></i>
                            </div>
                        </div>
                        <div style={{ flex: 2 }}>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Viewing Report for:</p>
                            <h3 style={{ margin: '4px 0 0 0', fontSize: '22px', color: '#1e293b' }}>{formattedDate} ({selectedYear})</h3>
                        </div>
                    </div>

                    {historySessions.length === 0 ? (
                        <div className="card card-full-width" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                            <i className="fas fa-calendar-times" style={{ fontSize: '30px', marginBottom: '10px' }}></i>
                            <p>No sessions found for this date.</p>
                        </div>
                    ) : (
                        historySessions.map((session, index) => (
                            <div key={session.sessionId} className="card card-full-width" style={{ marginTop: '20px', borderLeft: session.type === 'practical' ? '5px solid #8b5cf6' : '5px solid #3b82f6' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '15px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                            <span style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                                                {session.startTime}
                                            </span>
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

            {/* ✅ ADDED: Theme CSS for the Greeting */}
            <style>{`
                .gradient-text {
                    background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    font-size: 24px;
                    margin: 0;
                    font-weight: 700;
                }
            `}</style>
        </div>
    );
};

// --- 📱 MOBILE FOOTER COMPONENT ---
const MobileFooter = ({ activePage, setActivePage, unreadNoticeCount }) => {
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

            {/* ✅ CHANGED: Renamed from 'Notice' to 'Post' to avoid confusion */}
            <button className={`nav-item ${activePage === 'announcements' ? 'active' : ''}`} onClick={() => setActivePage('announcements')}>
                <i className="fas fa-bullhorn"></i>
                <span>Post</span>
            </button>

            <button className={`nav-item ${activePage === 'addTasks' ? 'active' : ''}`} onClick={() => setActivePage('addTasks')}>
                <i className="fas fa-tasks"></i>
                <span>Tasks</span>
            </button>

            {/* Admin Notices (Inbox) */}
            <button className={`nav-item ${activePage === 'adminNotices' ? 'active' : ''}`} onClick={() => setActivePage('adminNotices')} style={{ position: 'relative' }}>
                <i className="fas fa-bell"></i>
                <span>Notices</span>
                {unreadNoticeCount > 0 && (
                    <span style={{ position: 'absolute', top: '5px', right: '15px', width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }}></span>
                )}
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
    const [announcements, setAnnouncements] = useState([]);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [adminNotices, setAdminNotices] = useState([]);
    const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);

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

    // ✅ REGISTER TEACHER FOR PUSH NOTIFICATIONS (Fixed Dependency)
    useEffect(() => {
        // 1. Wait until we know who the user is
        if (!teacherInfo?.firstName || !auth.currentUser) return;

        const registerPushNotifications = async () => {
            if (Capacitor.isNativePlatform()) {

                // Request Permission
                let permStatus = await PushNotifications.checkPermissions();
                if (permStatus.receive === 'prompt') {
                    permStatus = await PushNotifications.requestPermissions();
                }

                if (permStatus.receive !== 'granted') {
                    console.log('User denied permissions!');
                    return;
                }

                await PushNotifications.register();

                // Clear listeners first to prevent memory leaks and double-triggers
                await PushNotifications.removeAllListeners();

                PushNotifications.addListener('registration', async (token) => {
                    // console.log("Push Token:", token.value);
                    const userRef = doc(db, 'users', auth.currentUser.uid);
                    await setDoc(userRef, { fcmToken: token.value }, { merge: true }); // Use setDoc + merge
                });

                PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    toast(notification.title + ": " + notification.body, {
                        icon: '🔔',
                        duration: 5000,
                        style: { background: '#3b82f6', color: '#fff' }
                    });
                });

                PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                    setActivePage('adminNotices');
                });
            }
        };

        registerPushNotifications();

        return () => {
            if (Capacitor.isNativePlatform()) {
                PushNotifications.removeAllListeners();
            }
        };
    }, [teacherInfo]); // ✅ FIX: Only runs once teacher data is ready

    // ✅ FETCH NOTICES FOR TEACHERS
    useEffect(() => {
        if (!teacherInfo?.instituteId) return;

        const q = query(
            collection(db, 'announcements'),
            where('instituteId', '==', teacherInfo.instituteId),
            where('department', '==', teacherInfo.department),
            where('targetYear', 'in', ['All', 'Teachers'])
        );

        const unsubscribe = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setAdminNotices(data);

            // --- 🟢 NEW LOGIC: Calculate Badge Count ---
            const lastViewed = localStorage.getItem('lastViewedNoticesTime');
            const lastViewedTime = lastViewed ? new Date(lastViewed).getTime() : 0;

            // Count how many notices are NEWER than the last time we checked
            const unread = data.filter(n => (n.createdAt?.toMillis() || 0) > lastViewedTime).length;
            setUnreadNoticeCount(unread);
        });

        return () => unsubscribe();
    }, [teacherInfo]);

    // ✅ NEW: Clear Count when entering the tab
    useEffect(() => {
        if (activePage === 'adminNotices') {
            // Save current time as "Last Viewed"
            localStorage.setItem('lastViewedNoticesTime', new Date().toISOString());
            setUnreadNoticeCount(0);
        }
    }, [activePage]);

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
            // --- END SESSION LOGIC ---
            const toastId = toast.loading("Ending Session...");
            try {
                await fetch(`${BACKEND_URL}/endSession`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: activeSession.sessionId })
                });
                toast.success("Session Ended", { id: toastId });
            } catch (e) {
                toast.error("Error: " + e.message, { id: toastId });
            }
        } else {
            // --- START SESSION LOGIC ---
            if (!teacherInfo?.instituteId) return toast.error("Institute ID missing.");

            let currentSubject = teacherInfo.subject;
            if (teacherInfo.assignedClasses) {
                const cls = teacherInfo.assignedClasses.find(c => c.year === selectedYear);
                if (cls) currentSubject = cls.subject;
            }

            setSessionLoading(true);
            const startToast = toast.loading("Acquiring Location..."); // Step 1

            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(async (pos) => {
                    // ✅ SUCCESS: Location Found
                    toast.loading("Starting Session...", { id: startToast }); // Step 2

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
                            toast.success(`Session Live: ${currentSubject}`, { id: startToast });
                        } else {
                            toast.error("Failed: " + data.error, { id: startToast });
                        }
                    } catch (err) {
                        toast.error("Network Error: " + err.message, { id: startToast });
                    } finally {
                        setSessionLoading(false);
                    }

                }, (err) => {
                    // ❌ ERROR: Handle specific location errors
                    console.error("Location Error:", err);
                    let errMsg = "Location check failed.";

                    switch (err.code) {
                        case 1: errMsg = "Location permission denied."; break;
                        case 2: errMsg = "GPS signal lost or unavailable."; break;
                        case 3: errMsg = "Location request timed out. Try again."; break;
                        default: errMsg = "Location error: " + err.message;
                    }

                    toast.error(errMsg, { id: startToast });
                    setSessionLoading(false);

                }, {
                    enableHighAccuracy: true,
                    timeout: 20000, // ✅ INCREASED TIMEOUT to 20 seconds (Fixes the issue)
                    maximumAge: 0
                });
            } else {
                toast.error("Geolocation not supported on this device.", { id: startToast });
                setSessionLoading(false);
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
            case 'addTasks': return <AddTasks teacherInfo={teacherInfo} />;
            case 'adminNotices': return (
                <div className="content-section">
                    {/* ✅ UPDATED TITLE CLASS */}
                    <h2 className="gradient-text">Staff Notices</h2>
                    <p className="content-subtitle">Important updates from the HOD and Administration.</p>

                    <div className="cards-grid" style={{ gridTemplateColumns: '1fr' }}>
                        {adminNotices.length > 0 ? (
                            adminNotices.map(notice => (
                                <div key={notice.id} className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                        <div>
                                            <span className="status-badge-pill" style={{ background: '#eff6ff', color: '#2563eb', marginBottom: '8px', display: 'inline-block' }}>
                                                {notice.targetYear === 'Teachers' ? 'Staff Only' : 'General Notice'}
                                            </span>
                                            <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>{notice.title}</h3>
                                        </div>

                                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                            {notice.createdAt?.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            <br />
                                            {notice.createdAt?.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </span>
                                    </div>

                                    <p style={{ color: '#475569', lineHeight: '1.6', fontSize: '14px' }}>{notice.message}</p>
                                    {notice.attachmentUrl && (
                                        <a href={notice.attachmentUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', color: '#2563eb', fontSize: '13px', fontWeight: '600', textDecoration: 'none', background: '#f0f9ff', padding: '6px 12px', borderRadius: '6px' }}>
                                            <i className="fas fa-paperclip"></i> View Attachment
                                        </a>
                                    )}

                                    <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <i className="fas fa-user-shield"></i>
                                        <span>Posted by: <strong>{notice.teacherName || 'HOD / Admin'}</strong></span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                <i className="fas fa-folder-open" style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.5 }}></i>
                                <p>No notices for staff at the moment.</p>
                            </div>
                        )}
                    </div>

                    {/* ✅ CSS For Gradient Text (Redundant but safe) */}
                    <style>{`
            .gradient-text {
                background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                font-size: 24px;
                margin: 0;
                font-weight: 700;
            }
        `}</style>
                </div>
            );
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
                    {/* Add this item */}
                    <li className={activePage === 'adminNotices' ? 'active' : ''} onClick={() => { setActivePage('adminNotices'); setIsMobileNavOpen(false); }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '15px' }}>
                            <i className="fas fa-bell" style={{ width: '24px', textAlign: 'center' }}></i>
                            <span>Staff Notices</span>

                            {/* ✅ UPDATED: Only show badge if count > 0 */}
                            {unreadNoticeCount > 0 && (
                                <span className="nav-badge" style={{ background: '#ef4444', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', marginLeft: 'auto' }}>
                                    {unreadNoticeCount}
                                </span>
                            )}
                        </div>
                    </li>
                    <li onClick={() => setIsMobileNavOpen(false)} style={{ marginTop: 'auto', marginBottom: '10px' }}>
                        <CSVLink data={csvData} headers={csvHeaders} filename={csvFilename} className="csv-link"><i className="fas fa-file-download"></i><span>Download Sheet</span></CSVLink>
                    </li>
                </ul>
                <div className="sidebar-footer"><button onClick={handleLogout} className="logout-btn"><i className="fas fa-sign-out-alt"></i><span>Logout</span></button></div>
            </aside>
            <main className="main-content">
                <header className="mobile-header"><button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}><i className="fas fa-bars"></i></button><div className="mobile-brand"><img src={logo} alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">AcadeX</span></div><div style={{ width: '40px' }}></div></header>
                {renderContent()}
                <MobileFooter
                    activePage={activePage}
                    setActivePage={setActivePage}
                    unreadNoticeCount={unreadNoticeCount}
                />
            </main>
        </div>
    );
}

