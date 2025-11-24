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

// --- COMPONENT: Leave Request Form & History ---
const LeaveRequestForm = ({ user }) => {
    const [form, setForm] = useState({ reason: '', fromDate: '', toDate: '' });
    const [loading, setLoading] = useState(false);
    const [myLeaves, setMyLeaves] = useState([]);

    // 1. Real-Time Listener for Leave History
    useEffect(() => {
        if (!user.uid) return;

        const q = query(
            collection(db, 'leave_requests'),
            where('studentId', '==', user.uid)
            // Note: orderBy requires an index. If it crashes, remove orderBy or create the index in Firebase Console.
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const leavesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Sort locally to avoid index issues for now (Newest first)
            leavesData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            
            setMyLeaves(leavesData);

            // ✅ SMART NOTIFICATION: Check for updates
            snapshot.docChanges().forEach((change) => {
                if (change.type === "modified") {
                    const newData = change.doc.data();
                    if (newData.status === 'approved') {
                        toast.success(`🎉 Your leave for "${newData.reason}" was Approved!`, {
                            duration: 6000,
                            style: { border: '1px solid #10b981', background: '#ecfdf5', color: '#064e3b' }
                        });
                    } else if (newData.status === 'rejected') {
                        toast.error(`Your leave for "${newData.reason}" was Rejected.`, { duration: 5000 });
                    }
                }
            });
        });

        return () => unsubscribe();
    }, [user.uid]);

    // 2. Submit Request
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
            {/* REQUEST FORM */}
            <h2 className="content-title">Request Leave</h2>
            <div className="card" style={{marginBottom: '30px'}}>
                <form onSubmit={handleSubmit}>
                    <div className="input-group"><label>Reason</label><input type="text" required value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="e.g. Sick Leave" /></div>
                    <div style={{display:'flex', gap:'15px'}}>
                        <div className="input-group" style={{flex:1}}><label>From</label><input type="date" required value={form.fromDate} onChange={e => setForm({...form, fromDate: e.target.value})} /></div>
                        <div className="input-group" style={{flex:1}}><label>To</label><input type="date" required value={form.toDate} onChange={e => setForm({...form, toDate: e.target.value})} /></div>
                    </div>
                    <button className="btn-primary" disabled={loading}>{loading ? 'Sending...' : 'Submit Request'}</button>
                </form>
            </div>

            {/* ✅ LEAVE HISTORY LIST */}
            <h3 style={{color:'#1e293b', margin:'0 0 15px 0', fontSize:'18px'}}>My Leave History</h3>
            
            <div className="cards-grid">
                {myLeaves.length > 0 ? (
                    myLeaves.map(leave => (
                        <div key={leave.id} className="card" style={{
                            borderLeft: `5px solid ${leave.status === 'approved' ? '#10b981' : leave.status === 'rejected' ? '#ef4444' : '#f59e0b'}`,
                            position: 'relative', padding: '15px'
                        }}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'start'}}>
                                <div>
                                    <h4 style={{margin:'0 0 5px 0', fontSize:'16px'}}>{leave.reason}</h4>
                                    <p style={{margin:0, fontSize:'13px', color:'#64748b'}}>
                                        {new Date(leave.fromDate).toLocaleDateString()} ➔ {new Date(leave.toDate).toLocaleDateString()}
                                    </p>
                                </div>
                                <span className={`status-badge status-${leave.status}`} style={{textTransform: 'uppercase', fontSize:'11px', letterSpacing:'0.5px'}}>
                                    {leave.status}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="card" style={{textAlign:'center', padding:'30px', color:'#94a3b8', fontStyle:'italic'}}>
                        No leave history found.
                    </div>
                )}
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
    const [stats, setStats] = useState({ totalClasses: 0, attended: 0 });

    // Fetch Stats
    useEffect(() => {
        if (!user?.instituteId || !user?.department) return;
        const fetchStats = async () => {
            const statsDoc = await getDoc(doc(db, "department_stats", `${user.instituteId}_${user.department}`));
            const total = statsDoc.exists() ? statsDoc.data().totalClasses : 0;
            const attended = user.attendanceCount || 0;
            setStats({ totalClasses: total, attended });
        };
        fetchStats();
    }, [user]);

    // Listen for active sessions
    useEffect(() => {
        if (!user?.instituteId) return;
        const q = query(collection(db, "live_sessions"), where("isActive", "==", true), where("instituteId", "==", user.instituteId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLiveSession(!snapshot.empty ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } : null);
        });
        return () => unsubscribe();
    }, [user]);

    // Recent Attendance
    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, "attendance"), where("studentId", "==", auth.currentUser.uid), orderBy("timestamp", "desc"), limit(3));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRecentAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp?.toDate().toLocaleDateString() })));
        });
        return () => unsubscribe();
    }, [user]);

    // 75% Attendance Alert
    useEffect(() => {
        const totalClasses = stats.totalClasses || 50; 
        const attended = user?.attendanceCount || 0;
        const percentage = totalClasses > 0 ? (attended / totalClasses) * 100 : 100;
        
        if (percentage < 75 && percentage > 0) {
            toast((t) => (
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <span style={{fontSize:'24px'}}>⚠️</span>
                    <div><b>Low Attendance!</b><p style={{fontSize:'12px', margin:0}}>You are at {percentage.toFixed(1)}%. Target: 75%.</p></div>
                </div>
            ), { duration: 6000, style: { border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e' } });
        }
    }, [user, stats]);

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

    const percentage = stats.totalClasses > 0 ? Math.round((stats.attended / stats.totalClasses) * 100) : 100;
    const isLow = percentage < 75;

    return (
        <div className="content-section">
            <div style={{ marginBottom: '25px' }}>
                <h2 className="content-title">Welcome, {user.firstName}!</h2>
                <p className="content-subtitle">Your academic dashboard.</p>
            </div>

            <div className="cards-grid">
                <SmartScheduleCard user={user} onOpenAI={onOpenAI} />
                
                {/* 1. ATTENDANCE PROGRESS */}
                <div className="card" style={{ background: isLow ? '#fef2f2' : '#f0fdf4', borderLeft: `5px solid ${isLow ? '#ef4444' : '#10b981'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0, color: '#1e293b', fontSize: '16px' }}>Attendance</h3>
                        <span style={{ fontWeight: '800', fontSize: '18px', color: isLow ? '#dc2626' : '#059669' }}>{percentage}%</span>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: 'rgba(0,0,0,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ width: `${percentage}%`, height: '100%', background: isLow ? '#ef4444' : '#10b981', transition: 'width 0.5s' }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px', color: '#64748b' }}>
                        <span>Attended: <strong>{stats.attended}</strong> / {stats.totalClasses}</span>
                        <span style={{ color: isLow ? '#b91c1c' : '#15803d', fontWeight: '600' }}>
                            {isLow ? "⚠️ Low" : "🎉 Good Job!"}
                        </span>
                    </div>
                </div>

                {/* 2. LIVE ATTENDANCE */}
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

                {/* 3. RECENT HISTORY */}
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

export default function StudentDashboard() {
  const [activePage, setActivePage] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const navigate = useNavigate();

  // Real-time User Listener
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
      case 'leave': return <LeaveRequestForm user={user} />;
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
                    {user.badges?.map(b => <span key={b} style={{marginLeft:'4px'}}>{b === 'novice' ? '🌱' : b === 'enthusiast' ? '🔥' : b === 'expert' ? '💎' : '👑'}</span>)}
                </p>
                {user.year && <p style={{fontSize:'13px', color:'#2563eb', fontWeight:'600', margin:'2px 0'}}>Class: {user.year}</p>}
            </div>
        )}
        <ul className="menu">
            <NavLink page="dashboard" iconClass="fa-home" label="Dashboard" />
            <NavLink page="tasks" iconClass="fa-check-circle" label="Free Period Tasks" />
            <NavLink page="leaderboard" iconClass="fa-trophy" label="Leaderboard" />
            <NavLink page="plans" iconClass="fa-paper-plane" label="Future Plans" />
            <NavLink page="leave" iconClass="fa-calendar-minus" label="Apply Leave" />
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