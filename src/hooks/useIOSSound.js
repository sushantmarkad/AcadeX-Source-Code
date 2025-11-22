import { useCallback } from 'react';

// Map of sound effects
const sounds = {
  tap: "/sounds/tap.mp3",
  success: "/sounds/success.mp3",
  refresh: "/sounds/pop.mp3",
  lock: "/sounds/lock.mp3",
  error: "/sounds/error.mp3"
};

const useIOSSound = () => {
  const playSound = useCallback((type) => {
    const file = sounds[type];
    if (file) {
      const audio = new Audio(file);
      audio.volume = 0.5; // Subtle volume
      audio.play().catch(e => console.warn("Audio play failed", e));
    }
  }, []);

  return playSound;
};

export default useIOSSound;