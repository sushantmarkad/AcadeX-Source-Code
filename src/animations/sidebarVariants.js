// src/animations/sidebarVariants.js
import { iosSpring } from './iosConfig';

export const sidebarVariants = {
  open: {
    x: 0,
    transition: iosSpring
  },
  closed: {
    x: "-100%",
    // ✅ FIX: Use 'iosSpring' directly for fast closing (Removed the slow override)
    transition: iosSpring 
  }
};

export const overlayVariants = {
  open: {
    opacity: 1,
    pointerEvents: "auto",
    transition: { duration: 0.2 } // Made faster (was 0.3)
  },
  closed: {
    opacity: 0,
    pointerEvents: "none",
    transition: { duration: 0.1 } // Made faster (was 0.2)
  }
};