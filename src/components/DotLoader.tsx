
import React from "react";

// Add a simple 3-dot animated loader component (uses Tailwind where possible)
const DotLoader = () => (
  <div className="flex justify-center items-center h-8">
    <span className="flex gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full bg-accent opacity-70 animate-[dot-bounce_1.2s_infinite_both]"></span>
      <span className="w-2.5 h-2.5 rounded-full bg-accent opacity-70 animate-[dot-bounce_1.2s_infinite_both] [animation-delay:0.2s]"></span>
      <span className="w-2.5 h-2.5 rounded-full bg-accent opacity-70 animate-[dot-bounce_1.2s_infinite_both] [animation-delay:0.4s]"></span>
    </span>
    <style>
      {`
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.7; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}
    </style>
  </div>
);

export default DotLoader;
