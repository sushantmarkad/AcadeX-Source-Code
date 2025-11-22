import { iosSpring } from './iosConfig';

export const sidebarVariants = {
  open: {
    x: 0,
    transition: iosSpring
  },
  closed: {
    x: "-100%",
    transition: { ...iosSpring, stiffness: 400, damping: 40 }
  }
};

export const overlayVariants = {
  open: {
    opacity: 1,
    pointerEvents: "auto",
    transition: { duration: 0.3 }
  },
  closed: {
    opacity: 0,
    pointerEvents: "none",
    transition: { duration: 0.2 }
  }
};