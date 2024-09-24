import React from 'react';

export const Background = () => {
  return (
    <div className="fixed inset-0 z-0">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-indigo-900"></div>
      <div className="absolute inset-0 opacity-10">
        {/* You can add some SVG patterns or images here for texture */}
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <defs>
            <pattern id="teddy-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M20 5 A15 15 0 0 1 20 35 A15 15 0 0 1 20 5" fill="none" stroke="currentColor" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#teddy-pattern)"/>
        </svg>
      </div>
    </div>
  );
};