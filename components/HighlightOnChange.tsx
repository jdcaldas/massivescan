import React, { useState, useEffect, useRef } from 'react';

interface HighlightOnChangeProps {
  value: number | string;
  className?: string;
}

const HighlightOnChange: React.FC<HighlightOnChangeProps> = ({ value, className = '' }) => {
  const [highlight, setHighlight] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      setHighlight(true);
      const timer = setTimeout(() => {
        setHighlight(false);
      }, 5000);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <span 
      className={`transition-colors duration-500 ${highlight ? 'bg-brand-primary/40 text-brand-text font-bold rounded px-1' : 'bg-transparent'} ${className}`}
    >
      {value}
    </span>
  );
};

export default HighlightOnChange;
