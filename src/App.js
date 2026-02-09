import React, { Suspense, lazy, useState, useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster, toast } from 'react-hot-toast';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase'; 
import { usePushNotifications } from './hooks/usePushNotifications';
import IOSSplashScreen from "./components/IOSSplashScreen";
import logo from "./assets/logo.png"; 
import DashboardSkeleton from "./components/DashboardSkeleton";

// ✅ OPTIMIZATION: Lazy load heavy components not needed for First Paint
const Onboarding = lazy(() => import('./pages/Onboarding')); 
const TwoFactorVerifyModal = lazy(() => import("./components/TwoFactorVerifyModal"));

// Lazy load pages (Existing)
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const StudentRegister = lazy(() => import("./pages/StudentRegister"));
const InstituteApplication = lazy(() => import("./pages/InstituteApplication"));
const CheckStatus = lazy(() => import("./pages/CheckStatus"));

const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const InstituteAdminDashboard = lazy(() => import("./pages/InstituteAdminDashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const BulkAddStudents = lazy(() => import("./pages/BulkAddStudents"));

const Attendance = lazy(() => import("./pages/Attendance"));
const FreeTime = lazy(() => import("./pages/FreeTime"));
const Goals = lazy(() => import("./pages/Goals"));
const Dashboard = lazy(() => import("./pages/Dashboard")); 
const AiChatbot = lazy(() => import("./pages/AiChatbot")); 

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

function App() {
  
  usePushNotifications();
  const location = useLocation();
  const [showSplash, setShowSplash] = useState(true);
  
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 🔐 2FA GLOBAL STATES
  const [is2FARequired, setIs2FARequired] = useState(false);
  const [is2FAVerified, setIs2FAVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        try {
            const userDoc = await getDoc(doc(db, "users", currentUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserRole(data.role);

                // --- 🔐 GLOBAL 2FA CHECK (RESTORED) ---
                if (data.is2FAEnabled) {
                    // Check if already verified in this session (Tab)
                    const sessionVerified = sessionStorage.getItem('is2FAVerified');
                    if (sessionVerified === 'true') {
                        setIs2FAVerified(true);
                        setIs2FARequired(false);
                    } else {
                        // 🛑 BLOCK ACCESS: Require 2FA
                        setIs2FARequired(true); 
                        setIs2FAVerified(false);
                    }
                } else {
                    // No 2FA enabled, allow access
                    setIs2FARequired(false);
                    setIs2FAVerified(true); 
                }
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
      } else {
        // Logged out
        setUser(null);
        setUserRole(null);
        setIs2FARequired(false);
        setIs2FAVerified(false);
        sessionStorage.removeItem('is2FAVerified'); 
      }
      setAuthLoading(false); 
    });

    return () => unsubscribe();
  }, []);

  // --- 🔐 HANDLE 2FA VERIFICATION ---
  const handleVerify2FA = async (code) => {
      setVerifying(true);
      try {
          const token = await user.getIdToken();
          const res = await fetch(`${BACKEND_URL}/verify2FA`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json', 
                  'Authorization': `Bearer ${token}` 
              },
              body: JSON.stringify({ token: code, isLogin: true })
          });
          const data = await res.json();
          
          if (data.success) {
              toast.success("Identity Verified");
              sessionStorage.setItem('is2FAVerified', 'true'); // Persist for this tab
              setIs2FAVerified(true);
              setIs2FARequired(false); // Close Modal & Allow Routes
          } else {
              toast.error("Invalid Code");
          }
      } catch (err) {
          toast.error("Verification Error");
      } finally {
          setVerifying(false);
      }
  };

  const handleLogout = () => {
      signOut(auth);
      setIs2FARequired(false);
  };

  const getDashboardRoute = () => {
    if (userRole === 'student') return '/student-dashboard';
    if (userRole === 'teacher') return '/teacher-dashboard';
    if (userRole === 'institute-admin') return '/admin-dashboard';
    if (userRole === 'super-admin') return '/super-admin';
    return '/dashboard';
  };

  const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');

  // ✅ Keep Splash Screen fast and simple
  if (showSplash) {
    return <IOSSplashScreen logoSrc={logo} onComplete={() => setShowSplash(false)} />;
  }

  if (authLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
     <Toaster 
    position="bottom-center" // ✅ Keeps it at the bottom
    reverseOrder={false}
    containerStyle={{
        bottom: 80, // ⬆️ MOVES IT UP (Adjust this number: 80px is good for mobile navs)
        zIndex: 9999999, // 🛡️ Ensures it stays on top of everything
    }}
    toastOptions={{
        style: {
            fontSize: '14px',
            borderRadius: '12px',
            background: '#1e293b', // Darker background for contrast
            color: '#fff',
            marginBottom: '20px' // Adds a little extra breathing room
        },
    }}
/>
      
      {/* 🔐 GLOBAL 2FA LOCK SCREEN - RESTORED & LAZY LOADED */}
      {is2FARequired && (
        <Suspense fallback={null}>
            <TwoFactorVerifyModal 
                isOpen={is2FARequired} 
                isLoading={verifying}
                onClose={handleLogout} 
                onVerify={handleVerify2FA}
            />
        </Suspense>
      )}

      {/* ✅ ONLY RENDER ROUTES IF 2FA IS NOT REQUIRED (OR VERIFIED) */}
      {!is2FARequired && (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
            
            <Route path="/" element={
                user ? <Navigate to={getDashboardRoute()} /> : (!hasSeenOnboarding ? <Onboarding /> : <Navigate to="/login" />)
            } />

            <Route path="/login" element={
                !user ? <Login /> : <Navigate to={getDashboardRoute()} />
            } />

            <Route path="/signup" element={<Signup />} />
            <Route path="/apply" element={<InstituteApplication />} />
            <Route path="/check-status" element={<CheckStatus />} />
            <Route path="/student-register" element={<StudentRegister />} />
            
            {/* ROLE-BASED DASHBOARDS */}
            <Route path="/student-dashboard" element={user ? <StudentDashboard /> : <Navigate to="/" />} />
            <Route path="/teacher-dashboard" element={user ? <TeacherDashboard /> : <Navigate to="/" />} />
            <Route path="/admin-dashboard" element={user ? <InstituteAdminDashboard /> : <Navigate to="/" />} />
            <Route path="/super-admin" element={user ? <SuperAdminDashboard /> : <Navigate to="/" />} />
            <Route path="/bulk-add-students" element={user ? <BulkAddStudents /> : <Navigate to="/" />} />

            {/* Legacy/Shared Routes */}
            <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
            <Route path="/attendance" element={user ? <Attendance /> : <Navigate to="/" />} />
            <Route path="/free-time" element={user ? <FreeTime /> : <Navigate to="/" />} />
            <Route path="/goals" element={user ? <Goals /> : <Navigate to="/" />} />
            <Route path="/ai-chatbot" element={user ? <AiChatbot /> : <Navigate to="/" />} />
            
            <Route path="*" element={<Navigate to={user ? getDashboardRoute() : "/"} />} />

            </Routes>
        </AnimatePresence>
      )}
    </Suspense>
  );
}

export default App;