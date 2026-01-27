import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; 
import './Onboarding.css'; 

const slides = [
  {
    id: 1,
    title: "Welcome to AcadeX",
    desc: "Your smart campus companion. Manage attendance, track progress, and stay updated effortlessly.",
    image: "https://cdn-icons-png.flaticon.com/512/3063/3063823.png" 
  },
  {
    id: 2,
    title: "Smart Attendance",
    desc: "Mark attendance instantly using secure QR codes, Biometrics, or Geo-fencing.",
    image: "https://cdn-icons-png.flaticon.com/512/9322/9322127.png"
  },
  {
    id: 3,
    title: "AI & Career Growth",
    desc: "Unlock AI-powered study tools and personalized career roadmaps for your future.",
    image: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png"
  }
];

export default function Onboarding() {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (current < slides.length - 1) {
      setCurrent(current + 1);
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    navigate('/login');
  };

  return (
    <div className="onboarding-container">
      {/* Moving Mesh Gradient Background */}
      <div className="gradient-bg"></div>

      {/* Header */}
      <div className="onboarding-header">
        <span className="brand-pill">AcadeX</span>
        <div className="skip-btn" onClick={finishOnboarding}>Skip</div>
      </div>

      {/* Floating Image Section */}
      <div className="image-section">
        <AnimatePresence mode='wait'>
          <motion.img 
            key={current}
            src={slides[current].image} 
            alt="Slide" 
            className="slide-image"
            initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              rotate: 0,
              y: [0, -15, 0] // Floating Effect
            }}
            exit={{ opacity: 0, scale: 0.9, rotate: 5 }}
            transition={{ 
              opacity: { duration: 0.4 },
              scale: { duration: 0.4 },
              y: { duration: 3, repeat: Infinity, ease: "easeInOut" } // Continuous Float
            }}
          />
        </AnimatePresence>
      </div>

      {/* Glassmorphism Bottom Card */}
      <div className="glass-card">
        <div className="content-wrapper">
          <AnimatePresence mode='wait'>
            <motion.div 
              key={current}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="slide-title">{slides[current].title}</h2>
              <p className="slide-desc">{slides[current].desc}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="footer-row">
          <div className="dots-wrapper">
            {slides.map((_, idx) => (
              <div key={idx} className={`dot ${current === idx ? 'active' : ''}`} />
            ))}
          </div>

          <motion.button 
            className="next-fab" 
            onClick={handleNext}
            whileTap={{ scale: 0.9 }}
          >
            {current === slides.length - 1 ? "GO" : <i className="fas fa-chevron-right"></i>}
          </motion.button>
        </div>
      </div>
    </div>
  );
}