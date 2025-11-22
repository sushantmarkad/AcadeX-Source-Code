import React from 'react';
import { motion } from 'framer-motion';
import { iosSoftSpring } from '../animations/iosConfig';

const variants = {
  initial: { 
    x: "100%", 
    opacity: 0,
    boxShadow: "-5px 0px 15px rgba(0,0,0,0.1)" // Shadow for depth
  },
  animate: { 
    x: 0, 
    opacity: 1,
    transition: iosSoftSpring
  },
  exit: { 
    x: "-25%", // Parallax effect (leaves slower)
    opacity: 0,
    transition: { duration: 0.3, ease: "easeInOut" }
  }
};

const IOSPage = ({ children }) => {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ 
        width: "100%", 
        height: "100%", 
        position: "absolute", 
        overflowX: "hidden",
        background: "#fff" // Ensure no transparency overlap
      }}
    >
      {children}
    </motion.div>
  );
};

export default IOSPage;