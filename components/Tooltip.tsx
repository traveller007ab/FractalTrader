import React from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
  };

  const arrowClasses = {
    top: 'top-full border-t-border border-b-0',
    bottom: 'bottom-full border-b-border border-t-0',
  };

  return (
    <div className="relative group inline-block">
      {children}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 w-max max-w-xs p-2 text-xs font-medium text-text-primary bg-bg-primary border border-border rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 transform scale-95 group-hover:scale-100 ${positionClasses[position]}`}
      >
        {content}
        <div className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-4 ${arrowClasses[position]}`}></div>
      </div>
    </div>
  );
};