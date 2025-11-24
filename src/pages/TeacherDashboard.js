import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase'; 
import { collection, doc, setDoc, serverTimestamp, onSnapshot, query, where, getDocs, writeBatch, getDoc, Timestamp } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { CSVLink } from 'react-csv';
import toast, { Toaster } from 'react-hot-toast'; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Defs, LinearGradient, Stop } from 'recharts'; // ✅ Added Defs, LinearGradient
import './Dashboard.css'; 
import AddTasks from './AddTasks';
import Profile from './Profile';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// Helper: Dynamic Greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

// ------------------------------------
//  COMPONENT: TEACHER ANALYTICS (Modern & Real Data)
// ------------------------------------
const TeacherAnalytics = ({ teacherInfo }) => {
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!teacherInfo?.instituteId) return;
            try {
                const res = await fetch(`${BACKEND_URL}/getAttendanceAnalytics`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        instituteId: teacherInfo.instituteId, 
                        subject: teacherInfo.subject 
                    })
                });
                const data = await res.json();
                
                // If backend returns empty or valid data, use it. 
                // Fallback to 0 values if empty to show empty chart instead of nothing.
                const processedData = data.chartData || [
                    { name: 'Sun', present: 0 }, { name: 'Mon', present: 0 }, 
                    { name: 'Tue', present: 0 }, { name: 'Wed', present: 0 }, 
                    { name: 'Thu', present: 0 }, { name: 'Fri', present: 0 }, 
                    { name: 'Sat', present: 0 }
                ];
                
                setChartData(processedData);
            } catch (e) { 
                console.error(e); 
                toast.error("Failed to load analytics");
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, [teacherInfo]);

    if (loading) return <div className="content-section"><p>Loading Charts...</p></div>;

    // Custom Tooltip for Chart
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ background: 'white', padding: '10px 15px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9' }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#1e293b', fontSize: '14px' }}>{label}</p>
                    <p style={{ margin: 0, color: '#3b82f6', fontSize: '13px' }}>Present: {payload[0].value}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Class Analytics</h2>
            <p className="content-subtitle">Performance trends for <strong>{teacherInfo.subject}</strong></p>

            <div className="cards-grid">
                {/* Weekly Trend Chart - Styled */}
                <div className="card" style={{height: '400px', padding:'25px', gridColumn: '1 / -1', overflow:'hidden'}}>
                     <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px'}}>
                        <div className="icon-box-modern" style={{background:'#e0f2fe', color:'#0284c7'}}>
                             <i className="fas fa-chart-bar"></i>
                        </div>
                        <h3 style={{margin:0, fontSize: '18px', color:'#0c4a6e'}}>Weekly Attendance Trend</h3>
                    </div>
                    
                    <ResponsiveContainer width="100%" height="85%">
                        <BarChart data={chartData} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                            <defs>
                                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.6}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#64748b', fontSize:12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill:'#64748b', fontSize:12}} />
                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                            <Bar dataKey="present" fill="url(#barGradient)" radius={[8, 8, 0, 0]} barSize={45} animationDuration={1500} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// ------------------------------------
//  DASHBOARD HOME (Live & Past - Restored Styles)
// ------------------------------------
const DashboardHome = ({ teacherInfo, activeSession, attendanceList, sessionError, onSessionToggle }) => {
    const [qrCodeValue, setQrCodeValue] = useState('');
    const [timer, setTimer] = useState(10);
    
    // View Toggle State
    const [viewMode, setViewMode] = useState('live'); 
    
    // History State
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [historyList, setHistoryList] = useState([]);
    const [historyStats, setHistoryStats] = useState({ present: 0, absent: 0, total: 0 });

    // 1. Live Session Logic
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

    // 2. Fetch Historical Data
    useEffect(() => {
        const fetchHistory = async () => {
            if (!teacherInfo?.instituteId) return;
            
            const start = new Date(selectedDate); start.setHours(0,0,0,0);
            const end = new Date(selectedDate); end.setHours(23,59,59,999);

            // Get Total Students (Approx for calculation)
            const qStudents = query(collection(db, 'users'), where('instituteId', '==', teacherInfo.instituteId), where('role', '==', 'student'));
            const studentsSnap = await getDocs(qStudents);
            const total = studentsSnap.size;

            // Get Present
            const q = query(
                collection(db, 'attendance'),
                where('instituteId', '==', teacherInfo.instituteId),
                where('subject', '==', teacherInfo.subject),
                where('timestamp', '>=', Timestamp.fromDate(start)),
                where('timestamp', '<=', Timestamp.fromDate(end))
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            setHistoryList(list);
            setHistoryStats({ total, present: list.length, absent: Math.max(0, total - list.length) });
        };
        
        if (viewMode === 'history') fetchHistory();
    }, [viewMode, selectedDate, teacherInfo]);

    return (
        <div className="content-section">
            <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap:'wrap', gap:'15px' }}>
                <div>
                    <h2 className="content-title">{getGreeting()}, {teacherInfo ? teacherInfo.firstName : 'Teacher'}!</h2>
                    <p className="content-subtitle">Manage your classroom activities.</p>
                </div>
                
                {/* ✅ Modern View Toggle */}
                <div style={{display:'flex', gap:'5px', background:'#fff', padding:'5px', borderRadius:'12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 5px rgba(0,0,0,0.02)'}}>
                    <button 
                        onClick={() => setViewMode('live')} 
                        style={{
                            padding:'8px 20px', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:'600', fontSize:'13px',
                            background: viewMode === 'live' ? '#eff6ff' : 'transparent',
                            color: viewMode === 'live' ? '#2563eb' : '#64748b',
                            transition: 'all 0.2s'
                        }}
                    >
                        Live Class
                    </button>
                    <button 
                        onClick={() => setViewMode('history')} 
                        style={{
                            padding:'8px 20px', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:'600', fontSize:'13px',
                            background: viewMode === 'history' ? '#eff6ff' : 'transparent',
                            color: viewMode === 'history' ? '#2563eb' : '#64748b',
                            transition: 'all 0.2s'
                        }}
                    >
                        Past Reports
                    </button>
                </div>
            </div>
            
            {/* --- VIEW 1: LIVE CLASS (Restored Gradient Cards) --- */}
            {viewMode === 'live' && (
                <div className="cards-grid">
                    {/* Session Control - Gradient Restored */}
                    <div className="card" style={{ 
                        background: activeSession ? 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)' : 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
                        border: activeSession ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                    }}>
                        <div>
                            <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px'}}>
                                <div className="icon-box-modern" style={{background: 'white', color: activeSession ? '#15803d' : '#1e40af'}}>
                                    <i className={`fas ${activeSession ? 'fa-broadcast-tower' : 'fa-play'}`}></i>
                                </div>
                                <div>
                                    <h3 style={{margin:0, color: activeSession ? '#14532d' : '#1e3a8a', fontSize: '18px', fontWeight: '700'}}>
                                        {activeSession ? 'Session Live' : 'Start Class'}
                                    </h3>
                                    {activeSession && <span className="status-badge-pill" style={{background:'white', color:'#15803d', fontSize:'10px', padding:'2px 8px', marginTop:'4px'}}>ACTIVE</span>}
                                </div>
                            </div>
                            <p style={{ color: activeSession ? '#166534' : '#1e40af', marginBottom: '20px', fontSize:'13px', opacity: 0.9 }}>
                                {activeSession ? `QR Code refreshes automatically in ${timer}s.` : "Start a secure QR session for today."}
                            </p>
                        </div>
                        <button 
                            onClick={onSessionToggle} 
                            className={activeSession ? "btn-modern-danger" : "btn-modern-primary"} 
                            disabled={!teacherInfo}
                            style={{ marginTop: 'auto', boxShadow: 'none' }} 
                        >
                            {activeSession ? 'End Session' : 'Start New Session'}
                        </button>
                    </div>

                    {/* Live Stats */}
                    <div className="card">
                        <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px'}}>
                            <div className="icon-box-modern" style={{background:'#fff7ed', color:'#ea580c'}}>
                                <i className="fas fa-users"></i>
                            </div>
                            <h3 style={{margin:0, fontSize: '18px'}}>Total Present</h3>
                        </div>
                        
                        {activeSession ? (
                            <div style={{marginTop: 'auto'}}>
                                <div style={{display:'flex', alignItems:'baseline', gap:'8px'}}>
                                    <span style={{fontSize:'56px', fontWeight:'800', color:'var(--text-primary)', lineHeight: '1'}}>
                                        {attendanceList.length}
                                    </span>
                                    <span style={{color:'var(--text-secondary)', fontSize:'16px', fontWeight:500}}>Students</span>
                                </div>
                            </div>
                        ) : (
                            <div style={{textAlign:'center', padding:'30px 0', opacity:0.5, marginTop:'auto'}}>
                                <i className="fas fa-clock" style={{fontSize:'24px', marginBottom:'10px'}}></i>
                                <p style={{margin:0, fontSize:'13px', fontStyle: 'italic'}}>Waiting for session...</p>
                            </div>
                        )}
                    </div>

                    {/* QR Code */}
                    {activeSession && (
                        <div className="card card-full-width" style={{textAlign:'center', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.06)'}}>
                            <div style={{marginBottom: '20px'}}>
                                <h3 style={{margin:0, color: '#1e293b'}}>Scan for Attendance</h3>
                                <p style={{color:'#64748b', fontSize:'13px'}}>Project this on the classroom screen</p>
                            </div>
                            <div className="qr-code-wrapper" style={{background: 'white', padding:'20px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(37,99,235,0.1)', display: 'inline-block'}}>
                                <QRCodeSVG value={qrCodeValue} size={220} />
                            </div>
                            <div style={{marginTop: '24px', maxWidth:'300px', marginInline:'auto'}}>
                                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px', fontSize:'12px', fontWeight:'600', color:'#64748b'}}>
                                    <span>Security Refreshes in </span>
                                    <span>{timer}s</span>
                                </div>
                                <div style={{width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow:'hidden'}}>
                                    <div style={{width: `${(timer/10)*100}%`, height: '100%', background: 'linear-gradient(90deg, #2563eb, #14b8a6)', transition: 'width 1s linear'}}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Attendance List */}
                     {activeSession && (
                         <div className="card card-full-width" style={{marginTop: '20px', padding:'0', overflow:'hidden'}}>
                            <div style={{padding:'20px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc'}}>
                                <h3 style={{margin:0, fontSize:'16px', fontWeight:'700', color:'#1e293b'}}>Live Student List</h3>
                                <span className="status-badge-pill" style={{background:'#dcfce7', color:'#15803d'}}>Live Updates</span>
                            </div>
                            
                            <div className="table-wrapper" style={{border:'none', borderRadius:0}}>
                                <table className="attendance-table">
                                    <thead style={{background:'white'}}>
                                        <tr>
                                            <th>Roll No.</th>
                                            <th>Name</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendanceList.map(s => (
                                            <tr key={s.id}>
                                                <td style={{fontWeight:'600', color:'#334155'}}>{s.rollNo}</td>
                                                <td style={{fontWeight:'500'}}>{s.firstName} {s.lastName}</td>
                                            </tr>
                                        ))}
                                        {attendanceList.length === 0 && (
                                            <tr><td colSpan="2" style={{textAlign:'center', padding:'40px', color:'var(--text-secondary)'}}>
                                                <i className="fas fa-spinner fa-spin" style={{marginRight:'8px'}}></i> Waiting for scans...
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- VIEW 2: PAST REPORTS (Improved UI) --- */}
            {viewMode === 'history' && (
                <div className="cards-grid">
                     {/* Date Picker Card */}
                    <div className="card card-full-width" style={{display:'flex', alignItems:'center', gap:'20px', padding:'20px', background:'#f8fafc'}}>
                        <div style={{flex:1}}>
                            <label style={{fontSize:'11px', fontWeight:'700', color:'#64748b', marginBottom:'6px', display:'block', textTransform:'uppercase', letterSpacing:'0.5px'}}>Select Date</label>
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{width:'100%', padding:'10px', border:'1px solid #cbd5e1', borderRadius:'8px', fontSize:'14px', fontWeight:'500', outline:'none'}}
                            />
                        </div>
                        <div style={{flex:2, paddingLeft:'20px', borderLeft:'2px solid #e2e8f0'}}>
                            <p style={{fontSize:'12px', color:'#64748b', margin:0, textTransform:'uppercase', letterSpacing:'0.5px'}}>Viewing Report for:</p>
                            <h3 style={{margin:'4px 0 0 0', fontSize:'20px', color:'#1e293b'}}>{new Date(selectedDate).toDateString()}</h3>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="card" style={{background:'#f0fdf4', borderLeft:'5px solid #10b981', padding:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div>
                                <span style={{fontSize:'11px', fontWeight:'800', color:'#166534', textTransform:'uppercase'}}>Present</span>
                                <h2 style={{margin:'5px 0 0 0', fontSize:'32px', color:'#14532d'}}>{historyStats.present}</h2>
                            </div>
                            <div className="icon-box-modern" style={{background:'rgba(255,255,255,0.5)', color:'#15803d'}}><i className="fas fa-check-circle"></i></div>
                        </div>
                    </div>

                    <div className="card" style={{background:'#fef2f2', borderLeft:'5px solid #ef4444', padding:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div>
                                <span style={{fontSize:'11px', fontWeight:'800', color:'#991b1b', textTransform:'uppercase'}}>Absent</span>
                                <h2 style={{margin:'5px 0 0 0', fontSize:'32px', color:'#7f1d1d'}}>{historyStats.absent}</h2>
                            </div>
                             <div className="icon-box-modern" style={{background:'rgba(255,255,255,0.5)', color:'#dc2626'}}><i className="fas fa-times-circle"></i></div>
                        </div>
                    </div>

                    <div className="card" style={{background:'#eff6ff', borderLeft:'5px solid #3b82f6', padding:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div>
                                <span style={{fontSize:'11px', fontWeight:'800', color:'#1e40af', textTransform:'uppercase'}}>Total</span>
                                <h2 style={{margin:'5px 0 0 0', fontSize:'32px', color:'#1e3a8a'}}>{historyStats.total}</h2>
                            </div>
                             <div className="icon-box-modern" style={{background:'rgba(255,255,255,0.5)', color:'#2563eb'}}><i className="fas fa-users"></i></div>
                        </div>
                    </div>

                    {/* Detailed List */}
                    <div className="card card-full-width" style={{marginTop:'10px'}}>
                        <div style={{padding:'20px', borderBottom:'1px solid #f1f5f9'}}>
                            <h3 style={{margin:0, fontSize:'18px', color:'#1e293b'}}>Attendance List</h3>
                        </div>
                        <div className="table-wrapper" style={{border:'none'}}>
                            <table className="attendance-table">
                                <thead style={{background:'#f8fafc'}}>
                                    <tr>
                                        <th>Roll No</th>
                                        <th>Name</th>
                                        <th>Time In</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyList.map(item => (
                                        <tr key={item.id}>
                                            <td style={{fontWeight:'bold', color:'#334155'}}>{item.rollNo}</td>
                                            <td>{item.firstName} {item.lastName}</td>
                                            <td style={{color:'#64748b'}}>{item.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                            <td><span className="status-badge status-approved">Present</span></td>
                                        </tr>
                                    ))}
                                    {historyList.length === 0 && (
                                        <tr><td colSpan="4" style={{textAlign:'center', padding:'40px', color:'#94a3b8', fontStyle:'italic'}}>
                                            No records found for this date.
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
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
  const [sessionError, setSessionError] = useState('');
  const navigate = useNavigate();

  const playSessionStartSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3');
    audio.play().catch(error => console.log("Audio play failed:", error));
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => { if (doc.exists()) setTeacherInfo(doc.data()); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'live_sessions'), where('teacherId', '==', auth.currentUser.uid), where('isActive', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => setActiveSession(!snap.empty ? { sessionId: snap.docs[0].id, ...snap.docs[0].data() } : null));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeSession) {
        const q = query(collection(db, 'attendance'), where('sessionId', '==', activeSession.sessionId));
        const unsubscribe = onSnapshot(q, (snap) => setAttendanceList(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => unsubscribe();
    } else setAttendanceList([]);
  }, [activeSession]);

  const handleSession = async () => {
    if (activeSession) {
        const toastId = toast.loading("Ending Session...");
        try {
            await fetch(`${BACKEND_URL}/endSession`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: activeSession.sessionId })
            });
            toast.success("Session Ended", { id: toastId });
        } catch (e) { toast.error("Error: " + e.message, { id: toastId }); }
    } else {
        if (!teacherInfo?.instituteId) return toast.error("Institute ID missing.");
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const q = query(collection(db, "live_sessions"), where("isActive", "==", true), where("instituteId", "==", teacherInfo.instituteId));
                const existing = await getDocs(q);
                const batch = writeBatch(db);
                existing.forEach(d => batch.update(d.ref, { isActive: false }));
                await batch.commit();
                
                const newRef = doc(collection(db, 'live_sessions'));
                await setDoc(newRef, {
                    sessionId: newRef.id, 
                    teacherId: auth.currentUser.uid, 
                    teacherName: teacherInfo.firstName, 
                    subject: teacherInfo.subject, 
                    createdAt: serverTimestamp(), 
                    isActive: true, 
                    location: { latitude: pos.coords.latitude, longitude: pos.coords.longitude }, 
                    instituteId: teacherInfo.instituteId,
                    department: teacherInfo.department 
                });
                
                playSessionStartSound();
                toast.success("Session Started Successfully!", { duration: 3000 });
            }, (err) => { toast.error("Location required."); setSessionError('Location required.'); });
        } else { toast.error("Geolocation not supported."); }
    }
  };

  const handleLogout = async () => { await signOut(auth); navigate('/'); };
  
  const renderContent = () => {
    if(!teacherInfo) return <div style={{textAlign: 'center', marginTop: '50px'}}>Loading...</div>;
    switch (activePage) {
        case 'dashboard': return <DashboardHome teacherInfo={teacherInfo} activeSession={activeSession} attendanceList={attendanceList} sessionError={sessionError} onSessionToggle={handleSession} />;
        case 'analytics': return <TeacherAnalytics teacherInfo={teacherInfo} />; // ✅ New Tab
        case 'addTasks': return <AddTasks />;
        case 'profile': return <Profile user={teacherInfo} />;
        default: return <DashboardHome teacherInfo={teacherInfo} activeSession={activeSession} attendanceList={attendanceList} sessionError={sessionError} onSessionToggle={handleSession} />;
    }
  };

  const csvHeaders = [ { label: "Roll No.", key: "rollNo" }, { label: "First Name", key: "firstName" }, { label: "Last Name", key: "lastName" }, { label: "Email", key: "studentEmail" } ];
  const NavLink = ({ page, iconClass, label }) => ( <li className={activePage === page ? 'active' : ''} onClick={() => {setActivePage(page); setIsMobileNavOpen(false);}} style={{display:'flex', alignItems:'center', gap:'12px'}}><i className={`fas ${iconClass}`} style={{width:'20px', textAlign:'center'}}></i> <span>{label}</span></li> );
  
  return (
    <div className="dashboard-container">
      <Toaster position="top-center" />
      {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)}></div>}
      <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`}>
        <div className="logo-container"><img src="https://iili.io/KoAVeZg.md.png" alt="AcadeX Logo" className="sidebar-logo"/><span className="logo-text">Acadex</span></div>
        {teacherInfo && ( <div className="teacher-info" onClick={() => { setActivePage('profile'); setIsMobileNavOpen(false); }} style={{cursor:'pointer'}}><h4>{teacherInfo.firstName} {teacherInfo.lastName}</h4><p>{teacherInfo.subject}</p><div className="edit-profile-pill"><i className="fas fa-pen" style={{fontSize:'10px'}}></i><span>Edit Profile</span></div></div> )}
        <ul className="menu">
            <NavLink page="dashboard" iconClass="fa-th-large" label="Dashboard" />
            <NavLink page="analytics" iconClass="fa-chart-bar" label="Analytics" />
            <NavLink page="addTasks" iconClass="fa-tasks" label="Add Tasks" />
            <li onClick={() => setIsMobileNavOpen(false)} style={{marginTop: 'auto', marginBottom: '10px'}}>
                <CSVLink data={attendanceList} headers={csvHeaders} filename={`attendance-${activeSession ? activeSession.subject : 'export'}.csv`} className="csv-link" style={{display:'flex', alignItems:'center', gap:'12px'}}><i className="fas fa-file-download" style={{width:'20px', textAlign:'center'}}></i><span>Download Sheet</span></CSVLink>
            </li>
        </ul>
        <div className="sidebar-footer"><button onClick={handleLogout} className="logout-btn"><i className="fas fa-sign-out-alt"></i><span>Logout</span></button></div>
      </aside>
      <main className="main-content">
        <header className="mobile-header"><button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}><i className="fas fa-bars"></i></button><div className="mobile-brand"><img src="https://iili.io/KoAVeZg.md.png" alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">AcadeX</span></div><div style={{width:'40px'}}></div></header>
        {renderContent()}
      </main>
    </div>
  );
}