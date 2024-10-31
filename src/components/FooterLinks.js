import React from "react";

const FooterLinks = ({ onAbout, onShare }) => {
  return (
    <div className="fixed bottom-0 z-10 mb-5 text-xl text-gray-700 transform -translate-x-1/2 left-1/2">
      <a href="about" onClick={onAbout} className="underline">
        About
      </a>
    </div>
  );
};

export default FooterLinks;
