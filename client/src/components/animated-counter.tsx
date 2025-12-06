import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface AnimatedCounterProps {
  value: number | string;
  duration?: number;
  format?: (value: number) => string;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1.5,
  format = (v) => v.toString(),
  className,
}) => {
  const [displayValue, setDisplayValue] = React.useState(0);
  const countRef = useRef<{ current: number }>({ current: 0 });

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  useEffect(() => {
    let startTime: number;
    let animationId: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = (currentTime - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);

      const current = numValue * progress;
      setDisplayValue(Math.floor(current * 100) / 100);

      if (progress < 1) {
        animationId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(numValue);
      }
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [numValue, duration]);

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {format(displayValue)}
    </motion.span>
  );
};
