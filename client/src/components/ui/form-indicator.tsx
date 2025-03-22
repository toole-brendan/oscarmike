import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { FormFeedback } from '@/lib/exercise-validation';

interface FormIndicatorProps {
  feedback: FormFeedback | null;
  className?: string;
}

const FormIndicator: React.FC<FormIndicatorProps> = ({
  feedback,
  className = '',
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    if (feedback) {
      setIsAnimating(true);
      const timeout = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [feedback]);
  
  if (!feedback) {
    return null;
  }
  
  const baseClasses = 'form-indicator px-4 py-2 rounded-full font-medium text-sm shadow-lg';
  
  const getColorClasses = () => {
    switch (feedback.severity) {
      case 'error':
        return 'bg-error text-white';
      case 'warning':
        return 'bg-yellow-500 text-white';
      case 'info':
        return feedback.isValid ? 'bg-green-500 text-white' : 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };
  
  return (
    <div
      className={cn(
        baseClasses,
        getColorClasses(),
        isAnimating && 'animate-pulse',
        className
      )}
    >
      {feedback.issue}
    </div>
  );
};

export default FormIndicator;
