import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom'; // ✅ Required for Portal
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode';
import toast, { Toaster } from 'react-hot-toast';
import logo from "../assets/logo.png";
import './Dashboard.css';

// Component Imports
import FreePeriodTasks from './FreePeriodTasks';
import Profile from './Profile';
import AiChatbot from './AiChatbot';
import CareerRoadmap from './CareerRoadmap';
import Leaderboard from './Leaderboard';
import FreePeriodQuiz from '../components/FreePeriodQuiz';

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

// --- HELPER: Relative Time ---
const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
};

// --- COMPONENT: Leave Request Form ---
const LeaveRequestForm = ({ user }) => {
    const [form, setForm] = useState({ reason: '', fromDate: '', toDate: '' });
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [myLeaves, setMyLeaves] = useState([]);

    useEffect(() => {
        if (!user.uid) return;
        const q = query(collection(db, 'leave_requests'), where('studentId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const leavesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            leavesData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setMyLeaves(leavesData);
        });
        return () => unsubscribe();
    }, [user.uid]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        // ✅ Toast loading with ID to update later
        const toastId = toast.loading("Uploading & Sending...");

        try {
            const formData = new FormData();
            formData.append('uid', user.uid);
            formData.append('name', `${user.firstName} ${user.lastName}`);
            formData.append('rollNo', user.rollNo);
            formData.append('department', user.department);
            formData.append('instituteId', user.instituteId);
            formData.append('reason', form.reason);
            formData.append('fromDate', form.fromDate);
            formData.append('toDate', form.toDate);
            
            if (file) formData.append('document', file);

            const res = await fetch(`${BACKEND_URL}/requestLeave`, {
                method: 'POST',
                body: formData 
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // ✅ Update existing toast to success
            toast.success("Request sent to HOD!", { id: toastId });
            
            setForm({ reason: '', fromDate: '', toDate: '' });
            setFile(null);
        } catch (err) { 
            // ✅ Update existing toast to error
            toast.error(err.message, { id: toastId }); 
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Request Leave</h2>
            <div className="card" style={{marginBottom: '30px'}}>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Reason</label>
                        <input type="text" required value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="e.g. Medical Leave" />
                    </div>
                    
                    <div style={{display:'flex', gap:'15px', flexWrap:'wrap'}}>
                        <div className="input-group" style={{flex:1}}>
                            <label>From</label>
                            <input type="date" required value={form.fromDate} onChange={e => setForm({...form, fromDate: e.target.value})} />
                        </div>
                        <div className="input-group" style={{flex:1}}>
                            <label>To</label>
                            <input type="date" required value={form.toDate} onChange={e => setForm({...form, toDate: e.target.value})} />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Attach Proof (Optional)</label>
                        <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0])} style={{padding:'10px', background:'#f8fafc'}} />
                        <small style={{color:'#64748b'}}>Upload medical certificate or letter (Max 5MB)</small>
                    </div>

                    <button className="btn-primary" disabled={loading}>
                        {loading ? 'Sending...' : 'Submit Request'}
                    </button>
                </form>
            </div>

            <h3 style={{color:'#1e293b', margin:'0 0 15px 0', fontSize:'18px'}}>My Leave History</h3>
            <div className="cards-grid">
                {myLeaves.length > 0 ? (
                    myLeaves.map(leave => (
                        <div key={leave.id} className="card" style={{borderLeft: `5px solid ${leave.status === 'approved' ? '#10b981' : leave.status === 'rejected' ? '#ef4444' : '#f59e0b'}`, padding: '15px'}}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'start'}}>
                                <div>
                                    <h4 style={{margin:'0 0 5px 0', fontSize:'16px'}}>{leave.reason}</h4>
                                    <p style={{margin:0, fontSize:'13px', color:'#64748b'}}>
                                        {new Date(leave.fromDate).toLocaleDateString()} ➔ {new Date(leave.toDate).toLocaleDateString()}
                                    </p>
                                    {leave.documentUrl && (
                                        <a href={leave.documentUrl} target="_blank" rel="noreferrer" style={{display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'12px', color:'#2563eb', marginTop:'8px', textDecoration:'none', background:'#eff6ff', padding:'4px 8px', borderRadius:'6px'}}>
                                            <i className="fas fa-paperclip"></i> View Proof
                                        </a>
                                    )}
                                </div>
                                <span className={`status-badge status-${leave.status}`} style={{textTransform: 'uppercase', fontSize:'11px', letterSpacing:'0.5px'}}>{leave.status}</span>
                            </div>
                        </div>
                    ))
                ) : <div className="card" style={{textAlign:'center', padding:'30px', color:'#94a3b8', fontStyle:'italic'}}>No leave history found.</div>}
            </div>
        </div>
    );
};

// --- COMPONENT: Notices View ---
const NoticesView = ({ notices }) => {
    return (
        <div className="content-section">
            <h2 className="content-title">Notice Board</h2>
            <p className="content-subtitle">Stay updated with the latest announcements.</p>
            <div className="notice-list">
                {notices.length > 0 ? notices.map((n, index) => {
                    const isNew = (new Date() - (n.createdAt?.toDate ? n.createdAt.toDate() : new Date())) / (1000 * 60 * 60) < 24;
                    return (
                        <div key={n.id} className="notice-card" style={{animationDelay: `${index * 0.1}s`}}>
                            <div className="notice-icon-box"><i className="fas fa-bullhorn"></i></div>
                            <div className="notice-content">
                                <div className="notice-header">
                                    <h3 className="notice-title">{n.title}{isNew && <span className="badge-new">NEW</span>}</h3>
                                    <span className="notice-time">{getRelativeTime(n.createdAt)}</span>
                                </div>
                                <p className="notice-body">{n.message}</p>
                                <div className="notice-footer">
                                    <span className="notice-dept-badge">{n.department || 'General'}</span>
                                    {n.targetYear !== 'All' && <span className="notice-year-badge">{n.targetYear}</span>}
                                </div>
                            </div>
                        </div>
                    );
                }) : <div className="empty-state-card"><div className="empty-icon"><i className="fas fa-inbox"></i></div><h3>No Announcements</h3><p>You're all caught up!</p></div>}
            </div>
        </div>
    );
};

// --- COMPONENT: Smart Schedule Card ---
const SmartScheduleCard = ({ user }) => {
    const [currentSlot, setCurrentSlot] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSchedule = async () => {
            if (!user?.department || !user?.year) { setLoading(false); return; }
            let sem = user.semester || (user.year === 'FE' ? '1' : user.year === 'SE' ? '3' : user.year === 'TE' ? '5' : '7');
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const today = days[new Date().getDay()];
            if (today === 'Sunday') { setCurrentSlot({ type: 'Holiday', subject: 'Weekend! Relax.' }); setLoading(false); return; }
            try {
                const docSnap = await getDoc(doc(db, 'timetables', `${user.department}_Sem${sem}_${today}`));
                if (docSnap.exists()) {
                    const slots = docSnap.data().slots;
                    const now = getCurrentTimeMinutes();
                    const activeSlot = slots.find(slot => {
                        const start = getMinutesFromTime(slot.startTime);
                        const end = getMinutesFromTime(slot.endTime);
                        return now >= start && now < end;
                    });
                    setCurrentSlot(activeSlot || { type: 'Free', subject: 'No active class right now.' });
                } else { setCurrentSlot(null); }
            } catch (error) { console.error(error); } finally { setLoading(false); }
        };
        fetchSchedule();
        const interval = setInterval(fetchSchedule, 60000); 
        return () => clearInterval(interval);
    }, [user]);

    const isFree = currentSlot?.type === 'Free' || currentSlot?.type === 'Break' || currentSlot?.type === 'Holiday';
    if (loading) return <div className="card" style={{padding:'20px', textAlign:'center'}}>Loading...</div>;

    return (
        <>
            <div className="card" style={{borderLeft: isFree ? '5px solid #10b981' : '5px solid #3b82f6', background: isFree ? 'linear-gradient(to right, #ecfdf5, white)' : 'white'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                        <h4 style={{margin:0, color: isFree ? '#059669' : '#2563eb', fontSize:'12px', fontWeight:'bold'}}>{isFree ? "🟢 RIGHT NOW" : "🔴 LIVE CLASS"}</h4>
                        <h2 style={{margin:'5px 0 0 0', fontSize:'20px', color: '#1e293b', fontWeight:'700'}}>{currentSlot?.subject || "Free Period"}</h2>
                        <p style={{margin:'4px 0 0 0', fontSize:'13px', color:'#64748b'}}>{currentSlot?.startTime ? `${currentSlot.startTime} - ${currentSlot.endTime}` : "Enjoy your free time!"}</p>
                    </div>
                </div>
            </div>
            {isFree && <FreePeriodQuiz user={user} isFree={isFree} />}
        </>
    );
};

// --- COMPONENT: Attendance Overview ---
const AttendanceOverview = ({ user }) => {
    const [percentage, setPercentage] = useState(0);
    const [totalClasses, setTotalClasses] = useState(0);
    const [attendedClasses, setAttendedClasses] = useState(0);

    useEffect(() => {
        const fetchStats = async () => {
            if (!user?.instituteId || !user?.department) return;
            try {
                const statsDoc = await getDoc(doc(db, "department_stats", `${user.instituteId}_${user.department}`));
                const total = statsDoc.exists() ? (statsDoc.data().totalClasses || 0) : 0;
                setTotalClasses(total);
                const myAttended = user.attendanceCount || 0; 
                setAttendedClasses(myAttended);
                if (total > 0) setPercentage(Math.min(100, Math.round((myAttended / total) * 100)));
            } catch (err) { console.error("Error fetching stats:", err); }
        };
        fetchStats();
    }, [user]);

    const getColor = (pct) => pct >= 75 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
    const strokeColor = getColor(percentage);

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                <svg width="80" height="80" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke={strokeColor} strokeWidth="10" strokeDasharray="283" strokeDashoffset={283 - (283 * percentage) / 100} strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
                </svg>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#1e293b' }}>{percentage}%</div>
            </div>
            <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Attendance</h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#64748b' }}>You have attended <strong>{attendedClasses}</strong> out of <strong>{totalClasses}</strong> classes.</p>
                {percentage < 75 && <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '600' }}>⚠️ Low Attendance!</span>}
            </div>
        </div>
    );
};

// --- DASHBOARD HOME ---
const DashboardHome = ({ user, setLiveSession, setRecentAttendance, liveSession, recentAttendance, setShowScanner }) => {
    useEffect(() => {
        if (!user?.instituteId) return;
        const q = query(collection(db, "live_sessions"), where("isActive", "==", true), where("instituteId", "==", user.instituteId));
        const unsubscribe = onSnapshot(q, (snapshot) => setLiveSession(!snapshot.empty ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } : null));
        return () => unsubscribe();
    }, [user, setLiveSession]);

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, "attendance"), where("studentId", "==", auth.currentUser.uid), orderBy("timestamp", "desc"), limit(3));
        const unsubscribe = onSnapshot(q, (snapshot) => setRecentAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp?.toDate().toLocaleDateString() }))));
        return () => unsubscribe();
    }, [setRecentAttendance]);

    return (
        <div className="content-section">
            <h2 className="content-title">Welcome, {user.firstName}!</h2>
            <div className="cards-grid">
                <SmartScheduleCard user={user} />
                <AttendanceOverview user={user} />
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

// --- 📱 MOBILE FOOTER COMPONENT ---
const MobileFooter = ({ activePage, setActivePage, badgeCount, liveSession, onScan, onChat }) => {
    return (
        <div className="mobile-footer">
            <button className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`} onClick={() => setActivePage('dashboard')}>
                <i className="fas fa-home"></i>
                <span>Home</span>
            </button>
            <button className={`nav-item ${activePage === 'notices' ? 'active' : ''}`} onClick={() => setActivePage('notices')} style={{position:'relative'}}>
                <i className="fas fa-bullhorn"></i>
                <span>Updates</span>
                {badgeCount > 0 && <span className="nav-badge" style={{position:'absolute', top:'-5px', right:'15px', padding:'2px 6px'}}>{badgeCount}</span>}
            </button>
            <div className="scan-btn-wrapper">
                <button className="scan-btn" onClick={onScan}>
                    <i className="fas fa-qrcode"></i>
                    {liveSession && <div className="scan-badge">1</div>}
                </button>
            </div>
            <button className={`nav-item ${activePage === 'leaderboard' ? 'active' : ''}`} onClick={() => setActivePage('leaderboard')}>
                <i className="fas fa-trophy"></i>
                <span>Rank</span>
            </button>
            <button className={`nav-item ${activePage === 'profile' ? 'active' : ''}`} onClick={() => setActivePage('profile')}>
                <i className="fas fa-user"></i>
                <span>Profile</span>
            </button>
        </div>
    );
};

// --- MAIN COMPONENT ---
export default function StudentDashboard() {
  const [activePage, setActivePage] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [notices, setNotices] = useState([]); 
  const [readCount, setReadCount] = useState(() => {
      const saved = localStorage.getItem('seenNoticesCount');
      return saved ? parseInt(saved) : 0;
  });

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [liveSession, setLiveSession] = useState(null);
  const [recentAttendance, setRecentAttendance] = useState([]);
  
  const scannerRef = useRef(null); 
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (doc) => setUser(doc.data()));
    return () => unsub();
  }, []);

  useEffect(() => {
      if (!user?.instituteId) return;
      const q = query(collection(db, 'announcements'), where('instituteId', '==', user.instituteId));
      let isInitialMount = true; 
      const unsub = onSnapshot(q, (snapshot) => {
          const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          const relevant = all.filter(n => {
               const isDeptMatch = n.department === user.department || n.department === 'General';
               const isYearMatch = n.targetYear === 'All' || n.targetYear === user.year;
               return isDeptMatch && isYearMatch;
          });
          relevant.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
          setNotices(relevant);
          if (isInitialMount) {
              const unread = Math.max(0, relevant.length - readCount);
              if (unread > 0) toast(`You have ${unread} unread notices!`, { icon: '📬', duration: 4000 });
              isInitialMount = false;
          } else {
              snapshot.docChanges().forEach((change) => {
                  if (change.type === 'added') {
                      const n = change.doc.data();
                      const isDeptMatch = n.department === user.department || n.department === 'General';
                      const isYearMatch = n.targetYear === 'All' || n.targetYear === user.year;
                      if (isDeptMatch && isYearMatch) toast(`📢 New: ${n.title}`, { icon: '🔔', duration: 5000 });
                  }
              });
          }
      });
      return () => unsub();
  }, [user?.instituteId, user?.department, user?.year, readCount]); 

  useEffect(() => {
      if (activePage === 'notices' && notices.length > readCount) {
          const newCount = notices.length;
          setReadCount(newCount);
          localStorage.setItem('seenNoticesCount', newCount.toString());
      }
  }, [activePage, notices, readCount]);

  const badgeCount = Math.max(0, notices.length - readCount);
  const handleLogout = async () => { await signOut(auth); navigate('/'); };

  const onScanSuccess = (decodedText) => {
        if (scannerRef.current) {
            scannerRef.current.pause(true); 
        }
        setShowScanner(false);
        // ✅ Store ID so we can update it
        const toastId = toast.loading("Verifying...");
        
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const token = await auth.currentUser.getIdToken();
                const response = await fetch(`${BACKEND_URL}/markAttendance`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ sessionId: decodedText, studentLocation: { latitude: position.coords.latitude, longitude: position.coords.longitude } })
                });
                const data = await response.json();
                
                // ✅ Update existing toast instead of creating new one
                if (response.ok) {
                    toast.success(data.message, { id: toastId });
                } else {
                    toast.error(data.error, { id: toastId });
                }
            } catch (error) { 
                toast.error(error.message, { id: toastId }); 
            }
        }, (err) => {
            toast.error("Location permission denied.", { id: toastId });
            setShowScanner(false);
        });
  };

  useEffect(() => {
    if (showScanner) {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
        .catch(err => {
            console.error(err);
            toast.error("Camera failed to start.");
            setShowScanner(false);
        });
        return () => {
            if (html5QrCode.isScanning) {
                html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
            }
        };
    }
  }, [showScanner]);

  const renderContent = () => {
    if (!user) return <div style={{ textAlign: 'center', paddingTop: 50 }}>Loading...</div>;
    switch (activePage) {
      case 'dashboard': return <DashboardHome user={user} onOpenAI={() => setIsChatOpen(true)} liveSession={liveSession} setLiveSession={setLiveSession} recentAttendance={recentAttendance} setRecentAttendance={setRecentAttendance} setShowScanner={setShowScanner} />;
      case 'tasks': return <FreePeriodTasks user={user} />;
      case 'profile': return <Profile user={user} />;
      case 'plans': return <CareerRoadmap user={user} />; 
      case 'leaderboard': return <Leaderboard user={user} />;
      case 'leave': return <LeaveRequestForm user={user} />;
      case 'notices': return <NoticesView notices={notices} />;
      default: return <DashboardHome user={user} onOpenAI={() => setIsChatOpen(true)} liveSession={liveSession} setLiveSession={setLiveSession} recentAttendance={recentAttendance} setRecentAttendance={setRecentAttendance} setShowScanner={setShowScanner} />;
    }
  };

  return (
    <div className="dashboard-container">
      {/* ✅ UPDATED TOASTER CONFIGURATION */}
      <Toaster 
          position="bottom-center" 
          toastOptions={{ 
              duration: 4000, 
              style: { background: '#1e293b', color: '#fff', marginBottom: '20px', zIndex: 99999 } 
          }} 
      />
      
      {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)} />}
      
      <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`} style={{ zIndex: isMobileNavOpen ? 200 : 50 }}>
        <div className="logo-container"><img src={logo} alt="AcadeX" className="sidebar-logo"/><span className="logo-text">Acadex</span></div>
        {user && (
            <div className="teacher-info" onClick={() => { setActivePage('profile'); setIsMobileNavOpen(false); }} style={{ cursor: 'pointer' }}>
                <h4>{user.firstName} {user.lastName}</h4>
                <p>Roll No: {user.rollNo}</p>
                <p style={{fontSize:'14px', color:'#059669', fontWeight:'700', margin:'4px 0'}}>{user.xp || 0} XP {user.badges?.map(b => <span key={b} style={{marginLeft:'4px'}}>{b === 'novice' ? '🌱' : '🔥'}</span>)}</p>
            </div>
        )}
        <ul className="menu">
            {/* ✅ FIXED GAP */}
            <li className={activePage === 'dashboard' ? 'active' : ''} onClick={() => {setActivePage('dashboard'); setIsMobileNavOpen(false);}}>
                <div style={{display:'flex', alignItems:'center', width:'100%', gap: '15px'}}>
                    <i className="fas fa-home" style={{ width: '24px', textAlign: 'center' }}></i>
                    <span>Dashboard</span>
                </div>
            </li>
            <li className={activePage === 'notices' ? 'active' : ''} onClick={() => {setActivePage('notices'); setIsMobileNavOpen(false);}}>
                <div style={{display:'flex', alignItems:'center', width:'100%', gap: '15px'}}>
                    <i className="fas fa-bullhorn" style={{ width: '24px', textAlign: 'center' }}></i>
                    <span>Notice Board</span>
                    {badgeCount > 0 && <span className="nav-badge" style={{ background: '#ef4444', color: 'white', fontSize: '10px', padding: '2px 8px', borderRadius: '12px', marginLeft: 'auto', fontWeight: 'bold' }}>{badgeCount}</span>}
                </div>
            </li>
            <li className={activePage === 'tasks' ? 'active' : ''} onClick={() => {setActivePage('tasks'); setIsMobileNavOpen(false);}}>
                <div style={{display:'flex', alignItems:'center', width:'100%', gap: '15px'}}>
                    <i className="fas fa-check-circle" style={{ width: '24px', textAlign: 'center' }}></i>
                    <span>Free Period Tasks</span>
                </div>
            </li>
            <li className={activePage === 'leaderboard' ? 'active' : ''} onClick={() => {setActivePage('leaderboard'); setIsMobileNavOpen(false);}}>
                <div style={{display:'flex', alignItems:'center', width:'100%', gap: '15px'}}>
                    <i className="fas fa-trophy" style={{ width: '24px', textAlign: 'center' }}></i>
                    <span>Leaderboard</span>
                </div>
            </li>
            <li className={activePage === 'plans' ? 'active' : ''} onClick={() => {setActivePage('plans'); setIsMobileNavOpen(false);}}>
                <div style={{display:'flex', alignItems:'center', width:'100%', gap: '15px'}}>
                    <i className="fas fa-paper-plane" style={{ width: '24px', textAlign: 'center' }}></i>
                    <span>Future Plans</span>
                </div>
            </li>
            <li className={activePage === 'leave' ? 'active' : ''} onClick={() => {setActivePage('leave'); setIsMobileNavOpen(false);}}>
                <div style={{display:'flex', alignItems:'center', width:'100%', gap: '15px'}}>
                    <i className="fas fa-calendar-minus" style={{ width: '24px', textAlign: 'center' }}></i>
                    <span>Apply Leave</span>
                </div>
            </li>
            <li className={activePage === 'profile' ? 'active' : ''} onClick={() => {setActivePage('profile'); setIsMobileNavOpen(false);}}>
                <div style={{display:'flex', alignItems:'center', width:'100%', gap: '15px'}}>
                    <i className="fas fa-user" style={{ width: '24px', textAlign: 'center' }}></i>
                    <span>Profile</span>
                </div>
            </li>
        </ul>
        <div className="sidebar-footer"><button onClick={handleLogout} className="logout-btn"><i className="fas fa-sign-out-alt"></i> <span>Logout</span></button></div>
      </aside>

      <main className="main-content">
        <header className="mobile-header">
            <button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}><i className="fas fa-bars"></i></button>
            <div className="mobile-brand"><img src={logo} alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">AcadeX</span></div>
            <div style={{width:'40px'}}></div>
        </header>
        
        {renderContent()}

        {/* ✅ FULL SCREEN SCANNER MODAL (PORTAL) */}
        {showScanner && ReactDOM.createPortal(
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 999999, // Super high z-index
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
            }}>
                <div id="reader" style={{width: '300px', height: '300px', background: 'black', borderRadius: '12px', overflow:'hidden', border:'2px solid #2563eb'}}></div>
                <p style={{color:'white', marginTop:'20px', fontWeight: '500', fontSize:'16px'}}>Align QR Code within the frame</p>
                <button 
                    onClick={() => setShowScanner(false)} 
                    style={{
                        marginTop:'30px', background:'transparent', border:'1px solid white', 
                        color:'white', padding:'10px 30px', borderRadius:'30px', cursor:'pointer', fontSize:'14px'
                    }}
                >
                    Cancel Scan
                </button>
            </div>,
            document.body
        )}

        <MobileFooter 
            activePage={activePage} 
            setActivePage={setActivePage} 
            badgeCount={badgeCount} 
            liveSession={liveSession} 
            onScan={() => setShowScanner(true)}
            onChat={() => setIsChatOpen(true)}
        />
      </main>

      {/* 🚀 Render Chatbot */}
      {user && (
          <AiChatbot user={user} isOpenProp={isChatOpen} onClose={() => setIsChatOpen(false)} />
      )}
    </div>
  );
}