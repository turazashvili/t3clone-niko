
import React from "react";

// 3-dot animated loader component (custom CSS, not Tailwind)
const DotLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 32 }}>
    <span className="dot-loader">
      <span className="dot" />
      <span className="dot" />
      <span className="dot" />
    </span>
    <style>{`
      .dot-loader {
        display: flex;
        gap: 0.5em;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #e879f9;
        opacity: 0.7;
        animation: dot-bounce 1.2s infinite both;
      }
      .dot:nth-child(2) { animation-delay: 0.2s; }
      .dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes dot-bounce {
        0%, 80%, 100% { transform: scale(0.8); opacity: 0.7; }
        40% { transform: scale(1.2); opacity: 1; }
      }
    `}</style>
  </div>
);

export default DotLoader;
