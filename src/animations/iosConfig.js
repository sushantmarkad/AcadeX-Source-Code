// iOS Physics Standard
// 'stiffness' and 'damping' mimic the physical weight of iOS UI elements
export const iosSpring = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 1
};

export const iosSoftSpring = {
  type: "spring",
  stiffness: 300,
  damping: 30
};

// Smooth Easing for non-spring transitions
export const iosEase = [0.25, 0.1, 0.25, 1]; // Cubic bezier resembling iOS ease-in-out