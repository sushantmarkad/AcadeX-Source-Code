import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; 
import './Onboarding.css'; 

const slides = [
  {
    id: 1,
    title: "Welcome to Trackee",
    desc: "Your smart campus companion. Manage attendance, track progress, and stay updated effortlessly.",
    image: "https://cdn-icons-png.flaticon.com/512/3063/3063823.png",
    color: "#4f46e5" // Indigo
  },
  {
    id: 2,
    title: "Smart Attendance",
    desc: "Mark attendance instantly using secure QR codes, Biometrics, or Geo-fencing.",
    image: "https://cdn-icons-png.flaticon.com/512/9322/9322127.png",
    color: "#0ea5e9" // Sky Blue
  },
  {
    id: 3,
    title: "AI & Career Growth",
    desc: "Unlock AI-powered study tools and personalized career roadmaps for your future.",
    image: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
    color: "#8b5cf6" // Violet
  }
];

// Animation Variants
const imageVariants = {
  hidden: { opacity: 0, scale: 0.5, y: 50 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 120, damping: 20 }
  },
  exit: { opacity: 0, scale: 0.8, y: -50, transition: { duration: 0.2 } }
};

const textVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { type: "spring", stiffness: 100, damping: 20, delay: 0.1 }
  },
  exit: { opacity: 0, x: -50, transition: { duration: 0.2 } }
};

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

  const handleBack = () => {
    if (current > 0) {
      setCurrent(current - 1);
    }
  };

  const finishOnboarding = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    navigate('/login');
  };

  return (
    <div className="onboarding-container">
      {/* 🎨 Dynamic Background Gradient */}
      <div 
        className="liquid-bg" 
        style={{ 
          background: `radial-gradient(circle at 50% 30%, ${slides[current].color}40 0%, transparent 70%)` 
        }} 
      />
      <div className="mesh-overlay"></div>

      {/* 🔝 Safe Area Header */}
      <header className="safe-header">
        <div className="brand-pill">
          <span className="brand-dot" style={{ background: slides[current].color }}></span>
          trackee
        </div>
        <button className="skip-btn" onClick={finishOnboarding}>Skip</button>
      </header>

      {/* 🖼️ Main Content Area */}
      <div className="visual-stage">
        <AnimatePresence mode='wait'>
          <motion.img 
            key={slides[current].id}
            src={slides[current].image} 
            alt="Onboarding Visual" 
            className="hero-image"
            variants={imageVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          />
        </AnimatePresence>
      </div>

      {/* 📄 Glass Bottom Sheet */}
      <div className="glass-sheet">
        
        {/* Text Content */}
        <div className="text-content">
          <AnimatePresence mode='wait'>
            <motion.div 
              key={slides[current].id}
              variants={textVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <h1 className="title">
                {slides[current].title.split(" ").map((word, i) => (
                  <span key={i} style={{ display: "inline-block", marginRight: "8px" }}>
                    {word === "Trackee" ? <span style={{ color: slides[current].color }}>Trackee</span> : word}
                  </span>
                ))}
              </h1>
              <p className="description">{slides[current].desc}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls Footer */}
        <div className="controls-footer">
          {/* Progress Indicators */}
          <div className="dots-container">
            {slides.map((_, idx) => (
              <motion.div 
                key={idx} 
                className={`dot ${current === idx ? 'active' : ''}`}
                animate={{ 
                  width: current === idx ? 32 : 8,
                  backgroundColor: current === idx ? slides[current].color : "#cbd5e1"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
            ))}
          </div>

          {/* Buttons Group */}
          <div className="buttons-group">
            {current > 0 && (
               <button className="back-btn" onClick={handleBack}>
                 <i className="fas fa-arrow-left"></i>
               </button>
            )}
            
            <motion.button 
              className="next-fab" 
              onClick={handleNext}
              whileTap={{ scale: 0.9 }}
              style={{ background: slides[current].color, boxShadow: `0 10px 25px ${slides[current].color}60` }}
            >
              {current === slides.length - 1 ? <i className="fas fa-check"></i> : <i className="fas fa-arrow-right"></i>}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}