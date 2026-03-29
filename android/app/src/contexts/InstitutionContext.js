import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from '../firebase'; 
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const InstitutionContext = createContext();

export const useInstitution = () => useContext(InstitutionContext);

export const InstitutionProvider = ({ children }) => {
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // 1. Get the user's document to find their instituteId
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
              const userData = userDoc.data();
              
              // Super Admins don't belong to a specific institute
              if (userData.role === 'super-admin') {
                  setLoadingConfig(false);
                  return;
              }

              // 2. Fetch the specific configuration for their college
              if (userData.instituteId) {
                  const configDoc = await getDoc(doc(db, "Institutions", userData.instituteId));
                  if (configDoc.exists()) {
                      setConfig(configDoc.data());
                  }
              }
          }
        } catch (error) {
            console.error("Error fetching institution config:", error);
        }
      } else {
          setConfig(null); // Clear config on logout
      }
      setLoadingConfig(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <InstitutionContext.Provider value={{ config, loadingConfig }}>
      {children}
    </InstitutionContext.Provider>
  );
};