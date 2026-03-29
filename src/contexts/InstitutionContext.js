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
              if (configDoc.exists()) setConfig(configDoc.data());
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