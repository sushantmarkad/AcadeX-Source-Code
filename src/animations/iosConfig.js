// src/animations/iosConfig.js

// ✅ UPDATED: Faster, Snappier iOS Physics
export const iosSpring = {
  type: "spring",
  stiffness: 1000, // Increased from 500 (Higher = Faster)
  damping: 40,     // Adjusted to prevent bouncing
  mass: 0.8        // Decreased from 1 (Lighter = Faster)
};

export const iosSoftSpring = {
  type: "spring",
  stiffness: 500,
  damping: 30
};

export const iosEase = [0.25, 0.1, 0.25, 1];