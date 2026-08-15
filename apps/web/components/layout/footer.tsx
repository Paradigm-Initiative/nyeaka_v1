import React from "react";

const Footer = () => {
  return (
    <footer className="bg-canvas-dark w-full">
      <div className="flex flex-wrap justify-between items-center gap-4 py-6! section-wrapper">
        <span className="font-heading font-bold text-lg text-pin-gray-50">
          Nyeaka
        </span>
        <span className="max-w-[52ch] text-body-sm text-pin-gray-400">
          A free device-donation marketplace for Nigeria. No fees, no
          middlemen, no resale.
        </span>
      </div>
    </footer>
  );
};

export default Footer;
