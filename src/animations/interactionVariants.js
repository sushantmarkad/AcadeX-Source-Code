import { iosSpring } from './iosConfig';

// 4. Bottom Tab Bar Icon Bounce
export const tabIconVariants = {
  inactive: { scale: 1, color: "#9ca3af" },
  active: { 
    scale: 1.2, 
    color: "#3b82f6",
    transition: iosSpring 
  },
  tap: { scale: 0.9 } // Shrink slightly on touch
};

// 7. Card Flip Animation
export const cardFlipVariants = {
  front: {
    rotateY: 0,
    transition: { duration: 0.6, ease: "backOut" }
  },
  back: {
    rotateY: 180,
    transition: { duration: 0.6, ease: "backOut" }
  }
};

// Extra: iOS Button Tap Effect (Shrink on click)
export const buttonTap = {
  scale: 0.95,
  opacity: 0.8,
  transition: { duration: 0.1 }
};