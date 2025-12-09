import React, { Suspense, lazy, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from 'react-hot-toast';
import IOSSplashScreen from "./components/IOSSplashScreen";
import logo from "./assets/logo.png"; 

// ✅ Import the Skeleton Component
import DashboardSkeleton from "./components/DashboardSkeleton";

// Lazy load components
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const StudentRegister = lazy(() => import("./pages/StudentRegister"));
const InstituteApplication = lazy(() => import("./pages/InstituteApplication"));
const CheckStatus = lazy(() => import("./pages/CheckStatus"));
// At the top of your server file (app.js)
// NOTE: Use a long, complex string for the key.

// ✅ NEW DASHBOARDS (These were missing!)
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const InstituteAdminDashboard = lazy(() => import("./pages/InstituteAdminDashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));

// Legacy/Shared Pages
const Attendance = lazy(() => import("./pages/Attendance"));
const FreeTime = lazy(() => import("./pages/FreeTime"));
const Goals = lazy(() => import("./pages/Goals"));
const Dashboard = lazy(() => import("./pages/Dashboard")); // Fallback

function App() {
  const location = useLocation();
  const [showSplash, setShowSplash] = useState(true);

  // 1. Show App Logo Splash Screen FIRST
  if (showSplash) {
    return (
      <IOSSplashScreen 
        logoSrc={logo} 
        onComplete={() => setShowSplash(false)} 
      />
    );
  }

  return (
    // 2. After Splash, show the Skeleton while the actual page loads
    <Suspense fallback={<DashboardSkeleton />}>
      
      
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/apply" element={<InstituteApplication />} />
          <Route path="/check-status" element={<CheckStatus />} />
          <Route path="/student-register" element={<StudentRegister />} />
          
          {/* ✅ ROLE-BASED DASHBOARDS (The Fix) */}
          <Route path="/student-dashboard" element={<StudentDashboard />} />
          <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
          <Route path="/admin-dashboard" element={<InstituteAdminDashboard />} />
          <Route path="/super-admin" element={<SuperAdminDashboard />} />

          {/* Fallback / Legacy Routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/free-time" element={<FreeTime />} />
          <Route path="/goals" element={<Goals />} />
          
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}

export default App;