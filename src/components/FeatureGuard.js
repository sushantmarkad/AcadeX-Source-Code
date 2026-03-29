import React from 'react';
import { useInstitution } from '../contexts/InstitutionContext';

const FeatureGuard = ({ requiredModule, children }) => {
  const { config, loadingConfig } = useInstitution();

  if (loadingConfig) return null; 

  // If the college's activeModules array includes the required module, show it.
  if (config && config.activeModules && config.activeModules.includes(requiredModule)) {
    return <>{children}</>;
  }

  // Otherwise, render nothing.
  return null;
};

export default FeatureGuard;