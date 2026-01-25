import React, { Suspense, lazy, useState, useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase'; 
import { usePushNotifications } from './hooks/usePushNotifications';
import IOSSplashScreen from "./components/IOSSplashScreen";
import logo from "./assets/logo.png"; 

// Import the Skeleton Component
import DashboardSkeleton from "./components/DashboardSkeleton";

// Lazy load components
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const StudentRegister = lazy(() => import("./pages/StudentRegister"));
const InstituteApplication = lazy(() => import("./pages/InstituteApplication"));
const CheckStatus = lazy(() => import("./pages/CheckStatus"));

// ROLE-BASED DASHBOARDS
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const InstituteAdminDashboard = lazy(() => import("./pages/InstituteAdminDashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));

// ✅ NEW: Bulk Student Upload Page
const BulkAddStudents = lazy(() => import("./pages/BulkAddStudents"));

// Legacy/Shared Pages
const Attendance = lazy(() => import("./pages/Attendance"));
const FreeTime = lazy(() => import("./pages/FreeTime"));
const Goals = lazy(() => import("./pages/Goals"));
const Dashboard = lazy(() => import("./pages/Dashboard")); 
const AiChatbot = lazy(() => import("./pages/AiChatbot")); 

function App() {
  usePushNotifications();
  const location = useLocation();
  const [showSplash, setShowSplash] = useState(true);
  
  
  
  // Auth State Management
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 1. Persistent Login Logic
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch role to know where to redirect
        try {
            const userDoc = await getDoc(doc(db, "users", currentUser.uid));
            if (userDoc.exists()) {
                setUserRole(userDoc.data().role);
            }
        } catch (error) {
            console.error("Error fetching role:", error);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      // Stop loading once we know the status
      setAuthLoading(false); 
    });

    return () => unsubscribe();
  }, []);

  // Helper to determine dashboard based on role
  const getDashboardRoute = () => {
    if (userRole === 'student') return '/student-dashboard';
    if (userRole === 'teacher') return '/teacher-dashboard';
    if (userRole === 'institute-admin') return '/admin-dashboard';
    if (userRole === 'super-admin') return '/super-admin';
    return '/dashboard';
  };

  // 2. Show App Logo Splash Screen FIRST
  if (showSplash) {
    return (
      <IOSSplashScreen 
        logoSrc={logo} 
        onComplete={() => setShowSplash(false)} 
      />
    );
  }

  // 3. If Splash is done but Auth is still checking, keep showing Skeleton
  if (authLoading) {
    return <DashboardSkeleton />;
  }

  return (
    // 4. Main App Render
    <Suspense fallback={<DashboardSkeleton />}>
      {/* ✅ GLOBAL TOASTER CONFIGURATION */}
      {/* This handles notifications for the entire app to prevent duplicates */}
      <Toaster 
          position="bottom-center" 
          reverseOrder={false}
          toastOptions={{ 
              duration: 4000, 
              style: { 
                  background: '#1e293b', 
                  color: '#fff', 
                  marginBottom: '20px', 
                  zIndex: 99999 
              } 
          }} 
      />
      
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          
          {/* Public Routes with Auto-Redirect */}
          <Route path="/" element={
            !user ? <Login /> : <Navigate to={getDashboardRoute()} />
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

          {/* Bulk Upload Route */}
          <Route path="/bulk-add-students" element={user ? <BulkAddStudents /> : <Navigate to="/" />} />

          {/* Legacy/Shared Routes */}
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
          <Route path="/attendance" element={user ? <Attendance /> : <Navigate to="/" />} />
          <Route path="/free-time" element={user ? <FreeTime /> : <Navigate to="/" />} />
          <Route path="/goals" element={user ? <Goals /> : <Navigate to="/" />} />
          <Route path="/ai-chatbot" element={user ? <AiChatbot /> : <Navigate to="/" />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to={user ? getDashboardRoute() : "/"} />} />

        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}

export default App;