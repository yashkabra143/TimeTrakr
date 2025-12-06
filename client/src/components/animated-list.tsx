import React from 'react';
import { motion } from 'framer-motion';
import { containerVariants, listItemVariants } from '@/lib/animations';

interface AnimatedListProps {
  children: React.ReactNode;
  className?: string;
}

interface AnimatedListItemProps {
  children: React.ReactNode;
  className?: string;
}

export const AnimatedList = React.forwardRef<
  HTMLDivElement,
  AnimatedListProps
>(({ children, className }, ref) => (
  <motion.div
    ref={ref}
    variants={containerVariants}
    initial="hidden"
    animate="visible"
    className={className}
  >
    {children}
  </motion.div>
));

AnimatedList.displayName = 'AnimatedList';

export const AnimatedListItem = React.forwardRef<
  HTMLDivElement,
  AnimatedListItemProps
>(({ children, className }, ref) => (
  <motion.div
    ref={ref}
    variants={listItemVariants}
    className={className}
  >
    {children}
  </motion.div>
));

AnimatedListItem.displayName = 'AnimatedListItem';
