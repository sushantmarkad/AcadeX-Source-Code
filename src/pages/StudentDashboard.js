import React, { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { Html5QrcodeScanner } from 'html5-qrcode';
import './Dashboard.css';
import FreePeriodTasks from './FreePeriodTasks';
import Profile from './Profile';
import AiChatbot from './AiChatbot';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// ------------------------------
//  DASHBOARD HOME
// ------------------------------
const DashboardHome = ({ user }) => {
    const [liveSession, setLiveSession] = useState(null);
    const [scanMessage, setScanMessage] = useState({ type: '', text: '' });
    const [showScanner, setShowScanner] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [recentAttendance, setRecentAttendance] = useState([]);
    const [attendanceLoading, setAttendanceLoading] = useState(true);

    const hasScannedRef = useRef(false);
    const scannerRef = useRef(null);

    // 1. Listen for active sessions
    useEffect(() => {
        if (!user?.instituteId) return;
        const q = query(
            collection(db, "live_sessions"),
            where("isActive", "==", true),
            where("instituteId", "==", user.instituteId)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setLiveSession(!snapshot.empty ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } : null);
        });
        return () => unsubscribe();
    }, [user]);

    // 2. Fetch Recent Attendance
    useEffect(() => {
        if (!auth.currentUser) return;
        setAttendanceLoading(true);
        const q = query(
            collection(db, "attendance"),
            where("studentId", "==", auth.currentUser.uid),
            orderBy("timestamp", "desc"),
            limit(3)
        );

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
            setScanMessage({ type: 'error', text: 'History unavailable (Index building).' });
            setAttendanceLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    // 3. Scanner Logic
    useEffect(() => {
        let scannerInstance;
        if (showScanner) {
            hasScannedRef.current = false;
            scannerInstance = new Html5QrcodeScanner("qr-reader", { fps: 5, qrbox: { width: 250, height: 250 } }, false);
            
            const onScanSuccess = (decodedText) => {
                if (!hasScannedRef.current) {
                    hasScannedRef.current = true;
                    if (scannerInstance?.getState() !== 2) { 
                        scannerInstance.clear().catch(err => console.error("Scanner clear failed.", err));
                    }
                    setShowScanner(false);
                    scannerRef.current = null;
                    handleScan(decodedText);
                }
            };
            scannerInstance.render(onScanSuccess, () => {});
            scannerRef.current = scannerInstance;
        }
        return () => {
            if (scannerRef.current && scannerRef.current.getState() !== 2) {
                scannerRef.current.clear().catch(err => console.error("Cleanup failed.", err));
            }
        };
    }, [showScanner]);
    
    const handleScan = (sessionId) => {
        if (!auth.currentUser) return setScanMessage({ type: 'error', text: 'Not logged in.' });
        
        setIsProcessing(true);
        setScanMessage({ type: 'info', text: 'Getting location...' });

        navigator.geolocation.getCurrentPosition(async (position) => {
            setScanMessage({ type: 'info', text: 'Verifying location...' });
            try {
                const token = await auth.currentUser.getIdToken();
                const response = await fetch(`${BACKEND_URL}/markAttendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ 
                        sessionId, 
                        studentLocation: { 
                            latitude: position.coords.latitude, 
                            longitude: position.coords.longitude 
                        } 
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Verification failed.');
                
                setScanMessage({ type: 'success', text: data.message });
            } catch (error) {
                setScanMessage({ type: 'error', text: error.message });
            } finally {
                setIsProcessing(false);
            }
        }, (error) => {
            setScanMessage({ type: 'error', text: 'Location permission required.' });
            setIsProcessing(false);
        });
    };

    return (
        <div className="content-section">
            <div style={{ marginBottom: '30px' }}>
                <h2 className="content-title">Welcome, {user.firstName}!</h2>
                <p className="content-subtitle">Your academic dashboard.</p>
            </div>

            <div className="cards-grid">
                {/* ✅ FEATURED CARD: LIVE ATTENDANCE */}
                <div className="card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbb4fe 100%)', border: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                        <div className="icon-box-modern">
                            <i className="fas fa-qrcode"></i>
                        </div>
                        <h3 style={{ margin: 0, color: '#1e3a8a', fontWeight:'700' }}>Live Attendance</h3>
                    </div>

                    {liveSession ? (
                        <>
                            <div className="live-badge pulsate">
                                <div className="dot"></div>
                                <span>SESSION ACTIVE</span>
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <p style={{ fontSize: '20px', fontWeight: '800', color: '#1e1b4b', margin: '0 0 5px 0' }}>
                                    {liveSession.subject || 'Class'}
                                </p>
                                <p style={{ color: '#4c1d95', margin: 0, fontSize:'14px' }}>
                                    <i className="fas fa-chalkboard-teacher" style={{marginRight:'6px'}}></i> 
                                    {liveSession.teacherName || 'Your Teacher'}
                                </p>
                            </div>

                            <button 
                                className="btn-modern-primary"
                                disabled={isProcessing || scanMessage.type === 'success'}
                                onClick={() => { 
                                    setScanMessage({ type: '', text: '' });
                                    setShowScanner(true); 
                                }}
                            >
                                {isProcessing ? 'Processing...' : (scanMessage.type === 'success' ? 'Marked Successfully!' : 'Scan Now')}
                            </button>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '25px 0', color: '#64748b' }}>
                            <i className="fas fa-mug-hot" style={{fontSize:'24px', marginBottom:'10px', display:'block', opacity:0.5}}></i>
                            <p style={{fontWeight:500}}>No active sessions</p>
                            <small>Relax! Class hasn't started yet.</small>
                        </div>
                    )}
                    
                    {scanMessage.text && (
                        <div className={`scan-message ${scanMessage.type}`} style={{ marginTop: '15px' }}>
                            {scanMessage.text}
                        </div>
                    )}
                </div>

                {/* ✅ SCANNER OVERLAY CARD */}
                {showScanner && (
                    <div className="card scanner-card">
                        <h3 style={{ textAlign: 'center' }}>Scanning...</h3>
                        <div id="qr-reader" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }}></div>
                        <button 
                            className="btn-secondary" 
                            style={{ marginTop: '15px', width: '100%' }}
                            onClick={() => {
                                if (scannerRef.current) scannerRef.current.clear().catch(() => {});
                                setShowScanner(false);
                            }}
                        >
                            Cancel Scan
                        </button>
                    </div>
                )}

                {/* ✅ MODERN HISTORY LIST */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                         <div className="icon-box-modern" style={{background:'#f3f4f6', color:'#374151'}}>
                            <i className="fas fa-history"></i>
                        </div>
                        <h3 style={{ margin: 0 }}>Recent History</h3>
                    </div>

                    {attendanceLoading ? (
                        <p style={{ color: 'var(--text-secondary)' }}>Loading records...</p>
                    ) : (
                        <div className="recent-attendance-list">
                            {recentAttendance.length > 0 ? (
                                recentAttendance.map(item => (
                                    <div key={item.id} className="history-card">
                                        <div className="history-left">
                                            <div className="history-icon">
                                                <i className="fas fa-check"></i>
                                            </div>
                                            <div>
                                                <p className="history-subject">{item.subject}</p>
                                                <p className="history-date">{item.timestamp}</p>
                                            </div>
                                        </div>
                                        <div className="status-badge-pill">
                                            Present
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign:'center', padding:'20px' }}>No records found.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- PLACEHOLDERS ---
const Goals = () => <div className="content-section"><h2 className="content-title">🎯 My Goals</h2><p>Goal tracking coming soon.</p></div>;
const Plans = () => <div className="content-section"><h2 className="content-title">🚀 Future Plans</h2><p>Career planning coming soon.</p></div>;
const Coding = () => <div className="content-section"><h2 className="content-title">💻 Coding</h2><p>Practice modules coming soon.</p></div>;

// ------------------------------
//  MAIN STUDENT DASHBOARD
// ------------------------------
export default function StudentDashboard() {
  const [activePage, setActivePage] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
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
      case 'dashboard': return <DashboardHome user={user} />;
      case 'tasks': return <FreePeriodTasks user={user} />;
      case 'profile': return <Profile user={user} />;
      case 'goals': return <Goals />;
      case 'plans': return <Plans />;
      case 'coding': return <Coding />;
      default: return <DashboardHome user={user} />;
    }
  };

  const NavLink = ({ page, iconClass, label }) => (
    <li className={activePage === page ? 'active' : ''} onClick={() => {setActivePage(page); setIsMobileNavOpen(false);}}>
        <i className={`fas ${iconClass}`} style={{ width: '24px', textAlign: 'center' }}></i>
        <span>{label}</span>
    </li>
  );

  return (
    <div className="dashboard-container">
      {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)} />}
      
      <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`}>
        <div className="logo-container">
          <img src="https://iili.io/KoAVeZg.md.png" alt="AcadeX" className="sidebar-logo"/>
          <span className="logo-text">Acadex</span>
        </div>
        
        {user && (
            <div className="teacher-info" onClick={() => { setActivePage('profile'); setIsMobileNavOpen(false); }} style={{ cursor: 'pointer' }}>
                <h4>{user.firstName} {user.lastName}</h4>
                <p>Roll No: {user.rollNo}</p>
                {/* ✅ NEW: Modern Pill Button */}
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
            <NavLink page="coding" iconClass="fa-code" label="Coding Practice" />
        </ul>

        <div className="sidebar-footer">
            <button onClick={handleLogout} className="logout-btn">
                <i className="fas fa-sign-out-alt"></i> <span>Logout</span>
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
        {user && <AiChatbot user={user} />}
      </main>
    </div>
  );
}