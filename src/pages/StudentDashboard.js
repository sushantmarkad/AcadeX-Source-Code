import React, { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Leaderboard from './Leaderboard';
import './Dashboard.css';

// Component Imports
import FreePeriodTasks from './FreePeriodTasks';
import Profile from './Profile';
import AiChatbot from './AiChatbot';
import CareerRoadmap from './CareerRoadmap'; // ✅ Import Roadmap

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// --- HELPER: Time Logic ---
const getCurrentTimeMinutes = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
};

const getMinutesFromTime = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

// --- COMPONENT: Smart Schedule Card ---
const SmartScheduleCard = ({ user, onOpenAI }) => {
    const [currentSlot, setCurrentSlot] = useState(null);
    const [statusMessage, setStatusMessage] = useState("Loading schedule...");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSchedule = async () => {
            if (!user?.department || !user?.year) {
                setStatusMessage("Complete your profile (Year/Dept) to see schedule.");
                setLoading(false);
                return;
            }

            // 1. Auto-Detect Semester
            let sem = user.semester;
            if (!sem) {
                if (user.year === 'FE') sem = '1'; 
                else if (user.year === 'SE') sem = '3';
                else if (user.year === 'TE') sem = '5';
                else if (user.year === 'BE') sem = '7';
            }

            // 2. Get Today's Day
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const today = days[new Date().getDay()];

            if (today === 'Sunday') {
                setCurrentSlot({ type: 'Holiday', subject: 'Weekend! Relax or Grind.' });
                setLoading(false);
                return;
            }

            // 3. Fetch Timetable
            const docId = `${user.department}_Sem${sem}_${today}`;
            
            try {
                const docRef = doc(db, 'timetables', docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const slots = docSnap.data().slots;
                    const nowMinutes = getCurrentTimeMinutes();
                    
                    const activeSlot = slots.find(slot => {
                        const start = getMinutesFromTime(slot.startTime);
                        const end = getMinutesFromTime(slot.endTime);
                        return nowMinutes >= start && nowMinutes < end;
                    });

                    if (activeSlot) {
                        setCurrentSlot(activeSlot);
                    } else {
                        setCurrentSlot({ type: 'Free', subject: 'No active class right now.' });
                    }
                } else {
                    setCurrentSlot(null);
                    setStatusMessage(`No timetable found for ${today}.`);
                }
            } catch (error) {
                console.error("Timetable Error:", error);
                setStatusMessage("Error loading schedule.");
            } finally {
                setLoading(false);
            }
        };
        
        fetchSchedule();
    }, [user]);

    if (loading) return <div className="card" style={{padding:'20px', textAlign:'center', color:'#64748b'}}>{statusMessage}</div>;

    if (!currentSlot) return (
        <div className="card" style={{padding:'20px', textAlign:'center'}}>
            <h3 style={{margin:0, color:'#64748b'}}>No Schedule</h3>
            <p style={{margin:'5px 0 0 0', fontSize:'13px', color:'#94a3b8'}}>{statusMessage}</p>
        </div>
    );

    const isFree = currentSlot?.type === 'Free' || currentSlot?.type === 'Break' || currentSlot?.type === 'Holiday';
    
    return (
        <div className="card" style={{
            borderLeft: isFree ? '5px solid #10b981' : '5px solid #3b82f6',
            background: isFree ? 'linear-gradient(to right, #ecfdf5, white)' : 'white'
        }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                    <h4 style={{margin:0, color: isFree ? '#059669' : '#2563eb', fontSize:'12px', textTransform:'uppercase', letterSpacing:'1px', fontWeight:'bold'}}>
                        {isFree ? "🟢 RIGHT NOW" : "🔴 LIVE CLASS"}
                    </h4>
                    <h2 style={{margin:'5px 0 0 0', fontSize:'20px', color: '#1e293b', fontWeight:'700'}}>
                        {currentSlot?.subject || "Free Period"}
                    </h2>
                    <p style={{margin:'4px 0 0 0', fontSize:'13px', color:'#64748b'}}>
                        {currentSlot?.startTime ? `${currentSlot.startTime} - ${currentSlot.endTime}` : "Enjoy your free time!"}
                    </p>
                </div>
                
                {isFree && (
                    <button 
                        onClick={onOpenAI}
                        className="btn-primary" 
                        style={{
                            width:'auto', padding:'10px 16px', fontSize:'13px', 
                            background:'linear-gradient(135deg, #10b981, #059669)', 
                            boxShadow:'0 4px 12px rgba(16,185,129,0.3)',
                            marginTop: 0
                        }}
                    >
                        <i className="fas fa-robot" style={{marginRight:'8px'}}></i>
                        Get Task
                    </button>
                )}
            </div>
        </div>
    );
};

// ------------------------------
//  DASHBOARD HOME
// ------------------------------
const DashboardHome = ({ user, onOpenAI }) => {
    const [liveSession, setLiveSession] = useState(null);
    const [scanMessage, setScanMessage] = useState({ type: '', text: '' });
    const [showScanner, setShowScanner] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [recentAttendance, setRecentAttendance] = useState([]);
    const [attendanceLoading, setAttendanceLoading] = useState(true);

    const hasScannedRef = useRef(false);
    const scannerRef = useRef(null);

    // Listen for active sessions
    useEffect(() => {
        if (!user?.instituteId) return;
        const q = query(collection(db, "live_sessions"), where("isActive", "==", true), where("instituteId", "==", user.instituteId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLiveSession(!snapshot.empty ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } : null);
        });
        return () => unsubscribe();
    }, [user]);

    // Fetch Recent Attendance
    useEffect(() => {
        if (!auth.currentUser) return;
        setAttendanceLoading(true);
        const q = query(collection(db, "attendance"), where("studentId", "==", auth.currentUser.uid), orderBy("timestamp", "desc"), limit(3));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const history = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    subject: data.subject || 'Class',
                    timestamp: data.timestamp ? data.timestamp.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today',
                    status: data.status || 'Present'
                };
            });
            setRecentAttendance(history);
            setAttendanceLoading(false);
        }, (error) => {
            console.error("Error fetching history:", error);
            setAttendanceLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    // Scanner Logic
    useEffect(() => {
        let scannerInstance;
        if (showScanner) {
            hasScannedRef.current = false;
            scannerInstance = new Html5QrcodeScanner("qr-reader", { fps: 5, qrbox: { width: 250, height: 250 } }, false);
            scannerInstance.render((decodedText) => {
                if (!hasScannedRef.current) {
                    hasScannedRef.current = true;
                    if (scannerInstance?.getState() !== 2) { scannerInstance.clear().catch(() => {}); }
                    setShowScanner(false);
                    handleScan(decodedText);
                }
            }, () => {});
            scannerRef.current = scannerInstance;
        }
        return () => { if (scannerRef.current) scannerRef.current.clear().catch(() => {}); };
    }, [showScanner]);
    
    const handleScan = (sessionId) => {
        setIsProcessing(true);
        setScanMessage({ type: 'info', text: 'Getting location...' });
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const token = await auth.currentUser.getIdToken();
                const response = await fetch(`${BACKEND_URL}/markAttendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ sessionId, studentLocation: { latitude: position.coords.latitude, longitude: position.coords.longitude } })
                });
                const data = await response.json();
                setScanMessage({ type: response.ok ? 'success' : 'error', text: data.message || data.error });
            } catch (error) { setScanMessage({ type: 'error', text: error.message }); } 
            finally { setIsProcessing(false); }
        }, () => {
            setScanMessage({ type: 'error', text: 'Location permission required.' });
            setIsProcessing(false);
        });
    };

    return (
        <div className="content-section">
            <div style={{ marginBottom: '25px' }}>
                <h2 className="content-title">Welcome, {user.firstName}!</h2>
                <p className="content-subtitle">Your academic dashboard.</p>
            </div>

            <div className="cards-grid">
                {/* 1. Smart Schedule */}
                <SmartScheduleCard user={user} onOpenAI={onOpenAI} />

                {/* 2. Live Attendance */}
                <div className="card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                        <div className="icon-box-modern"><i className="fas fa-qrcode"></i></div>
                        <h3 style={{ margin: 0, color: '#1e3a8a', fontWeight:'700' }}>Live Attendance</h3>
                    </div>
                    {liveSession ? (
                        <>
                            <div className="live-badge pulsate"><div className="dot"></div> <span>SESSION ACTIVE</span></div>
                            <div style={{ marginBottom: '20px' }}>
                                <p style={{ fontSize: '20px', fontWeight: '800', color: '#1e1b4b', margin: '0 0 5px 0' }}>{liveSession.subject || 'Class'}</p>
                                <p style={{ color: '#4c1d95', margin: 0, fontSize:'14px' }}><i className="fas fa-chalkboard-teacher" style={{marginRight:'6px'}}></i> {liveSession.teacherName}</p>
                            </div>
                            <button className="btn-modern-primary" onClick={() => setShowScanner(true)}>Scan Now</button>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '15px 0', color: '#64748b' }}>
                            <p style={{fontWeight:500, margin:0}}>No active sessions</p>
                            <small>Relax! Class hasn't started yet.</small>
                        </div>
                    )}
                    {scanMessage.text && <div className={`scan-message ${scanMessage.type}`} style={{ marginTop: '15px' }}>{scanMessage.text}</div>}
                </div>
                
                {/* Scanner Overlay */}
                {showScanner && <div className="card scanner-card"><div id="qr-reader" style={{ width: '100%' }}></div><button className="btn-secondary" onClick={() => setShowScanner(false)}>Cancel</button></div>}

                {/* 3. Recent History */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                         <div className="icon-box-modern" style={{background:'#f3f4f6', color:'#374151'}}><i className="fas fa-history"></i></div>
                        <h3 style={{ margin: 0 }}>Recent History</h3>
                    </div>
                    {attendanceLoading ? <p>Loading...</p> : (
                        <div className="recent-attendance-list">
                            {recentAttendance.map(item => (
                                <div key={item.id} className="history-card">
                                    <div className="history-left">
                                        <div className="history-icon"><i className="fas fa-check"></i></div>
                                        <div><p className="history-subject">{item.subject}</p><p className="history-date">{item.timestamp}</p></div>
                                    </div>
                                    <div className="status-badge-pill">Present</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Placeholders
const Goals = () => <div>My Goals (Coming Soon)</div>;
const Coding = () => <div>Coding Practice (Coming Soon)</div>;

// ------------------------------
//  MAIN COMPONENT
// ------------------------------
export default function StudentDashboard() {
  const [activePage, setActivePage] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false); // ✅ Controls AI Chat

  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
        if (!auth.currentUser) return;
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (snap.exists()) setUser(snap.data());
    };
    loadUser();
  }, []);

  const handleLogout = async () => { await signOut(auth); navigate('/'); };

  const renderContent = () => {
    if (!user) return <div style={{ textAlign: 'center', paddingTop: 50 }}>Loading...</div>;
    switch (activePage) {
      case 'dashboard': return <DashboardHome user={user} onOpenAI={() => setIsChatOpen(true)} />;
      case 'tasks': return <FreePeriodTasks user={user} />;
      case 'profile': return <Profile user={user} />;
      case 'goals': return <Goals />;
      // ✅ CONNECTED ROADMAP HERE
      case 'plans': return <CareerRoadmap user={user} />; 
      case 'leaderboard': return <Leaderboard user={user} />;
      case 'coding': return <Coding />;
      default: return <DashboardHome user={user} onOpenAI={() => setIsChatOpen(true)} />;
    }
  };

  const NavLink = ({ page, iconClass, label }) => (
    <li className={activePage === page ? 'active' : ''} onClick={() => {setActivePage(page); setIsMobileNavOpen(false);}}>
        <i className={`fas ${iconClass}`} style={{ width: '24px', textAlign: 'center' }}></i><span>{label}</span>
    </li>
  );

  return (
    <div className="dashboard-container">
      {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)} />}
      
      <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`}>
        <div className="logo-container"><img src="https://iili.io/KoAVeZg.md.png" alt="AcadeX" className="sidebar-logo"/><span className="logo-text">Acadex</span></div>
        {user && (
            <div className="teacher-info" onClick={() => { setActivePage('profile'); setIsMobileNavOpen(false); }} style={{ cursor: 'pointer' }}>
                <h4>{user.firstName} {user.lastName}</h4>
                <p>Roll No: {user.rollNo}</p>
                
                {/* ✅ DISPLAY XP & BADGES */}
                <p style={{fontSize:'14px', color:'#059669', fontWeight:'700', margin:'4px 0'}}>
                    {user.xp || 0} XP
                    {user.badges && user.badges.length > 0 && (
                        <span style={{marginLeft: '8px', fontSize:'16px'}}>
                            {user.badges.includes('master') && '👑'}
                            {user.badges.includes('expert') && '💎'}
                            {user.badges.includes('enthusiast') && '🔥'}
                            {user.badges.includes('novice') && '🌱'}
                        </span>
                    )}
                </p>

                {user.year && <p style={{fontSize:'13px', color:'#2563eb', fontWeight:'600', marginTop:'2px', marginBottom: '8px'}}>Class: {user.year}</p>}
                <div className="edit-profile-pill">
                    <i className="fas fa-pen" style={{fontSize:'10px'}}></i>
                    <span>Edit Profile</span>
                </div>
            </div>
        )}
        <ul className="menu">
            <NavLink page="dashboard" iconClass="fa-home" label="Dashboard" />
            <NavLink page="tasks" iconClass="fa-check-circle" label="Free Period Tasks" />
            <NavLink page="goals" iconClass="fa-bullseye" label="My Goals" />
            <NavLink page="plans" iconClass="fa-paper-plane" label="Future Plans" />
            <NavLink page="leaderboard" iconClass="fa-trophy" label="Leaderboard" />
            <NavLink page="coding" iconClass="fa-code" label="Coding Practice" />
        </ul>
        <div className="sidebar-footer"><button onClick={handleLogout} className="logout-btn"><i className="fas fa-sign-out-alt"></i> <span>Logout</span></button></div>
      </aside>

      <main className="main-content">
        <header className="mobile-header">
            <button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}><i className="fas fa-bars"></i></button>
            <div className="mobile-brand"><img src="https://iili.io/KoAVeZg.md.png" alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">AcadeX</span></div>
            <div style={{width:'40px'}}></div>
        </header>
        
        {renderContent()}

        {/* ✅ AI CHATBOT OVERLAY */}
        {user && <AiChatbot user={user} isOpenProp={isChatOpen} onClose={() => setIsChatOpen(false)} />}
      </main>
    </div>
  );
}