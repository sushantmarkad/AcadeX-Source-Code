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
          // Find the user's instituteId
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists() && userDoc.data().instituteId) {
              // Fetch that specific college's rules
              const configDoc = await getDoc(doc(db, "Institutions", userDoc.data().instituteId));
              
              // ✅ REPLACE THIS SPECIFIC IF BLOCK:
              if (configDoc.exists()) {
                  const data = configDoc.data();
                  setConfig({
                      ...data,
                      // Fallback ensures existing engineering colleges don't crash
                      academicConfig: data.academicConfig || {
                          levelNomenclature: 'Class',
                          levels: ['FE', 'SE', 'TE', 'BE']
                      },
                      // Give default modules to existing users
                      activeModules: data.activeModules || [
                          'departments', 'hod', 'curriculum', 'bulk_upload', 
                          'manage_users', 'promote', 'face_requests'
                      ],
                      customFeatures: data.customFeatures || []
                  });
              }
          }
        } catch (error) { console.error(error); }
      } else {
          setConfig(null); 
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