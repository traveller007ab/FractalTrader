import React, { useState, useEffect, useRef } from 'react';

const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatter: (value: number) => string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 500, formatter }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const frameRef = useRef<number>();
  const startValueRef = useRef(value);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    startValueRef.current = displayValue;
    startTimeRef.current = Date.now();

    const animate = () => {
      const now = Date.now();
      const timePassed = now - startTimeRef.current;
      const progress = Math.min(timePassed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      const currentValue = startValueRef.current + (value - startValueRef.current) * easedProgress;
      
      setDisplayValue(currentValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
         // Ensure final value is exact
        setDisplayValue(value);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, duration]);

  return <>{formatter(displayValue)}</>;
};