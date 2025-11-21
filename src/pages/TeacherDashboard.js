import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase'; 
import { collection, doc, setDoc, serverTimestamp, onSnapshot, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { CSVLink } from 'react-csv';
import './Dashboard.css'; 
import AddTasks from './AddTasks';
import Profile from './Profile';

// Helper: Dynamic Greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

// ------------------------------------
//  DASHBOARD HOME (Fixed Layout)
// ------------------------------------
const DashboardHome = ({ teacherInfo, activeSession, attendanceList, sessionError, onSessionToggle }) => {
    // Dynamic QR State
    const [qrCodeValue, setQrCodeValue] = useState('');
    const [timer, setTimer] = useState(10);

    useEffect(() => {
        let interval;
        if (activeSession) {
            setQrCodeValue(`${activeSession.sessionId}|${Date.now()}`);
            interval = setInterval(() => {
                setQrCodeValue(`${activeSession.sessionId}|${Date.now()}`);
                setTimer(10);
            }, 10000);
        }
        return () => clearInterval(interval);
    }, [activeSession]);

    useEffect(() => {
        let countdown;
        if (activeSession) {
            countdown = setInterval(() => setTimer(p => p > 0 ? p - 1 : 0), 1000);
        }
        return () => clearInterval(countdown);
    }, [activeSession]);

    return (
        <div className="content-section">
            {/* 1. Header Section */}
            <div style={{ marginBottom: '24px' }}>
                <h2 className="content-title">{getGreeting()}, {teacherInfo ? teacherInfo.firstName : 'Teacher'}!</h2>
                <p className="content-subtitle">Manage your classroom activities.</p>
            </div>
            
            <div className="cards-grid">
                {/* 2. Session Control Card - FIXED SPACING */}
                <div className="card" style={{ 
                    background: activeSession 
                        ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' 
                        : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    border: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px'}}>
                            <div className="icon-box-modern" style={{background: 'white', color: activeSession ? '#15803d' : '#1e40af'}}>
                                <i className={`fas ${activeSession ? 'fa-broadcast-tower' : 'fa-play'}`}></i>
                            </div>
                            <div>
                                <h3 style={{margin:0, color: activeSession ? '#14532d' : '#1e3a8a', fontWeight:'700', fontSize: '18px'}}>
                                    {activeSession ? 'Session Live' : 'Start Class'}
                                </h3>
                                {activeSession && <span style={{fontSize:'12px', color:'#166534', fontWeight:'600'}}>Active Now</span>}
                            </div>
                        </div>
                        
                        <p style={{ color: activeSession ? '#166534' : '#1e40af', marginBottom: '20px', fontSize:'14px', lineHeight: '1.5' }}>
                            {activeSession 
                                ? `Attendance running. Code refreshes in ${timer}s.` 
                                : "Create a secure QR code session for today's attendance."}
                        </p>
                    </div>

                    {/* Styled Button (Now uses btn-modern-danger correctly) */}
                    <button 
                        onClick={onSessionToggle} 
                        className={activeSession ? "btn-modern-danger" : "btn-modern-primary"} 
                        disabled={!teacherInfo}
                        style={{ marginTop: 'auto' }} 
                    >
                        {activeSession ? 'End Session' : 'Start New Session'}
                    </button>
                    
                    {sessionError && <p className="error-message" style={{marginTop:'10px'}}>{sessionError}</p>}
                </div>

                {/* 3. Stats Card - CLEANER LAYOUT */}
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
                        <div style={{textAlign:'center', padding:'20px 0', opacity:0.6, marginTop:'auto'}}>
                            <p style={{margin:0, fontSize:'14px', fontStyle: 'italic'}}>Waiting for session...</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 4. QR Code Section - FIXED CENTERING */}
            {activeSession && (
                <div className="card card-full-width" style={{marginTop: '24px', textAlign:'center', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.06)'}}>
                    <div style={{marginBottom: '24px'}}>
                        <h3 style={{margin:0, color: 'var(--tech-dark)', fontSize: '20px'}}>Scan for Attendance</h3>
                        <p style={{margin:'4px 0 0 0', color:'var(--text-secondary)', fontSize:'14px'}}>Project this QR code on the screen</p>
                    </div>
                    
                    <div className="qr-container">
                        <div className="qr-code-wrapper" style={{
                            background: 'white', 
                            padding:'20px', 
                            borderRadius: '16px', 
                            boxShadow: '0 10px 25px rgba(37,99,235,0.1)',
                            display: 'inline-block'
                        }}>
                            <QRCodeSVG value={qrCodeValue} size={250} />
                        </div>
                        
                        <div style={{marginTop: '24px', maxWidth:'300px', marginInline:'auto'}}>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px', fontSize:'13px', fontWeight:'600', color:'#64748b'}}>
                                <span>Security Refresh</span>
                                <span>{timer}s</span>
                            </div>
                            <div style={{width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow:'hidden'}}>
                                <div style={{width: `${(timer/10)*100}%`, height: '100%', background: 'linear-gradient(90deg, #2563eb, #14b8a6)', transition: 'width 1s linear'}}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Attendance List Table */}
             {activeSession && (
                 <div className="card card-full-width" style={{marginTop: '24px', padding:'0', overflow:'hidden'}}>
                    <div style={{padding:'20px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc'}}>
                        <h3 style={{margin:0, fontSize:'16px', fontWeight:'700'}}>Live Student List</h3>
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
    );
};

// ------------------------------------
//  TEACHER DASHBOARD WRAPPER
// ------------------------------------
export default function TeacherDashboard() {
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [attendanceList, setAttendanceList] = useState([]);
  const [sessionError, setSessionError] = useState('');
  const navigate = useNavigate();

  // 1. Fetch Teacher Profile
  useEffect(() => {
    if (!auth.currentUser) return;
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => { if (doc.exists()) setTeacherInfo(doc.data()); });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Active Session
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'live_sessions'), where('teacherId', '==', auth.currentUser.uid), where('isActive', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => setActiveSession(!snap.empty ? { sessionId: snap.docs[0].id, ...snap.docs[0].data() } : null));
    return () => unsubscribe();
  }, [teacherInfo]);

  // 3. Fetch Attendance List
  useEffect(() => {
    if (activeSession) {
        const q = query(collection(db, 'attendance'), where('sessionId', '==', activeSession.sessionId));
        const unsubscribe = onSnapshot(q, (snap) => setAttendanceList(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => unsubscribe();
    } else setAttendanceList([]);
  }, [activeSession]);

  // 4. Handle Session Toggle
  const handleSession = async () => {
    if (activeSession) {
        await setDoc(doc(db, 'live_sessions', activeSession.sessionId), { isActive: false }, { merge: true });
    } else {
        if (!teacherInfo?.instituteId) return setSessionError("Institute ID missing.");
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const q = query(collection(db, "live_sessions"), where("isActive", "==", true), where("instituteId", "==", teacherInfo.instituteId));
            const existing = await getDocs(q);
            const batch = writeBatch(db);
            existing.forEach(d => batch.update(d.ref, { isActive: false }));
            await batch.commit();
            const newRef = doc(collection(db, 'live_sessions'));
            await setDoc(newRef, {
                sessionId: newRef.id, teacherId: auth.currentUser.uid, teacherName: teacherInfo.firstName, subject: teacherInfo.subject, createdAt: serverTimestamp(), isActive: true, location: { latitude: pos.coords.latitude, longitude: pos.coords.longitude }, instituteId: teacherInfo.instituteId
            });
        }, (err) => setSessionError('Location required.'));
    }
  };

  const handleLogout = async () => { await signOut(auth); navigate('/'); };
  
  const renderContent = () => {
    if(!teacherInfo) return <div style={{textAlign: 'center', marginTop: '50px'}}>Loading...</div>;
    switch (activePage) {
        case 'dashboard': return <DashboardHome teacherInfo={teacherInfo} activeSession={activeSession} attendanceList={attendanceList} sessionError={sessionError} onSessionToggle={handleSession} />;
        case 'addTasks': return <AddTasks />;
        case 'profile': return <Profile user={teacherInfo} />;
        default: return <DashboardHome teacherInfo={teacherInfo} activeSession={activeSession} attendanceList={attendanceList} sessionError={sessionError} onSessionToggle={handleSession} />;
    }
  };

  const csvHeaders = [
    { label: "Roll No.", key: "rollNo" },
    { label: "First Name", key: "firstName" },
    { label: "Last Name", key: "lastName" },
    { label: "Email", key: "studentEmail" }
  ];

  const NavLink = ({ page, iconClass, label }) => (
      <li 
        className={activePage === page ? 'active' : ''} 
        onClick={() => {setActivePage(page); setIsMobileNavOpen(false);}}
        style={{display:'flex', alignItems:'center', gap:'12px'}}
      >
          <i className={`fas ${iconClass}`} style={{width:'20px', textAlign:'center'}}></i> 
          <span>{label}</span>
      </li>
  );
  
  return (
    <div className="dashboard-container">
      {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)}></div>}
      <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`}>
        <div className="logo-container">
            <img src="https://iili.io/KoAVeZg.md.png" alt="AcadeX Logo" className="sidebar-logo"/>
            <span className="logo-text">Acadex</span>
        </div>
        
        {teacherInfo && (
            <div className="teacher-info" onClick={() => { setActivePage('profile'); setIsMobileNavOpen(false); }} style={{cursor:'pointer'}}>
                <h4>{teacherInfo.firstName} {teacherInfo.lastName}</h4>
                <p>{teacherInfo.subject}</p>
                {/* ✅ NEW: Modern Pill Button */}
                <div className="edit-profile-pill">
                    <i className="fas fa-pen" style={{fontSize:'10px'}}></i>
                    <span>Edit Profile</span>
                </div>
            </div>
        )}
        
        <ul className="menu">
            <NavLink page="dashboard" iconClass="fa-th-large" label="Dashboard" />
            <NavLink page="addTasks" iconClass="fa-tasks" label="Add Tasks" />
            
            <li onClick={() => setIsMobileNavOpen(false)} style={{marginTop: 'auto', marginBottom: '10px'}}>
                <CSVLink data={attendanceList} headers={csvHeaders} filename={`attendance-${activeSession ? activeSession.subject : 'export'}-${new Date().toLocaleDateString()}.csv`} className="csv-link" style={{display:'flex', alignItems:'center', gap:'12px'}}>
                    <i className="fas fa-file-download" style={{width:'20px', textAlign:'center'}}></i>
                    <span>Download Sheet</span>
                </CSVLink>
            </li>
        </ul>
        <div className="sidebar-footer">
            <button onClick={handleLogout} className="logout-btn">
                <i className="fas fa-sign-out-alt"></i>
                <span>Logout</span>
            </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="mobile-header">
            <button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}>
                <i className="fas fa-bars"></i>
            </button>
            <div className="mobile-brand">
                <img src="https://iili.io/KoAVeZg.md.png" alt="Logo" className="mobile-logo-img" />
                <span className="mobile-logo-text">AcadeX</span>
            </div>
            <div style={{width:'40px'}}></div>
        </header>
        {renderContent()}
      </main>
    </div>
  );
}