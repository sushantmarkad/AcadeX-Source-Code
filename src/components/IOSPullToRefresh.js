import React, { useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { iosSoftSpring } from '../animations/iosConfig';

const IOSPullToRefresh = ({ onRefresh, children }) => {
  const y = useMotionValue(0);
  const rotate = useTransform(y, [0, 100], [0, 360]);
  const opacity = useTransform(y, [0, 50], [0, 1]);
  
  const handleDragEnd = async () => {
    if (y.get() > 80) {
      // Trigger Refresh
      await onRefresh();
    }
    // Snap back
    animate(y, 0, iosSoftSpring);
  };

  return (
    <div style={{ overflow: 'hidden', position: 'relative', height: '100%' }}>
      {/* Loading Indicator Layer */}
      <motion.div 
        style={{ 
          y, 
          position: 'absolute', 
          top: -50, 
          left: 0, 
          right: 0, 
          display: 'flex', 
          justifyContent: 'center',
          opacity 
        }}
      >
        <motion.div style={{ rotate, fontSize: 24 }}>
           ↻
        </motion.div>
      </motion.div>

      {/* Content Layer */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2} // Rubber band resistance
        style={{ y, height: '100%' }}
        onDragEnd={handleDragEnd}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default IOSPullToRefresh;