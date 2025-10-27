import React from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  return (
    <div className="relative group inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs font-medium text-text-primary bg-bg-primary border border-border rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 transform scale-95 group-hover:scale-100">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-border"></div>
      </div>
    </div>
  );
};