import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { navigationLinks } from "@/data/home-data";
import NavLink from "../ui/navigation-link";

const Header = () => {
  return (
    <header className="flex bg-gray-800 w-full">
      <div className="flex justify-between items-center mx-auto w-full h-16 text-white container">
        <Link href="/" className="font-bold text-lg">
          <h1 className="font-bold text-lg">Nyeaka</h1>
        </Link>
        <nav>
          <ul className="flex space-x-4">
            {navigationLinks.map((link, index) => (
              <li key={index}>
                <NavLink
                  href={link.href}
                  className={cn(
                    "hover:text-gray-400",
                    "transition-colors duration-300",
                  )}
                >
                  {link.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center space-x-4">
          <Link href="/login" className="hover:text-gray-400">
            Login
          </Link>
          <Link href="/register" className="hover:text-gray-400">
            Register
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
