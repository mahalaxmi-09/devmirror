import React from 'react';

const Waveform = ({ state }) => {
  if (state === 'READY' || state === 'WAITING FOR EVIDENCE') {
    return (
      <div className="flex items-center gap-1.5 h-16 justify-center">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div
            key={i}
            className="w-1 bg-border-default rounded-full transition-all duration-300"
            style={{ height: '8px' }}
          />
        ))}
      </div>
    );
  }

  // Listening state: dynamic scrolling waves
  if (state === 'LISTENING') {
    return (
      <div className="flex items-end gap-1.5 h-16 justify-center">
        {[14, 28, 48, 32, 16, 28, 56, 38, 22, 12].map((height, i) => (
          <div
            key={i}
            className={`w-1 bg-brand-primary rounded-full animate-wave wave-delay-${(i % 5) + 1}`}
            style={{ height: `${height}px`, animationDuration: `${0.8 + (i % 3) * 0.2}s` }}
          />
        ))}
      </div>
    );
  }

  // Processing or understanding state: rapid flickering waves
  if (state === 'PROCESSING' || state === 'UNDERSTANDING') {
    return (
      <div className="flex items-center gap-1.5 h-16 justify-center">
        {[20, 24, 30, 26, 20, 24, 30, 26, 20, 24].map((height, i) => (
          <div
            key={i}
            className="w-1 bg-brand-accent rounded-full animate-pulse"
            style={{
              height: `${height}px`,
              animationDelay: `${i * 0.1}s`,
              animationDuration: '0.6s'
            }}
          />
        ))}
      </div>
    );
  }

  return null;
};

export default Waveform;
