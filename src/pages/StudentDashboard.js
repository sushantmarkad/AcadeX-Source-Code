import React, { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { Html5QrcodeScanner } from 'html5-qrcode';
import toast, { Toaster } from 'react-hot-toast';
import './Dashboard.css';

// Component Imports
import FreePeriodTasks from './FreePeriodTasks';
import Profile from './Profile';
import AiChatbot from './AiChatbot';
import CareerRoadmap from './CareerRoadmap';
import Leaderboard from './Leaderboard';

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

// --- COMPONENT: Leave Request Form ---
const LeaveRequestForm = ({ user }) => {
    const [form, setForm] = useState({ reason: '', fromDate: '', toDate: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const toastId = toast.loading("Sending Request...");

        try {
            await fetch(`${BACKEND_URL}/requestLeave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    uid: user.uid, 
                    name: `${user.firstName} ${user.lastName}`, 
                    rollNo: user.rollNo, 
                    department: user.department,
                    instituteId: user.instituteId,
                    ...form 
                })
            });
            toast.success("Request sent to HOD!", { id: toastId });
            setForm({ reason: '', fromDate: '', toDate: '' });
        } catch (err) { toast.error("Failed to send.", { id: toastId }); }
        finally { setLoading(false); }
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Request Leave</h2>
            <div className="card">
                <form onSubmit={handleSubmit}>
                    <div className="input-group"><label>Reason</label><input type="text" required value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="e.g. Sick Leave" /></div>
                    <div style={{display:'flex', gap:'15px'}}>
                        <div className="input-group" style={{flex:1}}><label>From</label><input type="date" required value={form.fromDate} onChange={e => setForm({...form, fromDate: e.target.value})} /></div>
                        <div className="input-group" style={{flex:1}}><label>To</label><input type="date" required value={form.toDate} onChange={e => setForm({...form, toDate: e.target.value})} /></div>
                    </div>
                    <button className="btn-primary" disabled={loading}>{loading ? 'Sending...' : 'Submit Request'}</button>
                </form>
            </div>
        </div>
    );
};

// --- COMPONENT: Smart Schedule Card ---
const SmartScheduleCard = ({ user, onOpenAI }) => {
    const [currentSlot, setCurrentSlot] = useState(null);
    const [statusMessage, setStatusMessage] = useState("Loading schedule...");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSchedule = async () => {
            if (!user?.department || !user?.year) {
                setStatusMessage("Update profile (Year/Dept) to see schedule.");
                setLoading(false);
                return;
            }

            let sem = user.semester || (user.year === 'FE' ? '1' : user.year === 'SE' ? '3' : user.year === 'TE' ? '5' : '7');
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const today = days[new Date().getDay()];

            if (today === 'Sunday') {
                setCurrentSlot({ type: 'Holiday', subject: 'Weekend! Relax.' });
                setLoading(false);
                return;
            }

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
                console.error(error);
                setStatusMessage("Error loading schedule.");
            } finally {
                setLoading(false);
            }
        };
        
        fetchSchedule();
        const interval = setInterval(fetchSchedule, 60000); 
        return () => clearInterval(interval);
    }, [user]);

    // Smart Nudge Toast
    useEffect(() => {
        if (currentSlot?.type === 'Free') {
            toast("🎉 It's a Free Period! Check your Tasks.", {
                icon: '☕', duration: 6000,
                style: { border: '1px solid #10b981', background: '#ecfdf5', color: '#064e3b' }
            });
        }
    }, [currentSlot?.type]);

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
                    <h4 style={{margin:0, color: isFree ? '#059669' : '#2563eb', fontSize:'12px', textTransform:'uppercase', fontWeight:'bold'}}>
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
                    <button onClick={onOpenAI} className="btn-primary" style={{width:'auto', padding:'10px 16px', fontSize:'13px', marginTop: 0}}>
                        <i className="fas fa-robot" style={{marginRight:'8px'}}></i> Get Task
                    </button>
                )}
            </div>
        </div>
    );
};

const DashboardHome = ({ user, onOpenAI }) => {
    const [liveSession, setLiveSession] = useState(null);
    const [showScanner, setShowScanner] = useState(false);
    const [recentAttendance, setRecentAttendance] = useState([]);

    useEffect(() => {
        if (!user?.instituteId) return;
        const q = query(collection(db, "live_sessions"), where("isActive", "==", true), where("instituteId", "==", user.instituteId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLiveSession(!snapshot.empty ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } : null);
        });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, "attendance"), where("studentId", "==", auth.currentUser.uid), orderBy("timestamp", "desc"), limit(3));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRecentAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp?.toDate().toLocaleDateString() })));
        });
        return () => unsubscribe();
    }, [user]);

    // ✅ 75% Attendance Alert
    useEffect(() => {
        const totalClasses = 50; // Ideally fetch from DB or Institute config
        const attended = user?.attendanceCount || 0;
        const percentage = (attended / totalClasses) * 100;
        if (percentage < 75 && percentage > 0) {
            toast((t) => (
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <span style={{fontSize:'24px'}}>⚠️</span>
                    <div><b>Low Attendance!</b><p style={{fontSize:'12px', margin:0}}>You are at {percentage.toFixed(1)}%. Target: 75%.</p></div>
                </div>
            ), { duration: 6000, style: { border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e' } });
        }
    }, [user]);

    const handleScan = (sessionId) => {
        toast.loading("Verifying...");
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const token = await auth.currentUser.getIdToken();
                const response = await fetch(`${BACKEND_URL}/markAttendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ sessionId, studentLocation: { latitude: position.coords.latitude, longitude: position.coords.longitude } })
                });
                const data = await response.json();
                toast.dismiss();
                if (response.ok) toast.success(data.message);
                else toast.error(data.error);
                setShowScanner(false);
            } catch (error) { toast.error(error.message); }
        });
    };

    useEffect(() => {
        let scanner;
        if (showScanner) {
            scanner = new Html5QrcodeScanner("qr-reader", { fps: 5, qrbox: { width: 250, height: 250 } });
            scanner.render((text) => { scanner.clear(); handleScan(text); }, console.warn);
        }
        return () => scanner?.clear();
    }, [showScanner]);

    return (
        <div className="content-section">
            <div style={{ marginBottom: '25px' }}>
                <h2 className="content-title">Welcome, {user.firstName}!</h2>
                <p className="content-subtitle">Your academic dashboard.</p>
            </div>

            <div className="cards-grid">
                <SmartScheduleCard user={user} onOpenAI={onOpenAI} />
                
                <div className="card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                        <div className="icon-box-modern"><i className="fas fa-qrcode"></i></div>
                        <h3 style={{ margin: 0, color: '#1e3a8a', fontWeight:'700' }}>Live Attendance</h3>
                    </div>
                    {liveSession ? (
                        <>
                            <div className="live-badge pulsate"><div className="dot"></div> <span>SESSION ACTIVE</span></div>
                            <p style={{fontWeight:'bold', margin:'10px 0'}}>{liveSession.subject}</p>
                            <button className="btn-modern-primary" onClick={() => setShowScanner(true)}>Scan Now</button>
                        </>
                    ) : <p style={{textAlign:'center', color:'#64748b'}}>No active sessions.</p>}
                </div>
                
                {showScanner && <div className="card scanner-card"><div id="qr-reader"></div><button className="btn-secondary" onClick={() => setShowScanner(false)}>Cancel</button></div>}

                <div className="card">
                    <h3>Recent History</h3>
                    <div className="recent-attendance-list">
                        {recentAttendance.map(item => (
                            <div key={item.id} className="history-card">
                                <div><p className="history-subject">{item.subject}</p><p className="history-date">{item.timestamp}</p></div>
                                <div className="status-badge-pill">Present</div>
                            </div>
                        ))}
                    </div>
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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (doc) => setUser(doc.data()));
    return () => unsub();
  }, []);

  const handleLogout = async () => { await signOut(auth); navigate('/'); };

  const renderContent = () => {
    if (!user) return <div style={{ textAlign: 'center', paddingTop: 50 }}>Loading...</div>;
    switch (activePage) {
      case 'dashboard': return <DashboardHome user={user} onOpenAI={() => setIsChatOpen(true)} />;
      case 'tasks': return <FreePeriodTasks user={user} />;
      case 'profile': return <Profile user={user} />;
      case 'plans': return <CareerRoadmap user={user} />; 
      case 'leaderboard': return <Leaderboard user={user} />;
      case 'leave': return <LeaveRequestForm user={user} />; // ✅ New
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
      <Toaster position="top-center" />
      {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)} />}
      
      <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`}>
        <div className="logo-container"><img src="https://iili.io/KoAVeZg.md.png" alt="AcadeX" className="sidebar-logo"/><span className="logo-text">Acadex</span></div>
        {user && (
            <div className="teacher-info" onClick={() => { setActivePage('profile'); setIsMobileNavOpen(false); }} style={{ cursor: 'pointer' }}>
                <h4>{user.firstName} {user.lastName}</h4>
                <p>Roll No: {user.rollNo}</p>
                <p style={{fontSize:'14px', color:'#059669', fontWeight:'700', margin:'4px 0'}}>
                    {user.xp || 0} XP 
                    {user.badges?.map(b => <span key={b} style={{marginLeft:'4px'}}>{b === 'novice' ? '🌱' : '🔥'}</span>)}
                </p>
                {user.year && <p style={{fontSize:'13px', color:'#2563eb', fontWeight:'600'}}>Class: {user.year}</p>}
            </div>
        )}
        <ul className="menu">
            <NavLink page="dashboard" iconClass="fa-home" label="Dashboard" />
            <NavLink page="tasks" iconClass="fa-check-circle" label="Free Period Tasks" />
            <NavLink page="leaderboard" iconClass="fa-trophy" label="Leaderboard" />
            <NavLink page="plans" iconClass="fa-paper-plane" label="Future Plans" />
            <NavLink page="leave" iconClass="fa-calendar-minus" label="Apply Leave" /> {/* ✅ New */}
            <NavLink page="profile" iconClass="fa-user" label="Profile" />
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
        {user && <AiChatbot user={user} isOpenProp={isChatOpen} onClose={() => setIsChatOpen(false)} />}
      </main>
    </div>
  );
}