import React from 'react';
import { motion } from 'framer-motion';
import { emptyStateVariants, pulseVariants } from '@/lib/animations';

interface AnimatedEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  pulse?: boolean;
}

export const AnimatedEmptyState: React.FC<AnimatedEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  pulse = false,
}) => {
  return (
    <motion.div
      variants={emptyStateVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      {icon && (
        <motion.div
          variants={pulse ? pulseVariants : undefined}
          animate={pulse ? "animate" : undefined}
          className="mb-4"
        >
          {icon}
        </motion.div>
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          {description}
        </p>
      )}
      {action}
    </motion.div>
  );
};
