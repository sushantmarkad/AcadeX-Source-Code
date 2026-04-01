import React from 'react';
import { useInstitution } from '../contexts/InstitutionContext';

const FeatureGuard = ({ requiredModule, requiredCustomFeature, requiredDomain, excludedDomain, children }) => {
    const { config, loadingConfig } = useInstitution();

    if (loadingConfig) return null;

    // 1. Check if we should EXCLUDE this based on domain (e.g., hide from Agri colleges)
    if (excludedDomain && config?.domain === excludedDomain) {
        return null; // Hide the element
    }

    // 2. Check if we should RESTRICT this to ONLY one domain (e.g., only show for Engg)
    if (requiredDomain && config?.domain !== requiredDomain) {
        return null; // Hide the element
    }

    // 3. Check for standard domain modules (from database)
    if (requiredModule) {
        if (config?.activeModules?.includes(requiredModule)) {
            return <>{children}</>;
        }
        return null; // If requiredModule is passed but missing in DB, hide it
    }

    // 4. Check for custom features specific to one college
    if (requiredCustomFeature) {
        if (config?.customFeatures?.includes(requiredCustomFeature)) {
            return <>{children}</>;
        }
        return null; // If customFeature is passed but missing in DB, hide it
    }

    // Default: If it passes all checks (or no restrictions were applied), show it!
    return <>{children}</>;
};

export default FeatureGuard;