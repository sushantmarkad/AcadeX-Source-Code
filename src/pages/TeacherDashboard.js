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
import { Geolocation } from '@capacitor/geolocation';
import NativeFriendlyDateInput from '../components/NativeFriendlyDateInput';
import { useFileDownloader } from '../hooks/useFileDownloader';
import ReactDOM from 'react-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


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
    const [selectedDiv, setSelectedDiv] = useState('');
    const { downloadFile } = useFileDownloader();

    const assignedYears = teacherInfo?.assignedClasses
        ? [...new Set(teacherInfo.assignedClasses.flatMap(c => {
            if (c.year === 'FE' && c.divisions) {
                // Split FE into divisions
                return c.divisions.split(',').map(div => ({
                    label: `FE - Div ${div.trim()}`,
                    value: `FE|${div.trim()}`
                }));
            }
            return [{ label: `${c.year} Year (All)`, value: `${c.year}|All` }];
        }))]
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
            // ✅ Parse "Year|Div" into separate variables
            // Fallback: If value has no pipe (e.g. legacy data), treat as "Year|All"
            const rawTarget = form.targetYear.includes('|') ? form.targetYear : `${form.targetYear}|All`;
            const [targetYear, targetDivision] = rawTarget.split('|');

            let attachmentUrl = "";
            if (file) {
                const fileRef = ref(storage, `notices/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
                await uploadBytes(fileRef, file);
                attachmentUrl = await getDownloadURL(fileRef);
            }

            // 1. Save to Firestore (Now saving 'division')
            await addDoc(collection(db, 'announcements'), {
                title: form.title,
                message: form.message,
                targetYear: targetYear,        // ✅ Save Clean Year
                division: targetDivision,      // ✅ Save Clean Division
                attachmentUrl,
                teacherId: auth.currentUser.uid,
                teacherName: `${teacherInfo.firstName} ${teacherInfo.lastName}`,
                department: teacherInfo.department,
                instituteId: teacherInfo.instituteId,
                role: 'teacher',
                createdAt: serverTimestamp()
            });

            // 2. Trigger Notification (Send Division too)
            fetch(`${BACKEND_URL}/sendAnnouncementNotification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `📢 New Notice: ${form.title}`,
                    message: form.message,
                    targetYear: targetYear,    // ✅ Use cleaned year
                    division: targetDivision,  // ✅ Use cleaned division
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
            toast.error("Failed to post: " + err.message, { id: toastId });
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
                                    /* ✅ SAFE FIX: Checks if 'e' is an event object or direct value */
                                    onChange={(e) => {
                                        const val = (e && e.target) ? e.target.value : e;
                                        setForm({ ...form, targetYear: val });
                                    }}
                                    placeholder="Select Class"
                                    options={[
                                        { value: 'All|All', label: 'All My Classes' },
                                        ...assignedYears // This now contains objects { value: 'FE|A', label: 'FE - Div A' }
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
                                    <button
                                        onClick={() => downloadFile(ann.attachmentUrl, `Announcement_${ann.id}.pdf`)}
                                        className="view-doc-btn"
                                        style={{ marginTop: 'auto', width: 'fit-content', border: 'none', cursor: 'pointer' }}
                                    >
                                        <i className="fas fa-file-download"></i> Download File
                                    </button>
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

               .create-card { 
    background: white; 
    border-radius: 20px; 
    box-shadow: 0 10px 30px rgba(0,0,0,0.08); 
    overflow: visible !important; /* Key fix */
    border: 1px solid #f1f5f9; 
}

/* Header - Explicitly Rounded Top Corners */
.create-card-header { 
    background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%); 
    padding: 15px 25px; 
    color: white; 
    border-top-left-radius: 20px;  /* ✅ FIX: Curves top left */
    border-top-right-radius: 20px; /* ✅ FIX: Curves top right */
}
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
                    .card, .task-card-modern, .create-card {
    overflow: visible !important;
}
            `}</style>
        </div>
    );
};
// ------------------------------------
//  COMPONENT: TEACHER ANALYTICS (Updated for Division Support)
// ------------------------------------
const TeacherAnalytics = ({ teacherInfo, selectedYear, selectedDiv }) => {
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
                // 1. Get Class Strength (Filtered by Division)
                const qStudents = query(
                    collection(db, 'users'),
                    where('instituteId', '==', teacherInfo.instituteId),
                    where('role', '==', 'student'),
                    where('year', '==', selectedYear),
                    where('department', '==', teacherInfo.department)
                );
                const studentsSnap = await getDocs(qStudents);

                // ✅ FIX: Filter Students by Division
                let validStudents = studentsSnap.docs;
                if (selectedYear === 'FE' && selectedDiv && selectedDiv !== 'All') {
                    validStudents = validStudents.filter(doc => doc.data().division === selectedDiv);
                }
                const totalStudents = validStudents.length || 1;
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

                // 3. Get Session Metadata (Type & Division)
                const sessionMeta = {};
                await Promise.all(Array.from(sessionIds).map(async (sid) => {
                    const sDoc = await getDoc(doc(db, 'live_sessions', sid));
                    if (sDoc.exists()) {
                        sessionMeta[sid] = {
                            type: sDoc.data().type || 'theory',
                            division: sDoc.data().division // ✅ Capture Division
                        };
                    }
                }));

                const stats = {};
                snap.docs.forEach(doc => {
                    const data = doc.data();
                    const meta = sessionMeta[data.sessionId];

                    // ✅ SKIP if session metadata missing
                    if (!meta) return;

                    // ✅ FIX: Filter Data by Division
                    if (selectedYear === 'FE' && selectedDiv && selectedDiv !== 'All') {
                        // If session has a specific division and it doesn't match selected, skip
                        if (meta.division && meta.division !== selectedDiv) return;
                    }

                    if (meta.type === graphType) {
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
    }, [teacherInfo, selectedYear, graphType, timeRange, selectedDiv]); // ✅ Add selectedDiv dependency

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
                    <h2 className="gradient-text">Analytics</h2>
                    <p className="content-subtitle">
                        {/* ✅ Show Division in Subtitle */}
                        {selectedYear} {selectedYear === 'FE' && selectedDiv ? `(Div ${selectedDiv})` : ''} • Average Attendance
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

// --- HELPER: Prepare Matrix Data for Reports ---
const prepareReportData = (sessions, allStudents) => {
    // 1. Sort Sessions Chronologically
    const sortedSessions = [...sessions].sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate));

    // 2. Define Columns (Date headers with Batch Info)
    const dateColumns = sortedSessions.map((s) => ({
        // ✅ NEW: If practical, add Batch Name to the header (e.g., "10:30 (Pr-A1)")
        header: `${s.startTime.split(',')[0].slice(0, 5)}\n${s.type === 'practical' ? `(Pr-${s.batch})` : '(Th)'}`,
        dataKey: s.sessionId
    }));

    // 3. Fallback: If Master List is Empty, Extract from Sessions
    let targetStudents = allStudents;
    if (!targetStudents || targetStudents.length === 0) {
        const studentMap = new Map();
        sessions.forEach(session => {
            session.students.forEach(s => {
                if (!studentMap.has(s.rollNo)) {
                    studentMap.set(s.rollNo, {
                        rollNo: s.rollNo,
                        firstName: s.name.split(' ')[0],
                        lastName: s.name.split(' ').slice(1).join(' ') || ''
                    });
                }
            });
        });
        targetStudents = Array.from(studentMap.values());
    }

    // 4. Build Rows
    const tableRows = targetStudents.map(student => {
        const row = {
            rollNo: student.rollNo,
            name: `${student.firstName} ${student.lastName}`,
            totalHeld: 0,
            totalAttended: 0
        };

        sortedSessions.forEach(session => {
            let isApplicable = true;
            // Check applicability (e.g. Practical Batch)
            if (session.type === 'practical' && session.rollRange) {
                const r = parseInt(student.rollNo);
                if (r < session.rollRange.start || r > session.rollRange.end) isApplicable = false;
            }

            if (isApplicable) {
                row.totalHeld++;
                // Loose equality for Roll No
                const studentRecord = session.students.find(s => s.rollNo == student.rollNo);
                const status = studentRecord && studentRecord.status === 'Present' ? 'P' : 'A';
                
                if (status === 'P') row.totalAttended++;
                row[session.sessionId] = status; 
            } else {
                row[session.sessionId] = '-'; 
            }
        });

        // Calculate Percentage
        row.percentage = row.totalHeld > 0 
            ? ((row.totalAttended / row.totalHeld) * 100).toFixed(0) + '%' 
            : '0%';

        return row;
    });

    // Sort rows by Roll No
    tableRows.sort((a, b) => parseInt(a.rollNo) - parseInt(b.rollNo));

    return { columns: dateColumns, rows: tableRows };
};

// --- HELPER: Generate PDF Report (Updated with Batch Context) ---
const generatePDFReport = (teacherInfo, selectedYear, selectedDiv, subject, startDate, endDate, historySessions, allStudents) => {
    const doc = new jsPDF('landscape');
    const { columns, rows } = prepareReportData(historySessions, allStudents);

    // --- 1. DYNAMIC DATA FETCHING ---
    const currentClass = teacherInfo.assignedClasses?.find(c => c.year === selectedYear);
    const currentSemester = currentClass ? `Sem ${currentClass.semester}` : 'Semester N/A';
    const academicYear = teacherInfo.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

    // ✅ DETECT BATCH CONTEXT
    // If the filtered sessions are practical, try to find a common batch or list them
    const uniqueBatches = [...new Set(historySessions.map(s => s.batch).filter(b => b && b !== 'All'))];
    const batchInfo = uniqueBatches.length === 1 
        ? `Batch: ${uniqueBatches[0]}` // "Batch: A1"
        : uniqueBatches.length > 1 
            ? `Batches: ${uniqueBatches.join(', ')}` // "Batches: A1, A2"
            : ''; // Empty if theory or no specific batch

    // --- 2. HEADER SECTION ---
    const pageWidth = doc.internal.pageSize.width;
    const centerX = pageWidth / 2;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(teacherInfo.instituteName || "College Name", centerX, 15, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Academic Attendance Report (${academicYear})`, centerX, 22, { align: 'center' });

    // Details Grid
    doc.setFontSize(10);
    const leftMargin = 14;
    const rightMargin = pageWidth - 14;

    doc.text(`Department: ${teacherInfo.department}`, leftMargin, 32);
    
    // ✅ UPDATED LINE: Includes Batch Info if available
    let classLine = `Class: ${selectedYear} ${selectedYear === 'FE' ? `(Div ${selectedDiv})` : ''}   |   ${currentSemester}`;
    if (batchInfo) classLine += `   |   ${batchInfo}`; // Append Batch Info
    
    doc.text(classLine, leftMargin, 37);
    doc.text(`Subject: ${subject}`, leftMargin, 42);
    doc.text(`Teacher: ${teacherInfo.firstName} ${teacherInfo.lastName}`, leftMargin, 47);

    doc.text(`Report Duration: ${startDate} to ${endDate}`, rightMargin, 32, { align: 'right' });
    doc.text(`Generated On: ${new Date().toLocaleDateString('en-GB')}`, rightMargin, 37, { align: 'right' });

    // Legend
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Legend: P = Present, A = Absent, - = Not Applicable", leftMargin, 55);
    doc.setTextColor(0);

    // --- 3. TABLE GENERATION (Existing Logic) ---
    const tableColumns = [
        { header: 'Roll', dataKey: 'rollNo' },
        { header: 'Student Name', dataKey: 'name' },
        ...columns,
        { header: 'Total', dataKey: 'totalHeld' },
        { header: 'Attd', dataKey: 'totalAttended' },
        { header: '%', dataKey: 'percentage' }
    ];

    autoTable(doc, {
        startY: 60,
        head: [tableColumns.map(c => c.header)],
        body: rows.map(r => tableColumns.map(c => r[c.dataKey])),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 12, fontStyle: 'bold' },
            1: { cellWidth: 40, halign: 'left' },
        },
        didParseCell: function(data) {
            if (data.section === 'body') {
                if (data.cell.raw === 'A') {
                    data.cell.styles.textColor = [220, 38, 38];
                    data.cell.styles.fontStyle = 'bold';
                }
                if (data.cell.raw === 'P') {
                    data.cell.styles.textColor = [22, 163, 74];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    doc.save(`Report_${subject}_${startDate}_${endDate}.pdf`);
};

// ------------------------------------
//  COMPONENT: DASHBOARD HOME
// ------------------------------------
const DashboardHome = ({
    teacherInfo, activeSession, attendanceList, onSessionToggle, viewMode, setViewMode, startDate, setStartDate, endDate, setEndDate,
    selectedDate, setSelectedDate, historySessions, selectedYear, sessionLoading,
    sessionType, setSessionType, selectedBatch, setSelectedBatch,
    rollStart, setRollStart, rollEnd, setRollEnd,
    historySemester, setHistorySemester, getSubjectForHistory,historyLoading,
    selectedDiv // ✅ We rely ONLY on this now
}) => {
    const [qrCodeValue, setQrCodeValue] = useState('');
    const [timer, setTimer] = useState(10);
    const [manualRoll, setManualRoll] = useState("");
    const [absentList, setAbsentList] = useState("");
    const [classStrength, setClassStrength] = useState(0);
    const [attendanceMode, setAttendanceMode] = useState('qr'); // 'qr' or 'pin'
    const [currentPin, setCurrentPin] = useState('------');
    const [editingSession, setEditingSession] = useState(null);
    const [allStudentsReport, setAllStudentsReport] = useState([]);
    const [reportFilter, setReportFilter] = useState('All');


    // Fetch Class Strength for Percentage (Fixed for Division)
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

                let totalStudents = snap.size;

                // ✅ FIX: Recalculate strength if a specific Division is active
                if (selectedYear === 'FE' && selectedDiv && selectedDiv !== 'All') {
                    // Filter the fetched students to only count those in the selected division
                    const divisionStudents = snap.docs.filter(doc => doc.data().division === selectedDiv);
                    totalStudents = divisionStudents.length;
                }

                setClassStrength(totalStudents || 1); // Avoid division by zero
            }
        };
        fetchStrength();
    }, [teacherInfo, selectedYear, selectedDiv]); // 👈 Added selectedDiv dependency

    // --- 💾 PERSISTENCE: Load & Save Batch Roll Ranges ---

    // 1. Load settings when Batch, Year, or TeacherInfo changes
    useEffect(() => {
        // Construct unique key for this batch (e.g., "FE_A1", "SE_S1")
        const key = `${selectedYear}_${selectedBatch}`;
        
        if (teacherInfo?.batchSettings && teacherInfo.batchSettings[key]) {
            const saved = teacherInfo.batchSettings[key];
            setRollStart(saved.start);
            setRollEnd(saved.end);
        } else {
            // Default values if nothing is saved yet
            setRollStart(1);
            setRollEnd(20);
        }
    }, [selectedBatch, selectedYear, teacherInfo]); 

    // --- 🔄 AUTO-UPDATE BATCH DEFAULT (C -> C1, SE -> S1) ---
    useEffect(() => {
        if (sessionType === 'practical') {
            let prefix = 'A'; // Fallback

            if (selectedYear === 'FE') {
                // If FE, use the selected Division (e.g., 'C')
                prefix = (selectedDiv && selectedDiv !== 'All') ? selectedDiv : 'A';
            } else if (selectedYear === 'SE') {
                prefix = 'S';
            } else if (selectedYear === 'TE') {
                prefix = 'T';
            } else if (selectedYear === 'BE') {
                prefix = 'B';
            }

            // Always set default to "Prefix + 1" (e.g. C1, S1)
            setSelectedBatch(`${prefix}1`);
        }
    }, [selectedYear, selectedDiv, sessionType]);

    // 2. Save settings to Database (Triggered on Blur)
    const saveBatchRange = async () => {
        if (!teacherInfo || !auth.currentUser) return;
        
        const key = `${selectedYear}_${selectedBatch}`;
        try {
            // Save to 'batchSettings' map in the user's document
            await setDoc(doc(db, 'users', auth.currentUser.uid), {
                batchSettings: {
                    [key]: { start: rollStart, end: rollEnd }
                }
            }, { merge: true });
            
            // console.log("Batch range saved for", key);
        } catch (err) {
            console.error("Failed to save batch settings", err);
            toast.error("Could not save batch range");
        }
    };

    const filteredHistorySessions = historySessions.filter(session => {
        if (reportFilter === 'All') return true;
        return session.type === reportFilter.toLowerCase();
    });

    // --- 🟢 NEW: Batch Option Generator ---
    const getBatchOptions = () => {
        const batches = [];
        let prefix = '';
        let count = 6; // Default to 6 batches (A1-A6)

        if (selectedYear === 'FE') {
            // For FE, prefix is the Division (A -> A1, A2...)
            prefix = (selectedDiv && selectedDiv !== 'All') ? selectedDiv : 'A';
        } else if (selectedYear === 'SE') prefix = 'S';
        else if (selectedYear === 'TE') prefix = 'T';
        else if (selectedYear === 'BE') prefix = 'B';
        else prefix = 'B';

        for (let i = 1; i <= count; i++) {
            const label = `${prefix}${i}`;
            batches.push({ value: label, label: `Batch ${label}` });
        }
        return batches;
    };



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
                    // ✅ UPDATED: Send division if year is FE
                    division: selectedYear === 'FE' ? selectedDiv : null,
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
    // ✅ HANDLE SAVE FROM EDIT MODAL
    const handleAttendanceUpdate = async (session, changes) => {
        const toastId = toast.loading("Updating Attendance...");
        try {
            const promises = changes.map(async (student) => {
                if (student.status === 'Present') {
                    // Mark Present (Create Doc)
                    // We use the same backend API to ensure consistency, or write directly
                    // Writing directly for speed/edit mode:
                    await addDoc(collection(db, 'attendance'), {
                        rollNo: student.rollNo.toString(),
                        studentId: student.id,
                        name: student.name, // Ensure name is saved
                        teacherId: auth.currentUser.uid,
                        subject: getSubjectForHistory(), // Reuse subject logic
                        department: teacherInfo.department,
                        year: selectedYear,
                        division: session.division || null, // Important for FE
                        instituteId: teacherInfo.instituteId,
                        sessionId: session.sessionId,
                        timestamp: serverTimestamp(),
                        markedBy: 'teacher_edit', // Track who edited
                        status: 'Present'
                    });
                } else {
                    // Mark Absent (Delete Doc)
                    if (student.attendanceId) {
                        await deleteDoc(doc(db, 'attendance', student.attendanceId));
                    }
                }
            });

            await Promise.all(promises);
            toast.success("Attendance Updated!", { id: toastId });

            // Refresh Data
            // We can just toggle viewMode to trigger refetch or force a reload
            setEditingSession(null);
            const currentMode = viewMode;
            setViewMode('live');
            setTimeout(() => setViewMode(currentMode), 50); // Hacky refresh

        } catch (err) {
            console.error(err);
            toast.error("Update Failed", { id: toastId });
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
                    // ✅ UPDATED: Send division if year is FE
                    division: selectedYear === 'FE' ? selectedDiv : null,
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

    // ✅ NEW COMPONENT: Edit Attendance Modal (Perfectly Curved & Responsive)
    const EditAttendanceModal = ({ session, onClose, onUpdate }) => {
        const [students, setStudents] = useState(session.students);
        const [loading, setLoading] = useState(false);
        const [search, setSearch] = useState("");

        const toggleStatus = (rollNo) => {
            setStudents(prev => prev.map(s =>
                s.rollNo === rollNo ? { ...s, status: s.status === 'Present' ? 'Absent' : 'Present' } : s
            ));
        };

        const handleSave = async () => {
            setLoading(true);
            const changes = [];
            students.forEach(s => {
                const original = session.students.find(os => os.rollNo === s.rollNo);
                if (original.status !== s.status) {
                    changes.push(s);
                }
            });

            if (changes.length === 0) {
                onClose();
                return;
            }

            await onUpdate(session, changes);
            setLoading(false);
            onClose();
        };

        const filteredStudents = students.filter(s =>
            s.rollNo.toString().includes(search) || s.name.toLowerCase().includes(search.toLowerCase())
        );

        // ✅ USE PORTAL TO FIX SIDEBAR OVERLAP
        return ReactDOM.createPortal(
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(8px)',
                zIndex: 9999999,
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                animation: 'fadeIn 0.2s ease-out',
                padding: '20px' // Prevents touching edges on mobile
            }}>
                {/* Internal Animation Styles */}
                <style>{`
                @keyframes popInModal {
                    0% { opacity: 0; transform: scale(0.95) translateY(10px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>

                <div className="card" style={{
                    width: '100%', maxWidth: '480px', maxHeight: '85vh',
                    display: 'flex', flexDirection: 'column', padding: '0',
                    borderRadius: '24px', // 🚀 MAIN CURVE
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255,255,255,0.1)', background: 'white',
                    animation: 'popInModal 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    overflow: 'hidden' // 🚀 CLIPS CHILDREN TO CURVE
                }}>
                    {/* Header (Explicitly Curved Top) */}
                    <div style={{
                        padding: '20px 25px',
                        borderBottom: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'start',
                        borderRadius: '24px 24px 0 0' // 🚀 CURVE TOP
                    }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Edit Attendance</h3>

                            {/* Instruction Note */}
                            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="fas fa-info-circle" style={{ color: '#3b82f6' }}></i>
                                Tap status to toggle Present/Absent
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                background: '#e2e8f0', border: 'none', width: '32px', height: '32px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', fontSize: '18px'
                            }}
                        >
                            &times;
                        </button>
                    </div>

                    {/* Search */}
                    <div style={{ padding: '15px 20px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ position: 'relative' }}>
                            <i className="fas fa-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px' }}></i>
                            <input
                                placeholder="Search Name or Roll No..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{
                                    width: '100%', padding: '10px 10px 10px 36px', borderRadius: '12px',
                                    border: '1px solid #e2e8f0', outline: 'none', background: '#f8fafc', fontSize: '14px', transition: 'all 0.2s'
                                }}
                                onFocus={(e) => { e.target.style.background = 'white'; e.target.style.borderColor = '#3b82f6'; }}
                                onBlur={(e) => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#e2e8f0'; }}
                            />
                        </div>
                    </div>

                    {/* List - Scrollable Area */}
                    <div style={{ overflowY: 'auto', flex: 1, padding: '0 10px' }}>
                        {filteredStudents.length > 0 ? (
                            filteredStudents.map(s => (
                                <div key={s.rollNo}
                                    style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '12px 15px', borderBottom: '1px solid #f1f5f9'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '10px', background: '#f1f5f9',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#475569', fontSize: '13px'
                                        }}>
                                            {s.rollNo}
                                        </div>
                                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>{s.name}</span>
                                    </div>

                                    {/* Status Button (Toggle) */}
                                    <button
                                        onClick={() => toggleStatus(s.rollNo)}
                                        style={{
                                            padding: '6px 14px', borderRadius: '20px', border: 'none',
                                            fontWeight: 'bold', fontSize: '12px', cursor: 'pointer',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                            // Dynamic Colors
                                            background: s.status === 'Present' ? '#dcfce7' : '#fee2e2',
                                            color: s.status === 'Present' ? '#166534' : '#991b1b',
                                            minWidth: '80px', textAlign: 'center'
                                        }}
                                    >
                                        {s.status}
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                                <i className="fas fa-search" style={{ fontSize: '24px', marginBottom: '10px', opacity: 0.5 }}></i>
                                <p style={{ margin: 0, fontSize: '13px' }}>No student found</p>
                            </div>
                        )}
                    </div>

                    {/* Footer (Explicitly Curved Bottom) */}
                    <div style={{
                        padding: '20px',
                        borderTop: '1px solid #e2e8f0',
                        background: 'white',
                        borderRadius: '0 0 24px 24px' // 🚀 CURVE BOTTOM
                    }}>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="btn-primary"
                            style={{
                                width: '100%', justifyContent: 'center', padding: '14px', borderRadius: '14px',
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)', fontSize: '15px'
                            }}
                        >
                            {loading ? <i className="fas fa-spinner fa-spin"></i> : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    };

    // ✅ HANDLE QR ROTATION & DYNAMIC PIN UPDATES (FIXED)
    useEffect(() => {
        let interval, countdown;

        // ✅ CRITICAL FIX: Check if sessionId exists
        if (activeSession?.sessionId) {
            const updateSessionSecurity = async () => {
                // 1. Always update QR Value (Local state)
                setQrCodeValue(`${activeSession.sessionId}|${Date.now()}`);

                // 2. If in PIN Mode, generate and save new PIN
                if (attendanceMode === 'pin') {
                    const newPin = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit PIN
                    setCurrentPin(newPin);

                    try {
                        const sessionRef = doc(db, 'live_sessions', activeSession.sessionId);
                        // Write to Firestore
                        await updateDoc(sessionRef, {
                            currentPin: newPin,
                            lastPinUpdate: serverTimestamp()
                        });
                    } catch (err) {
                        console.error("Failed to update PIN", err);
                    }
                }
            };

            // Run immediately on start
            updateSessionSecurity();

            // Loop every 10 seconds
            interval = setInterval(() => {
                updateSessionSecurity();
                setTimer(10);
            }, 10000);

            // Countdown timer for UI
            countdown = setInterval(() => setTimer(p => p > 0 ? p - 1 : 0), 1000);
        }

        return () => {
            clearInterval(interval);
            clearInterval(countdown);
        };

        // ✅ FIX: Only re-run if sessionId changes (not the whole object)
    }, [activeSession?.sessionId, attendanceMode]);

    const isSessionRelevant = activeSession && (activeSession.targetYear === selectedYear || activeSession.targetYear === 'All');
    const dateObj = new Date(selectedDate);
    const formattedDate = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const presentCount = isSessionRelevant ? sortedAttendanceList.length : 0;
    const percentage = classStrength > 0 ? Math.round((presentCount / classStrength) * 100) : 0;

    // ✅ BULK EXPORT LOGIC
    const bulkCsvData = historySessions.flatMap(session =>
        session.students.map(s => ({
            Date: s.date,
            Time: session.startTime.split(',')[1],
            Subject: getSubjectForHistory(),
            Type: session.type,
            Batch: session.batch,
            Division: session.division || 'All',
            RollNo: s.rollNo,
            Name: s.name,
            Status: s.status,
            TimeIn: s.timeIn
        }))
    );

    const bulkHeaders = [
        { label: "Date", key: "Date" },
        { label: "Time", key: "Time" },
        { label: "Subject", key: "Subject" },
        { label: "Type", key: "Type" },
        { label: "Batch", key: "Batch" },
        { label: "Division", key: "Division" },
        { label: "Roll No", key: "RollNo" },
        { label: "Name", key: "Name" },
        { label: "Status", key: "Status" },
        { label: "Time In", key: "TimeIn" }
    ];

    return (
        <div className="content-section">
            {/* --- HEADER SECTION --- */}
            <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: '15px' }}>
                <div>
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
                    <div className="card" style={{
                        /* ✅ FIX: Force card to stack ABOVE the next card */
                        position: 'relative',
                        zIndex: 20,
                        overflow: 'visible',
                        background: isSessionRelevant ? 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)' : 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
                        border: isSessionRelevant ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                    }}>
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
                                    {/* Session Type Toggle (Theory / Practical) */}
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                        <button onClick={() => setSessionType('theory')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: sessionType === 'theory' ? '#2563eb' : 'white', color: sessionType === 'theory' ? 'white' : '#64748b', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: sessionType === 'theory' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}>Theory</button>
                                        <button onClick={() => setSessionType('practical')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: sessionType === 'practical' ? '#2563eb' : 'white', color: sessionType === 'practical' ? 'white' : '#64748b', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: sessionType === 'practical' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}>Practical</button>
                                    </div>

                                    {/* Practical Config (Restored Roll Nos) */}
                                    {sessionType === 'practical' && (
                                        <div style={{ marginTop: '10px', background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'visible' }}>
                                            
                                            {/* Batch Dropdown */}
                                            <div className="input-group" style={{ marginBottom: '8px' }}>
                                                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Batch Name</label>
                                                <CustomDropdown
                                                    value={selectedBatch}
                                                    onChange={(val) => setSelectedBatch(val)}
                                                    options={getBatchOptions()} 
                                                    placeholder="Select Batch"
                                                />
                                            </div>

                                            {/* ✅ RESTORED & PERSISTENT: Roll Number Range Inputs */}
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <div style={{ flex: 1 }}>
                                                     <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display:'block', marginBottom:'4px' }}>Start Roll</label>
                                                     <input
                                                        type="number"
                                                        value={rollStart}
                                                        onChange={(e) => setRollStart(e.target.value)}
                                                        onBlur={saveBatchRange} // 👈 SAVES TO DB WHEN YOU CLICK OUT
                                                        placeholder="1"
                                                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '13px', outline: 'none' }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                     <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display:'block', marginBottom:'4px' }}>End Roll</label>
                                                     <input
                                                        type="number"
                                                        value={rollEnd}
                                                        onChange={(e) => setRollEnd(e.target.value)}
                                                        onBlur={saveBatchRange} // 👈 SAVES TO DB WHEN YOU CLICK OUT
                                                        placeholder="20"
                                                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '13px', outline: 'none' }}
                                                    />
                                                </div>
                                            </div>

                                            <p style={{ fontSize: '11px', color: '#16a34a', marginTop: '8px', marginBottom: 0 }}>
                                                <i className="fas fa-check-circle"></i> Attendance restricted to Roll {rollStart}-{rollEnd}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <p style={{ color: isSessionRelevant ? '#166534' : '#1e40af', marginBottom: '20px', fontSize: '12px', opacity: 0.8 }}>
                                {isSessionRelevant
                                    ? `Code updates in ${timer}s`
                                    : `Configure session for ${selectedYear} ${selectedYear === 'FE' ? `(Div ${selectedDiv})` : ''}.`
                                }
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

                    {/* 3. ATTENDANCE METHOD CARD (QR or PIN) */}
                    {isSessionRelevant && (
                        <div className="card card-full-width" style={{ textAlign: 'center', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>

                            {/* Toggle Switch */}
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', gap: '10px' }}>
                                <button
                                    onClick={() => setAttendanceMode('qr')}
                                    style={{
                                        padding: '8px 16px', borderRadius: '20px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
                                        background: attendanceMode === 'qr' ? '#2563eb' : '#f1f5f9',
                                        color: attendanceMode === 'qr' ? 'white' : '#64748b'
                                    }}
                                >
                                    <i className="fas fa-qrcode"></i> Scan QR
                                </button>
                                <button
                                    onClick={() => setAttendanceMode('pin')}
                                    style={{
                                        padding: '8px 16px', borderRadius: '20px', border: 'none', fontWeight: 'bold', cursor: 'pointer',
                                        background: attendanceMode === 'pin' ? '#2563eb' : '#f1f5f9',
                                        color: attendanceMode === 'pin' ? 'white' : '#64748b'
                                    }}
                                >
                                    <i className="fas fa-key"></i> Dynamic PIN
                                </button>
                            </div>

                            {attendanceMode === 'qr' ? (
                                <>
                                    <div className="qr-code-wrapper" style={{ background: 'white', padding: '15px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(37,99,235,0.1)', display: 'inline-block' }}>
                                        <QRCodeSVG value={qrCodeValue} size={200} />
                                    </div>
                                    <p style={{ marginTop: '15px', fontSize: '13px', color: '#64748b' }}>Scan via AcadeX App</p>
                                </>
                            ) : (
                                <div style={{ padding: '20px' }}>
                                    <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                                        Enter this Code
                                    </div>
                                    <div style={{
                                        fontSize: '60px', fontWeight: '800', letterSpacing: '8px', color: '#2563eb',
                                        fontFamily: 'monospace', margin: '10px 0'
                                    }}>
                                        {currentPin}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 'bold' }}>
                                        Refreshes in {timer}s
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 4. ACTIONS */}
                    {isSessionRelevant && (
                        <div className="card-full-width" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div className="card" style={{ borderLeft: '4px solid #f59e0b', padding: '15px', background: '#fffbeb' }}>
                                <h3 style={{ fontSize: '14px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: '700' }}>
                                    <i className="fas fa-user-minus" style={{ color: '#f59e0b' }}></i> Quick Absentee
                                </h3>
                                <input type="text" placeholder="Roll Nos (e.g. 1, 5, 12)" value={absentList} onChange={(e) => setAbsentList(e.target.value)} className="modern-input" style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid #fcd34d', borderRadius: '6px', background: 'white' }} />
                                <button className="btn-modern-primary" onClick={handleInverseAttendance} style={{ background: '#f7da72', color: '#000000', border: '1px solid #edd587', marginTop: '10px', width: '100%', fontSize: '12px', padding: '8px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '6px' }}>
                                    Mark Rest Present
                                </button>
                            </div>

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

           {/* --- HISTORY MODE (Unified & Filtered) --- */}
            {viewMode === 'history' && (
                <div className="cards-grid">
                    
                    {/* 1. FILTERS & EXPORT CONTROLS */}
                    <div className="card card-full-width" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: '#f8fafc', flexWrap: 'wrap' }}>
                        
                        {/* Semester Selector */}
                        <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', display: 'block', textTransform: 'uppercase', marginBottom: '5px' }}>Semester</label>
                            <CustomDropdown
                                value={historySemester}
                                onChange={(val) => setHistorySemester(Number(val))}
                                options={[
                                    ...(selectedYear === 'FE' ? [{ value: 1, label: 'Sem 1' }, { value: 2, label: 'Sem 2' }] : []),
                                    ...(selectedYear === 'SE' ? [{ value: 3, label: 'Sem 3' }, { value: 4, label: 'Sem 4' }] : []),
                                    ...(selectedYear === 'TE' ? [{ value: 5, label: 'Sem 5' }, { value: 6, label: 'Sem 6' }] : []),
                                    ...(selectedYear === 'BE' ? [{ value: 7, label: 'Sem 7' }, { value: 8, label: 'Sem 8' }] : []),
                                    ...(!['FE', 'SE', 'TE', 'BE'].includes(selectedYear) ? [{ value: 1, label: 'Sem 1' }, { value: 2, label: 'Sem 2' }] : [])
                                ]}
                                placeholder="Select Sem"
                            />
                        </div>

                        {/* Report Type Toggle */}
                        <div style={{ flex: 1.5, minWidth: '200px' }}>
                            <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Report Type</label>
                            <div style={{ display: 'flex', gap: '5px', background: 'white', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                {['All', 'Theory', 'Practical'].map(type => (
                                    <button 
                                        key={type}
                                        onClick={() => setReportFilter(type)}
                                        style={{
                                            flex: 1, padding: '8px', border: 'none',
                                            background: reportFilter === type ? '#eff6ff' : 'transparent',
                                            color: reportFilter === type ? '#2563eb' : '#64748b',
                                            fontWeight: '700', borderRadius: '8px', cursor: 'pointer',
                                            fontSize: '12px', transition: 'all 0.2s'
                                        }}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Dates */}
                        <div style={{ flex: 2, minWidth: '220px', display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>From</label>
                                <div style={{ position: 'relative', width: '100%' }}>
                                    <input 
                                        type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                        onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                        style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '600', color: '#334155', outline: 'none', background: 'white', cursor: 'pointer' }}
                                    />
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>To</label>
                                <div style={{ position: 'relative', width: '100%' }}>
                                    <input 
                                        type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                                        onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                        style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '600', color: '#334155', outline: 'none', background: 'white', cursor: 'pointer' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ✅ MODERN EXPORT BUTTONS */}
                        <div className="export-actions">
                            <button 
                                onClick={() => {
                                    if (filteredHistorySessions.length === 0) return toast.error("No data matches current filter");
                                    generatePDFReport(
                                        teacherInfo, selectedYear, selectedDiv, 
                                        `${getSubjectForHistory()} (${reportFilter})`, 
                                        startDate, endDate, filteredHistorySessions, allStudentsReport
                                    );
                                }}
                                className={`btn-export btn-pdf ${filteredHistorySessions.length === 0 ? 'btn-disabled' : ''}`}
                                disabled={filteredHistorySessions.length === 0}
                            >
                                <i className="fas fa-file-pdf"></i> PDF
                            </button>

                            {filteredHistorySessions.length > 0 ? (
                                <CSVLink
                                    data={prepareReportData(filteredHistorySessions, allStudentsReport).rows} 
                                    headers={[
                                        { label: "Roll No", key: "rollNo" },
                                        { label: "Name", key: "name" },
                                        ...prepareReportData(filteredHistorySessions, allStudentsReport).columns.map(c => ({ label: c.header.replace('\n', ' '), key: c.dataKey })),
                                        { label: "Total Lectures", key: "totalHeld" },
                                        { label: "Attended", key: "totalAttended" },
                                        { label: "Percentage", key: "percentage" }
                                    ]}
                                    filename={`Attendance_${reportFilter}_${getSubjectForHistory()}.csv`}
                                    className="btn-export btn-excel"
                                >
                                    <i className="fas fa-file-excel"></i> Excel
                                </CSVLink>
                            ) : (
                                <button className="btn-export btn-disabled" disabled>
                                    <i className="fas fa-file-excel"></i> Excel
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ✅ LOADER OR CONTENT */}
                    {historyLoading ? (
                        <div className="loader-container">
                            <div className="modern-loader"></div>
                            <p>Loading reports...</p>
                        </div>
                    ) : (
                        <>
                            {/* 2. CHART SECTION */}
                            <div className="card fade-in-up" style={{ height: '400px', padding: '20px', marginBottom: '20px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={filteredHistorySessions.length ? [{ name: reportFilter, value: filteredHistorySessions.reduce((acc, s) => acc + s.presentCount, 0) }] : []}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                        <YAxis axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{ fill: '#f8fafc' }} />
                                        <Bar dataKey="value" fill={reportFilter === 'Practical' ? '#7c3aed' : '#3b82f6'} name="Total Present" radius={[10, 10, 0, 0]} barSize={60} />
                                    </BarChart>
                                </ResponsiveContainer>
                                {filteredHistorySessions.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '-200px' }}>No {reportFilter !== 'All' ? reportFilter.toLowerCase() : ''} records found.</p>}
                            </div>

                            {/* 3. SESSION LIST */}
                            {filteredHistorySessions.length === 0 ? (
                                <div className="card card-full-width" style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                                    <i className="fas fa-calendar-times" style={{ fontSize: '40px', marginBottom: '15px', opacity: 0.5 }}></i>
                                    <p style={{ fontSize: '16px', fontWeight: '600' }}>No {reportFilter} sessions found.</p>
                                </div>
                            ) : (
                                filteredHistorySessions.map((session) => (
                                    <div key={session.sessionId} className="card card-full-width" style={{ marginBottom: '20px', borderLeft: session.type === 'practical' ? '5px solid #8b5cf6' : '5px solid #3b82f6' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
                                            <div style={{ flex: 1, minWidth: '200px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                    <span style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>{session.startTime}</span>
                                                    {selectedYear === 'FE' && session.division && (
                                                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>Div {session.division}</span>
                                                    )}
                                                    <span style={{ background: session.type === 'practical' ? '#ede9fe' : '#eff6ff', color: session.type === 'practical' ? '#7c3aed' : '#2563eb', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                        {session.type === 'practical' ? `🧪 Practical (Batch ${session.batch})` : '📚 Theory'}
                                                    </span>
                                                </div>
                                                <p style={{ fontSize: '13px', color: '#64748b', margin: '8px 0 0 0' }}>
                                                    Present: <strong style={{ color: '#166534' }}>{session.presentCount}</strong> | Absent: <strong style={{ color: '#dc2626' }}>{session.absentCount}</strong>
                                                </p>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <button onClick={() => setEditingSession(session)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#4f46e5', fontSize: '13px', fontWeight: '600', background: '#eef2ff', border: 'none', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px' }}>
                                                    <i className="fas fa-edit"></i> Edit
                                                </button>
                                            </div>
                                        </div>

                                        <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                            <table className="attendance-table">
                                                <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}><tr><th>Roll No</th><th>Name</th><th>Status</th></tr></thead>
                                                <tbody>
                                                    {session.students.map(s => (
                                                        <tr key={s.id} style={{ background: s.status === 'Absent' ? '#fef2f2' : 'white' }}>
                                                            <td style={{ fontWeight: 'bold' }}>{s.rollNo}</td>
                                                            <td>{s.name}</td>
                                                            <td><span className={`status-badge ${s.status === 'Present' ? 'status-approved' : 'status-rejected'}`}>{s.status}</span></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}

                    {/* ✅ CSS INJECTION FOR BUTTONS & LOADER */}
                    <style>{`
                        .modern-loader {
                            width: 50px;
                            height: 50px;
                            border: 5px solid #f3f3f3;
                            border-top: 5px solid #3b82f6;
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                            margin: 0 auto 15px auto;
                        }
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                        
                        .loader-container {
                            grid-column: 1 / -1;
                            text-align: center;
                            padding: 80px;
                            color: #64748b;
                            background: white;
                            border-radius: 16px;
                            border: 1px dashed #e2e8f0;
                        }

                        .export-actions {
                            display: flex;
                            gap: 12px;
                            align-items: center;
                            justify-content: flex-end;
                            flex-wrap: wrap;
                            flex: 2;
                            min-width: 280px;
                        }

                        .btn-export {
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                            gap: 8px;
                            padding: 10px 20px;
                            border-radius: 12px;
                            font-weight: 700;
                            font-size: 13px;
                            transition: all 0.2s ease;
                            border: none;
                            cursor: pointer;
                            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                            height: 42px;
                            white-space: nowrap;
                        }
                        .btn-export:hover:not(:disabled) {
                            transform: translateY(-2px);
                            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                        }
                        .btn-export:active:not(:disabled) { transform: translateY(0); }
                        
                        .btn-pdf { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; }
                        .btn-excel { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; }
                        
                        .btn-disabled {
                            background: #e2e8f0;
                            color: #94a3b8;
                            cursor: not-allowed;
                            box-shadow: none;
                        }
                    `}</style>
                </div>
            )}
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
            {/* ✅ GLOBAL CSS FIXES */}
            <style>{`
                .gradient-text {
                    background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    font-size: 24px;
                    margin: 0;
                    font-weight: 700;
                }
                
                /* FIX: Ensure dropdowns options are scrollable and visible */
                .custom-dropdown-options {
                    max-height: 200px; /* Limit height */
                    overflow-y: auto !important; /* Force scroll */
                    z-index: 9999 !important; /* Ensure it floats on top */
                }
                
                /* FIX: Ensure cards don't clip the dropdown */
                .card, .task-card-modern, .create-card {
                    overflow: visible !important; 
                }
            `}</style>
            {editingSession && (
                <EditAttendanceModal
                    session={editingSession}
                    onClose={() => setEditingSession(null)}
                    onUpdate={handleAttendanceUpdate}
                />
            )}
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

// ✅ NEW: Native Location Helper (Handles Android Permissions & GPS)
const getLocation = async () => {
    try {
        // 1. Check permissions first
        const permissionStatus = await Geolocation.checkPermissions();
        
        if (permissionStatus.location === 'denied') {
            throw new Error("Location permission denied. Please enable it in settings.");
        }

        // 2. Request permission if not granted
        if (permissionStatus.location !== 'granted') {
            const request = await Geolocation.requestPermissions();
            if (request.location !== 'granted') {
                throw new Error("Location permission is required to start a session.");
            }
        }

        // 3. Get Position (High Accuracy)
        // This automatically triggers the "Turn on Device Location" popup on Android if GPS is off
        const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });

        return position; 

    } catch (error) {
        console.error("Location Error:", error);
        throw error;
    }
};

// --- 📅 CUSTOM DATE PICKER (Mobile Friendly) ---
const CustomDatePicker = ({ label, value, onChange }) => {
    // Helper: Parse 'YYYY-MM-DD' or use today
    const dateObj = value ? new Date(value) : new Date();
    const currentDay = dateObj.getDate();
    const currentMonth = dateObj.getMonth();
    const currentYear = dateObj.getFullYear();

    // 1. Days Array (1-31)
    const days = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: (i + 1).toString() }));

    // 2. Months Array (Full Jan-Dec)
    const months = [
        { value: 0, label: "Jan" },
        { value: 1, label: "Feb" },
        { value: 2, label: "Mar" },
        { value: 3, label: "Apr" },
        { value: 4, label: "May" },
        { value: 5, label: "Jun" },
        { value: 6, label: "Jul" },
        { value: 7, label: "Aug" },
        { value: 8, label: "Sep" },
        { value: 9, label: "Oct" },
        { value: 10, label: "Nov" },
        { value: 11, label: "Dec" }
    ];

    // 3. Years Array (Current Year - 5 Years back)
    const years = Array.from({ length: 5 }, (_, i) => {
        const y = new Date().getFullYear() - i;
        return { value: y, label: y.toString() };
    });

    // Handle updates and return 'YYYY-MM-DD' string to parent
    const updateDate = (d, m, y) => {
        const formatted = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        onChange(formatted);
    };

    return (
        <div style={{ width: '100%' }}>
            {label && <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', display: 'block', textTransform: 'uppercase', marginBottom: '5px' }}>{label}</label>}
            <div style={{ display: 'flex', gap: '8px' }}>
                {/* DAY */}
                <div style={{ flex: 1 }}>
                    <CustomDropdown
                        value={currentDay}
                        onChange={(val) => updateDate(Number(val), currentMonth, currentYear)}
                        options={days}
                    />
                </div>
                {/* MONTH */}
                <div style={{ flex: 1.5 }}>
                    <CustomDropdown
                        value={currentMonth}
                        onChange={(val) => updateDate(currentDay, Number(val), currentYear)}
                        options={months}
                    />
                </div>
                {/* YEAR */}
                <div style={{ flex: 1.5 }}>
                    <CustomDropdown
                        value={currentYear}
                        onChange={(val) => updateDate(currentDay, currentMonth, Number(val))}
                        options={years}
                    />
                </div>
            </div>
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
    const [historyDivision, setHistoryDivision] = useState('All');
    const { downloadFile } = useFileDownloader();
    const [allStudentsReport, setAllStudentsReport] = useState([]);


    // Year & Subject Logic
    const [selectedYear, setSelectedYear] = useState(null);
    const [showYearModal, setShowYearModal] = useState(false);

    // Lab / Practical State
    const [sessionType, setSessionType] = useState('theory'); // 'theory' | 'practical'
    const [selectedBatch, setSelectedBatch] = useState('A');
    const [rollStart, setRollStart] = useState(1);
    const [rollEnd, setRollEnd] = useState(20);
    const [selectedDiv, setSelectedDiv] = useState('A');

    // History State
    const [viewMode, setViewMode] = useState('live');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [historySemester, setHistorySemester] = useState(1);
    const [activeSemesters, setActiveSemesters] = useState({});
    // ✅ NEW: Store an array of SESSIONS, not just a flat list of students
    const [historySessions, setHistorySessions] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const navigate = useNavigate();
    const getSubjectForHistory = () => {
        if (!teacherInfo) return "";

        // 1. Check assignedClasses array first
        if (teacherInfo.assignedClasses) {
            const pastClass = teacherInfo.assignedClasses.find(c =>
                c.year === selectedYear && Number(c.semester) === Number(historySemester)
            );
            if (pastClass) return pastClass.subject;
        }

        // 2. Fallback
        return teacherInfo.subject;
    };

    const playSessionStartSound = () => { const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3'); audio.play().catch(error => console.log("Audio play failed:", error)); };

    useEffect(() => {
        if (!auth.currentUser) return;
        const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setTeacherInfo(data);

                // 1. Auto-Select Year if teacher has only one class
                if (data.assignedClasses && data.assignedClasses.length === 1) {
                    setSelectedYear(data.assignedClasses[0].year);
                } else if (data.assignedYears && data.assignedYears.length === 1 && !data.assignedClasses) {
                    setSelectedYear(data.assignedYears[0]);
                } else if ((data.assignedClasses?.length > 1 || data.assignedYears?.length > 1) && !selectedYear) {
                    setShowYearModal(true);
                } else if (!selectedYear) {
                    setSelectedYear('All');
                }

                // ✅ NEW: Auto-select default Division if FE is active
                if (selectedYear === 'FE' && data.assignedClasses) {
                    const feClass = data.assignedClasses.find(c => c.year === 'FE');
                    // If teacher has "A, B" assigned, auto-select "A"
                    if (feClass && feClass.divisions) {
                        const firstDiv = feClass.divisions.split(',')[0].trim();
                        setSelectedDiv(firstDiv);
                    }
                }
            }
        });
        return () => unsub();
    }, [auth.currentUser, selectedYear]);

    useEffect(() => {
        const fetchStats = async () => {
            if (!teacherInfo?.instituteId || !teacherInfo?.department) return;
            try {
                // Fetch the same document the HOD updates
                const docRef = doc(db, "department_stats", `${teacherInfo.instituteId}_${teacherInfo.department}`);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setActiveSemesters(docSnap.data().activeSemesters || {});
                }
            } catch (err) {
                console.error("Error fetching dept stats:", err);
            }
        };
        fetchStats();
    }, [teacherInfo]);

    // ✅ NEW: Auto-select the correct semester when Teacher switches Year
    useEffect(() => {
        if (selectedYear && activeSemesters[selectedYear]) {
            // If HOD set a semester, use it
            setHistorySemester(activeSemesters[selectedYear]);
        } else {
            // Fallback defaults if HOD hasn't configured it yet
            if (selectedYear === 'FE') setHistorySemester(1);
            else if (selectedYear === 'SE') setHistorySemester(3);
            else if (selectedYear === 'TE') setHistorySemester(5);
            else if (selectedYear === 'BE') setHistorySemester(7);
        }
    }, [selectedYear, activeSemesters]);

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

   // ✅ UPDATED HISTORY FETCH (With Loader)
    useEffect(() => {
        const fetchHistory = async () => {
            if (!teacherInfo?.instituteId || !selectedYear) return;

            setHistoryLoading(true); // ⏳ START LOADING

            const targetSubject = getSubjectForHistory();
            if (!targetSubject) {
                setHistorySessions([]);
                setHistoryLoading(false);
                return;
            }

            // Define Range
            const start = new Date(startDate); start.setHours(0, 0, 0, 0);
            const end = new Date(endDate); end.setHours(23, 59, 59, 999);

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

                let allStudents = studentsSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    rollNo: parseInt(doc.data().rollNo) || 9999
                }));

                if (selectedYear === 'FE' && selectedDiv && selectedDiv !== 'All') {
                    allStudents = allStudents.filter(s => s.division === selectedDiv);
                }

                setAllStudentsReport(allStudents);

                // 2. Get Attendance Records
                const qAttendance = query(
                    collection(db, 'attendance'),
                    where('instituteId', '==', teacherInfo.instituteId),
                    where('subject', '==', targetSubject),
                    where('timestamp', '>=', Timestamp.fromDate(start)),
                    where('timestamp', '<=', Timestamp.fromDate(end))
                );
                const attSnap = await getDocs(qAttendance);

                // 3. Process Session Data
                const uniqueSessionIds = new Set();
                attSnap.docs.forEach(d => uniqueSessionIds.add(d.data().sessionId));

                const sessionMetaMap = {};
                await Promise.all(Array.from(uniqueSessionIds).map(async (sId) => {
                    try {
                        const sDoc = await getDoc(doc(db, 'live_sessions', sId));
                        if (sDoc.exists()) sessionMetaMap[sId] = sDoc.data();
                    } catch (e) { console.error("Error fetching session details", e); }
                }));

                const sessionsMap = {};
                attSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const sId = data.sessionId;
                    const meta = sessionMetaMap[sId] || {};

                    if (selectedYear === 'FE') {
                        if (meta.division && meta.division !== selectedDiv) return;
                    }

                    if (!sessionsMap[sId]) {
                        sessionsMap[sId] = {
                            sessionId: sId,
                            startTime: data.timestamp.toDate().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
                            rawDate: data.timestamp.toDate(),
                            type: meta.type || 'theory',
                            batch: meta.batch || 'All',
                            division: meta.division || (selectedYear === 'FE' ? 'A' : null),
                            rollRange: meta.rollRange || null,
                            presentRolls: new Map()
                        };
                    }
                    sessionsMap[sId].presentRolls.set(parseInt(data.rollNo), doc.id);
                });

                const finalSessions = Object.values(sessionsMap).map(session => {
                    let targetStudents = allStudents;
                    if (session.type === 'practical' && session.rollRange) {
                        const { start, end } = session.rollRange;
                        targetStudents = allStudents.filter(s => s.rollNo >= start && s.rollNo <= end);
                    }

                    const studentsWithStatus = targetStudents.map(student => {
                        const attendanceId = session.presentRolls.get(student.rollNo);
                        return {
                            id: student.id,
                            rollNo: student.rollNo,
                            name: `${student.firstName} ${student.lastName}`,
                            status: !!attendanceId ? 'Present' : 'Absent',
                            timeIn: !!attendanceId ? session.startTime.split(',')[1] : '-',
                            date: session.startTime.split(',')[0],
                            attendanceId: attendanceId || null
                        };
                    });

                    studentsWithStatus.sort((a, b) => a.rollNo - b.rollNo);

                    return {
                        ...session,
                        totalStudents: targetStudents.length,
                        presentCount: studentsWithStatus.filter(s => s.status === 'Present').length,
                        absentCount: studentsWithStatus.filter(s => s.status === 'Absent').length,
                        students: studentsWithStatus
                    };
                });

                finalSessions.sort((a, b) => b.rawDate - a.rawDate);
                setHistorySessions(finalSessions);

            } catch (err) {
                console.error("History Error:", err);
                toast.error("Failed to load history.");
            } finally {
                setHistoryLoading(false); // ✅ STOP LOADING
            }
        };

        if (viewMode === 'history') fetchHistory();

    }, [viewMode, startDate, endDate, teacherInfo, selectedYear, historySemester, selectedDiv]);



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
                setActiveSession(null);
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
            const startToast = toast.loading("Acquiring Location..."); 

            try {
                // ✅ 1. Get Location using Native Plugin
                const pos = await getLocation();

                // ✅ 2. Location Found - Proceed to Start
                toast.loading("Starting Session...", { id: startToast });

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
                        division: selectedYear === 'FE' ? selectedDiv : null,
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
                // Handle Location or Network Errors
                let msg = err.message || "Failed to start session";
                if (msg.includes("denied")) msg = "Location Access Denied";
                
                toast.error(msg, { id: startToast });
            } finally {
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
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate} setEndDate={setEndDate}
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
                historySemester={historySemester}
                setHistorySemester={setHistorySemester}
                getSubjectForHistory={getSubjectForHistory}
                selectedDiv={selectedDiv}       // ✅ Pass Prop
                setSelectedDiv={setSelectedDiv}
                historyDivision={historyDivision}
                setHistoryDivision={setHistoryDivision}
            />;
            case 'analytics': return <TeacherAnalytics teacherInfo={teacherInfo} selectedYear={selectedYear} selectedDiv={selectedDiv} />;
            case 'reports':
                return (
                    <div className="content-section">
                        <h2 className="content-title">Attendance Reports</h2>

                        {/* ✅ NEW: Aligned Controls Container */}
                        <div className="card fade-in-up" style={{ padding: '20px', marginBottom: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', alignItems: 'end' }}>

                                {/* 1. Semester Selection (Custom Dropdown) */}
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>
                                        Semester
                                    </label>
                                    <CustomDropdown
                                        value={historySemester}
                                        onChange={setHistorySemester}
                                        options={[
                                            { value: 1, label: 'Sem 1' }, { value: 2, label: 'Sem 2' },
                                            { value: 3, label: 'Sem 3' }, { value: 4, label: 'Sem 4' },
                                            { value: 5, label: 'Sem 5' }, { value: 6, label: 'Sem 6' },
                                            { value: 7, label: 'Sem 7' }, { value: 8, label: 'Sem 8' }
                                        ]}
                                    />
                                </div>

                                {/* 2. Date Selection (Mobile Fixed with CustomDatePicker) */}
                                <div>
                                    <CustomDatePicker
                                        label="Select Date"
                                        value={selectedDate}
                                        onChange={setSelectedDate}
                                    />
                                </div>

                                {/* 3. Subject Context Display */}
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>
                                        Viewing Report For
                                    </label>
                                    <div style={{
                                        padding: '12px', background: '#f1f5f9', borderRadius: '12px',
                                        border: '1px solid #e2e8f0', fontWeight: '600', color: '#334155',
                                        height: '48px', display: 'flex', alignItems: 'center', fontSize: '13px'
                                    }}>
                                        {selectedYear} {selectedYear === 'FE' && selectedDiv ? `- Div ${selectedDiv}` : ''} • {getSubjectForHistory()}
                                    </div>
                                </div>

                                {/* 4. NEW REPORT BUTTONS (Always Visible) */}
                                <div style={{ flex: 2, minWidth: '200px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>

                                    {/* PDF BUTTON */}
                                    <button
                                        onClick={() => {
                                            if (historySessions.length === 0) return toast.error("No data to download");
                                            generatePDFReport(
                                                teacherInfo, selectedYear, selectedDiv, getSubjectForHistory(),
                                                startDate, endDate, historySessions, allStudentsReport
                                            );
                                        }}
                                        className="btn-primary"
                                        style={{
                                            background: '#ef4444',
                                            border: 'none',
                                            padding: '10px 15px',
                                            borderRadius: '8px',
                                            cursor: historySessions.length > 0 ? 'pointer' : 'not-allowed', // Change cursor
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            color: 'white',
                                            fontWeight: 'bold',
                                            opacity: historySessions.length > 0 ? 1 : 0.5, // Grey out if disabled
                                            boxShadow: '0 4px 10px rgba(239, 68, 68, 0.2)'
                                        }}
                                    >
                                        <i className="fas fa-file-pdf"></i> PDF Report
                                    </button>

                                    {/* EXCEL BUTTON */}
                                    {historySessions.length > 0 ? (
                                        <CSVLink
                                            data={prepareReportData(historySessions, allStudentsReport).rows}
                                            headers={[
                                                { label: "Roll No", key: "rollNo" },
                                                { label: "Name", key: "name" },
                                                ...prepareReportData(historySessions, allStudentsReport).columns.map(c => ({ label: c.header.replace('\n', ' '), key: c.dataKey })),
                                                { label: "Total Lectures", key: "totalHeld" },
                                                { label: "Attended", key: "totalAttended" },
                                                { label: "Percentage", key: "percentage" }
                                            ]}
                                            filename={`Attendance_Report_${getSubjectForHistory()}.csv`}
                                            className="btn-primary"
                                            style={{
                                                textDecoration: 'none',
                                                background: '#10b981',
                                                border: 'none',
                                                padding: '10px 15px',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                color: 'white',
                                                fontWeight: 'bold',
                                                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)'
                                            }}
                                        >
                                            <i className="fas fa-file-excel"></i> Excel Report
                                        </CSVLink>
                                    ) : (
                                        /* Disabled Excel Button Placeholder */
                                        <button
                                            className="btn-primary"
                                            disabled
                                            style={{
                                                background: '#10b981',
                                                border: 'none',
                                                padding: '10px 15px',
                                                borderRadius: '8px',
                                                cursor: 'not-allowed',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                color: 'white',
                                                fontWeight: 'bold',
                                                opacity: 0.5
                                            }}
                                        >
                                            <i className="fas fa-file-excel"></i> Excel Report
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Chart / Data Area */}
                        <div className="card fade-in-up" style={{ height: '400px', padding: '20px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={historySessions.length ? [{ name: 'Present', value: historySessions.reduce((acc, s) => acc + s.presentCount, 0) }] : []}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="value" fill="#3b82f6" name="Total Present" radius={[10, 10, 0, 0]} barSize={60} />
                                </BarChart>
                            </ResponsiveContainer>
                            {historySessions.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '-200px' }}>No records found for this date.</p>}
                        </div>
                    </div>
                );
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
                                        <button
                                            onClick={() => downloadFile(notice.attachmentUrl, `Notice_${notice.id}.pdf`)}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px',
                                                color: '#2563eb', fontSize: '13px', fontWeight: '600', textDecoration: 'none',
                                                background: '#f0f9ff', padding: '6px 12px', borderRadius: '6px',
                                                border: '1px solid #bfdbfe', cursor: 'pointer'
                                            }}
                                        >
                                            <i className="fas fa-file-download"></i> Download Attachment
                                        </button>
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
                        <h2 style={{ color: '#1e293b', marginBottom: '15px' }}>Select Classroom</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                            {/* ✅ LOGIC: Generate specific buttons for EACH Division */}
                            {teacherInfo?.assignedClasses?.flatMap(cls => {
                                // 1. If FE, split into separate buttons for each assigned Division
                                if (cls.year === 'FE' && cls.divisions) {
                                    if (cls.divisions.toLowerCase() === 'all') {
                                        return [{ ...cls, displayDiv: 'All', uniqueKey: 'FE-All' }];
                                    }
                                    // Split "A, B" -> Objects for A and B
                                    return cls.divisions.split(',').map(d => ({
                                        ...cls,
                                        displayDiv: d.trim(),
                                        uniqueKey: `${cls.year}-${d.trim()}`
                                    }));
                                }
                                // 2. Default for SE/TE/BE
                                return [{ ...cls, displayDiv: null, uniqueKey: cls.year }];
                            }).map(cls => (
                                <button
                                    key={cls.uniqueKey}
                                    onClick={() => {
                                        setSelectedYear(cls.year);
                                        // ✅ SET DIVISION STATE IMMEDIATELY
                                        if (cls.displayDiv) setSelectedDiv(cls.displayDiv);
                                        setShowYearModal(false);
                                        toast.success(`Entered ${cls.year} ${cls.displayDiv ? `(Div ${cls.displayDiv})` : ''}`);
                                    }}
                                    style={{
                                        padding: '15px', background: '#fff', border: '1px solid #e2e8f0',
                                        borderRadius: '12px', fontSize: '15px', fontWeight: 'bold',
                                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                                    }}
                                >
                                    <div style={{ textAlign: 'left' }}>
                                        <span style={{ display: 'block', color: '#1e293b' }}>
                                            {cls.year} {cls.displayDiv && <span style={{ color: '#2563eb' }}>(Div {cls.displayDiv})</span>}
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                                            {cls.subject}
                                        </span>
                                    </div>
                                    <i className="fas fa-chevron-right" style={{ color: '#cbd5e1' }}></i>
                                </button>
                            ))}

                            {/* Fallback for old accounts */}
                            {!teacherInfo?.assignedClasses && teacherInfo?.assignedYears?.map(y => (
                                <button key={y} onClick={() => { setSelectedYear(y); setShowYearModal(false); }} style={{ padding: '15px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}><span>{y} Year</span></button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)}></div>}
            <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`}>
                <div className="logo-container">
                    <img src={logo} alt="Logo" className="sidebar-logo" />
                    <span className="logo-text">AcadeX</span>
                </div>

                {teacherInfo && (
                    <div className="teacher-info" onClick={() => { setActivePage('profile'); setIsMobileNavOpen(false); }} style={{ cursor: 'pointer' }}>
                        <h4>{teacherInfo.firstName} {teacherInfo.lastName}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <p style={{ margin: 0, fontSize: '13px', opacity: 0.9 }}>
                                {selectedYear} • {teacherInfo.assignedClasses?.find(c => c.year === selectedYear)?.subject || "Select Class"}
                            </p>

                            {/* ✅ BEAUTIFUL DIV BADGE (Only for FE) */}
                            {selectedYear === 'FE' && selectedDiv && (
                                <span style={{
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    color: '#3b82f6',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(59, 130, 246, 0.2)'
                                }}>
                                    Div {selectedDiv}
                                </span>
                            )}
                        </div>

                        {/* ✅ SWITCH CLASS BUTTON (Hidden if only 1 class) */}
                        {(teacherInfo.assignedClasses && teacherInfo.assignedClasses.length > 1) && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();

                                    // ✅ NEW GUARD: Prevent switching if session is active
                                    if (activeSession) {
                                        toast.error("⚠️ Please end the current session before switching classes.");
                                        return;
                                    }

                                    setShowYearModal(true);
                                }}
                                className="edit-profile-pill"
                                style={{
                                    marginTop: '12px',
                                    // ✅ VISUAL FEEDBACK: Grey out if disabled
                                    background: activeSession ? '#f1f5f9' : '#f8fafc',
                                    color: activeSession ? '#94a3b8' : '#64748b',
                                    border: '1px solid #e2e8f0',
                                    justifyContent: 'center',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    letterSpacing: '0.3px',
                                    // ✅ CURSOR FEEDBACK
                                    cursor: activeSession ? 'not-allowed' : 'pointer',
                                    opacity: activeSession ? 0.7 : 1
                                }}
                            >
                                <i className="fas fa-exchange-alt" style={{ fontSize: '10px', color: activeSession ? '#cbd5e1' : '#94a3b8' }}></i>
                                <span>Switch Class</span>
                            </div>
                        )}
                    </div>
                )}

                <ul className="menu">
                    <NavLink page="dashboard" iconClass="fa-th-large" label="Dashboard" />
                    <NavLink page="analytics" iconClass="fa-chart-bar" label="Analytics" />
                    <NavLink page="announcements" iconClass="fa-bullhorn" label="Announcements" />
                    <NavLink page="addTasks" iconClass="fa-tasks" label="Add Tasks" />

                    {/* ✅ ADDED PROFILE TAB */}
                    <NavLink page="profile" iconClass="fa-user-circle" label="Profile" />

                    {/* Staff Notices with Red Badge */}
                    <li className={activePage === 'adminNotices' ? 'active' : ''} onClick={() => { setActivePage('adminNotices'); setIsMobileNavOpen(false); }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '15px' }}>
                            <i className="fas fa-bell" style={{ width: '24px', textAlign: 'center' }}></i>
                            <span>Staff Notices</span>
                            {unreadNoticeCount > 0 && (
                                <span className="nav-badge" style={{ background: '#ef4444', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', marginLeft: 'auto', fontWeight: 'bold' }}>
                                    {unreadNoticeCount}
                                </span>
                            )}
                        </div>
                    </li>

                    <li onClick={() => setIsMobileNavOpen(false)} style={{ marginTop: 'auto', marginBottom: '10px' }}>
                        <CSVLink data={csvData} headers={csvHeaders} filename={csvFilename} className="csv-link">
                            <i className="fas fa-file-download"></i><span>Download Data</span>
                        </CSVLink>
                    </li>
                </ul>

                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="logout-btn">
                        <i className="fas fa-sign-out-alt"></i><span>Logout</span>
                    </button>
                </div>
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

