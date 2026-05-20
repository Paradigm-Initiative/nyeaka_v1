import React from "react";
import Link from "next/link";

const Header = () => {
  return (
    <header className="flex bg-gray-800 w-full">
      <div className="flex justify-between items-center mx-auto w-full h-16 text-white container">
        <h1 className="font-bold text-lg">Nyeaka</h1>
        <nav>
          <ul className="flex space-x-4">
            <li>
              <Link href="/" className="hover:text-gray-400">
                Home
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-gray-400">
                About
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-gray-400">
                Contact
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
