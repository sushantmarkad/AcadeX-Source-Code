import React, { Suspense, lazy, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from 'react-hot-toast';
import IOSSplashScreen from "./components/IOSSplashScreen";

// Lazy load components
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const StudentRegister = lazy(() => import("./pages/StudentRegister"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Attendance = lazy(() => import("./pages/Attendance"));
const FreeTime = lazy(() => import("./pages/FreeTime"));
const Goals = lazy(() => import("./pages/Goals"));
const InstituteApplication = lazy(() => import("./pages/InstituteApplication"));
const CheckStatus = lazy(() => import("./pages/CheckStatus"));

function App() {
  const location = useLocation();
  const [showSplash, setShowSplash] = useState(true);

  // Show Splash Screen first
  if (showSplash) {
    return (
      <IOSSplashScreen 
        logoSrc="https://iili.io/KoAVeZg.md.png" 
        onComplete={() => setShowSplash(false)} 
      />
    );
  }

  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>}>
      <Toaster position="top-center" reverseOrder={false} />
      
      {/* mode="wait" ensures the old page slides out before the new one slides in */}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/apply" element={<InstituteApplication />} />
          <Route path="/check-status" element={<CheckStatus />} />
          <Route path="/student-register" element={<StudentRegister />} />
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