import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from '../firebase';
import TeacherDashboard from './TeacherDashboard';
import StudentDashboard from './StudentDashboard';
import InstituteAdminDashboard from './InstituteAdminDashboard';
import HODDashboard from './HODDashboard';
import SuperAdminDashboard from './SuperAdminDashboard'; // ✅ Ensure this is a default import (no curly braces)
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../components/AnimatedPage';

export default function Dashboard() {
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const SUPER_ADMIN_UID = "ggCBKnsenPXy9gz7jjKomLcy29A3";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.uid === SUPER_ADMIN_UID) {
          setUserRole('super-admin');
          setLoading(false);
          return;
        }

        const userDocRef = doc(db, "users", user.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          } else {
            console.error("User document not found for UID:", user.uid);
            setUserRole('error');
          }
        } catch (err) {
          console.error("Error fetching user document:", err);
          setUserRole('error');
        }
      } else {
        navigate('/');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><h2>Loading...</h2></div>;
  }

  switch (userRole) {
    case 'super-admin':
      return <AnimatedPage><SuperAdminDashboard /></AnimatedPage>;
    case 'teacher':
      return <AnimatedPage><TeacherDashboard /></AnimatedPage>;
    case 'student':
      return <AnimatedPage><StudentDashboard /></AnimatedPage>;
    case 'institute-admin':
      return <AnimatedPage><InstituteAdminDashboard /></AnimatedPage>;
    case 'hod':
      return <AnimatedPage><HODDashboard /></AnimatedPage>;
    default:
      return (
        <AnimatedPage>
          <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h1>An Error Occurred</h1>
            <p>We couldn't find your user role. Please sign out and try again.</p>
            <button onClick={() => auth.signOut().then(() => navigate('/'))}>Sign Out</button>
          </div>
        </AnimatedPage>
      );
  }
}