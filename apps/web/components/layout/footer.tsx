import Link from "next/link";
import React from "react";

const Footer = () => {
  return (
    <footer className="flex flex-col bg-gray-800 w-full">
      <div className="flex flex-col justify-center items-center mx-auto w-full h-16 text-white container">
        <p className="text-sm">
          &copy; {new Date().getFullYear()}{" "}
          <Link
            href="https://paradigmhq.org"
            target="_blank"
            className="hover:text-gray-400"
          >
            Paradigm Initiative
          </Link>
          . All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
