import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardProps } from '@/components/ui/card';
import { cardVariants } from '@/lib/animations';

interface AnimatedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  index?: number;
  delay?: number;
  children: React.ReactNode;
}

export const AnimatedCard = React.forwardRef<
  HTMLDivElement,
  AnimatedCardProps
>(({ index = 0, delay, children, className, ...props }, ref) => (
  <motion.div
    ref={ref}
    variants={cardVariants}
    initial="hidden"
    animate="visible"
    custom={index}
    className={className}
    {...props}
  >
    <Card>{children}</Card>
  </motion.div>
));

AnimatedCard.displayName = 'AnimatedCard';
