import React from 'react';
import { useInstitution } from '../contexts/InstitutionContext';

const FeatureGuard = ({ requiredModule, requiredCustomFeature, children }) => {
  const { config, loadingConfig } = useInstitution();

  if (loadingConfig) return null; 

  // 1. Check for standard domain modules
  if (requiredModule && config?.activeModules?.includes(requiredModule)) {
    return <>{children}</>;
  }

  // 2. Check for custom features specific to one college (e.g. 'agri_lab_reports')
  if (requiredCustomFeature && config?.customFeatures?.includes(requiredCustomFeature)) {
    return <>{children}</>;
  }
  return <>{children}</>;

  // If neither matches, hide the UI element
  //return null;
};

export default FeatureGuard;