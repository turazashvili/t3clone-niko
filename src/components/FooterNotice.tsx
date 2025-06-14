
import React from "react";

const FooterNotice: React.FC = () => (
  <div className="text-xs text-white/40 mt-2 text-center">
    Make sure you agree to our{" "}
    <a href="#" className="underline hover:text-accent">Terms</a>
    {" "}and{" "}
    <a href="#" className="underline hover:text-accent">Privacy Policy</a>
  </div>
);

export default FooterNotice;
