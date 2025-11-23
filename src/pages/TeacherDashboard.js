import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase'; 
import { collection, doc, setDoc, serverTimestamp, onSnapshot, query, where, getDocs, writeBatch, getDoc, Timestamp } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { CSVLink } from 'react-csv';
import toast, { Toaster } from 'react-hot-toast'; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'; 
import './Dashboard.css'; 
import AddTasks from './AddTasks';
import Profile from './Profile';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// Helper: Greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

// ------------------------------------
//  COMPONENT: TEACHER ANALYTICS (New)
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
                if (data.chartData) setChartData(data.chartData);
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

    return (
        <div className="content-section">
            <h2 className="content-title">Class Analytics</h2>
            <p className="content-subtitle">Performance trends for <strong>{teacherInfo.subject}</strong></p>

            <div className="cards-grid">
                {/* Weekly Trend Chart */}
                <div className="card" style={{height: '400px', padding:'25px', gridColumn: '1 / -1'}}>
                     <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px'}}>
                        <div className="icon-box-modern" style={{background:'#e0f2fe', color:'#0284c7'}}>
                             <i className="fas fa-chart-bar"></i>
                        </div>
                        <h3 style={{margin:0, fontSize: '18px', color:'#0c4a6e'}}>Weekly Attendance Trend</h3>
                    </div>
                    
                    <ResponsiveContainer width="100%" height="85%">
                        <BarChart data={chartData} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#64748b', fontSize:12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill:'#64748b', fontSize:12}} />
                            <Tooltip 
                                cursor={{fill: '#f8fafc'}} 
                                contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 30px rgba(0,0,0,0.1)'}} 
                            />
                            <Bar dataKey="present" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} animationDuration={1000}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`url(#colorGradient-${index})`} />
                                ))}
                            </Bar>
                            <defs>
                                <linearGradient id="colorGradient-0" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.8}/>
                                </linearGradient>
                            </defs>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// ------------------------------------
//  DASHBOARD HOME (Live & Past)
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
                
                {/* ✅ View Toggle */}
                <div className="view-toggle">
                    <button onClick={() => setViewMode('live')} className={viewMode === 'live' ? 'active' : ''}>Live Class</button>
                    <button onClick={() => setViewMode('history')} className={viewMode === 'history' ? 'active' : ''}>Past Reports</button>
                </div>
            </div>
            
            {/* --- VIEW 1: LIVE CLASS --- */}
            {viewMode === 'live' && (
                <div className="cards-grid">
                    {/* Session Control */}
                    <div className="card" style={{ 
                        background: activeSession ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                        border: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                    }}>
                        <div>
                            <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px'}}>
                                <div className="icon-box-modern" style={{background: 'white', color: activeSession ? '#15803d' : '#1e40af'}}>
                                    <i className={`fas ${activeSession ? 'fa-broadcast-tower' : 'fa-play'}`}></i>
                                </div>
                                <div>
                                    <h3 style={{margin:0, color: activeSession ? '#14532d' : '#1e3a8a', fontSize: '18px'}}>{activeSession ? 'Session Live' : 'Start Class'}</h3>
                                    {activeSession && <span className="status-badge-pill" style={{background:'white', color:'#15803d', fontSize:'10px', padding:'2px 8px', marginTop:'4px'}}>ACTIVE</span>}
                                </div>
                            </div>
                            <p style={{ color: activeSession ? '#166534' : '#1e40af', marginBottom: '20px', fontSize:'13px' }}>
                                {activeSession ? `Code refreshes in ${timer}s.` : "Create secure QR session."}
                            </p>
                        </div>
                        <button 
                            onClick={onSessionToggle} 
                            className={activeSession ? "btn-modern-danger" : "btn-modern-primary"} 
                            disabled={!teacherInfo}
                            style={{ marginTop: 'auto' }} 
                        >
                            {activeSession ? 'End Session' : 'Start New Session'}
                        </button>
                    </div>

                    {/* Live Stats */}
                    <div className="card">
                         <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px'}}>
                            <div className="icon-box-modern" style={{background:'#fff7ed', color:'#ea580c'}}><i className="fas fa-users"></i></div>
                            <h3 style={{margin:0, fontSize: '18px'}}>Total Present</h3>
                        </div>
                        {activeSession ? (
                            <div style={{marginTop: 'auto'}}>
                                <div style={{display:'flex', alignItems:'baseline', gap:'8px'}}>
                                    <span style={{fontSize:'56px', fontWeight:'800', color:'#1e293b'}}>{attendanceList.length}</span>
                                    <span style={{color:'#64748b', fontSize:'16px', fontWeight:500}}>Students</span>
                                </div>
                            </div>
                        ) : (
                            <div style={{textAlign:'center', padding:'20px 0', opacity:0.6, marginTop:'auto'}}>
                                <p style={{margin:0, fontSize:'14px', fontStyle: 'italic'}}>Waiting for session...</p>
                            </div>
                        )}
                    </div>

                    {/* QR Code */}
                    {activeSession && (
                        <div className="card card-full-width" style={{textAlign:'center', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.06)'}}>
                            <div className="qr-code-wrapper" style={{background: 'white', padding:'20px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(37,99,235,0.1)', display: 'inline-block'}}>
                                <QRCodeSVG value={qrCodeValue} size={250} />
                            </div>
                            <div style={{marginTop: '24px', maxWidth:'300px', marginInline:'auto'}}>
                                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px', fontSize:'13px', fontWeight:'600', color:'#64748b'}}>
                                    <span>Security Refresh</span><span>{timer}s</span>
                                </div>
                                <div style={{width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow:'hidden'}}>
                                    <div style={{width: `${(timer/10)*100}%`, height: '100%', background: 'linear-gradient(90deg, #2563eb, #14b8a6)', transition: 'width 1s linear'}}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* List */}
                     {activeSession && (
                         <div className="card card-full-width" style={{marginTop: '10px', padding:'0', overflow:'hidden'}}>
                            <div style={{padding:'20px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc'}}>
                                <h3 style={{margin:0, fontSize:'16px', fontWeight:'700'}}>Live Student List</h3>
                                <span className="status-badge-pill" style={{background:'#dcfce7', color:'#15803d'}}>Live</span>
                            </div>
                            <div className="table-wrapper" style={{border:'none', borderRadius:0}}>
                                <table className="attendance-table">
                                    <thead style={{background:'white'}}><tr><th>Roll No.</th><th>Name</th></tr></thead>
                                    <tbody>
                                        {attendanceList.map(s => (<tr key={s.id}><td style={{fontWeight:'600', color:'#334155'}}>{s.rollNo}</td><td>{s.firstName} {s.lastName}</td></tr>))}
                                        {attendanceList.length === 0 && <tr><td colSpan="2" style={{textAlign:'center', padding:'40px', color:'#94a3b8'}}>Waiting for scans...</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- VIEW 2: PAST REPORTS (✅ Redesigned) --- */}
            {viewMode === 'history' && (
                <div className="cards-grid">
                     {/* Date Picker Card */}
                    <div className="card card-full-width" style={{display:'flex', alignItems:'center', gap:'20px', padding:'20px', background:'#f8fafc'}}>
                        <div style={{flex:1}}>
                            <label style={{fontSize:'12px', fontWeight:'700', color:'#64748b', marginBottom:'6px', display:'block', textTransform:'uppercase'}}>Select Date</label>
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{width:'100%', padding:'12px', border:'1px solid #cbd5e1', borderRadius:'10px', fontSize:'15px', fontWeight:'500'}}
                            />
                        </div>
                        <div style={{flex:2, paddingLeft:'20px', borderLeft:'1px solid #e2e8f0'}}>
                            <p style={{fontSize:'13px', color:'#64748b', margin:0}}>Report for:</p>
                            <h3 style={{margin:'4px 0 0 0', fontSize:'22px', color:'#1e293b'}}>{new Date(selectedDate).toDateString()}</h3>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="card" style={{background:'#f0fdf4', borderLeft:'5px solid #10b981', padding:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div>
                                <span style={{fontSize:'12px', fontWeight:'bold', color:'#166534', textTransform:'uppercase'}}>Present</span>
                                <h2 style={{margin:'5px 0 0 0', fontSize:'32px', color:'#14532d'}}>{historyStats.present}</h2>
                            </div>
                            <div className="icon-box-modern" style={{background:'rgba(255,255,255,0.5)', color:'#15803d'}}><i className="fas fa-check-circle"></i></div>
                        </div>
                    </div>

                    <div className="card" style={{background:'#fef2f2', borderLeft:'5px solid #ef4444', padding:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div>
                                <span style={{fontSize:'12px', fontWeight:'bold', color:'#991b1b', textTransform:'uppercase'}}>Absent</span>
                                <h2 style={{margin:'5px 0 0 0', fontSize:'32px', color:'#7f1d1d'}}>{historyStats.absent}</h2>
                            </div>
                             <div className="icon-box-modern" style={{background:'rgba(255,255,255,0.5)', color:'#dc2626'}}><i className="fas fa-times-circle"></i></div>
                        </div>
                    </div>

                    <div className="card" style={{background:'#eff6ff', borderLeft:'5px solid #3b82f6', padding:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div>
                                <span style={{fontSize:'12px', fontWeight:'bold', color:'#1e40af', textTransform:'uppercase'}}>Total</span>
                                <h2 style={{margin:'5px 0 0 0', fontSize:'32px', color:'#1e3a8a'}}>{historyStats.total}</h2>
                            </div>
                             <div className="icon-box-modern" style={{background:'rgba(255,255,255,0.5)', color:'#2563eb'}}><i className="fas fa-users"></i></div>
                        </div>
                    </div>

                    {/* Detailed List */}
                    <div className="card card-full-width" style={{marginTop:'10px'}}>
                        <div style={{padding:'20px', borderBottom:'1px solid #f1f5f9'}}>
                            <h3 style={{margin:0, fontSize:'18px'}}>Detailed List</h3>
                        </div>
                        <div className="table-wrapper" style={{border:'none'}}>
                            <table className="attendance-table">
                                <thead><tr><th>Roll No</th><th>Name</th><th>Time In</th><th>Status</th></tr></thead>
                                <tbody>
                                    {historyList.map(item => (
                                        <tr key={item.id}>
                                            <td style={{fontWeight:'bold', color:'#334155'}}>{item.rollNo}</td>
                                            <td>{item.firstName} {item.lastName}</td>
                                            <td>{item.timestamp?.toDate().toLocaleTimeString()}</td>
                                            <td><span className="status-badge status-approved">Present</span></td>
                                        </tr>
                                    ))}
                                    {historyList.length === 0 && <tr><td colSpan="4" style={{textAlign:'center', padding:'30px', color:'#94a3b8', fontStyle:'italic'}}>No attendance records found for this date.</td></tr>}
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

  // 1. Sound Effect
  const playSessionStartSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3');
    audio.play().catch(error => console.log("Audio play failed:", error));
  };

  // 2. Fetch Teacher Profile
  useEffect(() => {
    if (!auth.currentUser) return;
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => { if (doc.exists()) setTeacherInfo(doc.data()); });
    return () => unsubscribe();
  }, []);

  // 3. Fetch Active Session
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'live_sessions'), where('teacherId', '==', auth.currentUser.uid), where('isActive', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => setActiveSession(!snap.empty ? { sessionId: snap.docs[0].id, ...snap.docs[0].data() } : null));
    return () => unsubscribe();
  }, []);

  // 4. Fetch Attendance List
  useEffect(() => {
    if (activeSession) {
        const q = query(collection(db, 'attendance'), where('sessionId', '==', activeSession.sessionId));
        const unsubscribe = onSnapshot(q, (snap) => setAttendanceList(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => unsubscribe();
    } else setAttendanceList([]);
  }, [activeSession]);

  // 5. Handle Session
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
        case 'analytics': return <TeacherAnalytics teacherInfo={teacherInfo} />; // ✅ Integrated
        case 'addTasks': return <AddTasks />;
        case 'profile': return <Profile user={teacherInfo} />;
        default: return <DashboardHome teacherInfo={teacherInfo} activeSession={activeSession} attendanceList={attendanceList} sessionError={sessionError} onSessionToggle={handleSession} />;
    }
  };

  const csvHeaders = [ { label: "Roll No.", key: "rollNo" }, { label: "First Name", key: "firstName" }, { label: "Last Name", key: "lastName" }, { label: "Email", key: "studentEmail" } ];

  const NavLink = ({ page, iconClass, label }) => (
      <li className={activePage === page ? 'active' : ''} onClick={() => {setActivePage(page); setIsMobileNavOpen(false);}} style={{display:'flex', alignItems:'center', gap:'12px'}}>
          <i className={`fas ${iconClass}`} style={{width:'20px', textAlign:'center'}}></i> <span>{label}</span>
      </li>
  );
  
  return (
    <div className="dashboard-container">
      <Toaster position="top-center" reverseOrder={false} />
      {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)}></div>}
      
      <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`}>
        <div className="logo-container"><img src="https://iili.io/KoAVeZg.md.png" alt="Logo" className="sidebar-logo"/><span className="logo-text">Acadex</span></div>
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