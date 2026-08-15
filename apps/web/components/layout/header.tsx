"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { navigationLinks } from "@/data/home-data";
import NavLink from "../ui/navigation-link";
import { useSession } from "@/lib/auth-client";
import { UserDropdown } from "../user-dropdown";

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: session, isPending } = useSession();

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  return (
    <header className="top-0 z-50 sticky bg-canvas-dark w-full">
      <div className="flex justify-between items-center mx-auto w-full h-16 text-pin-gray-50 container">
        <Link
          href="/"
          className="font-heading font-bold text-lg"
          aria-label="Nyeaka home"
        >
          Nyeaka
        </Link>

        <nav className="hidden md:block" aria-label="Main navigation">
          <ul className="flex items-center space-x-6">
            {navigationLinks.map((link) => (
              <li key={link.href}>
                <NavLink
                  href={link.href}
                  className="font-medium text-sm"
                  activeClassName="text-pin-gray-50 font-semibold"
                  inactiveClassName="text-pin-gray-400 hover:text-pin-gray-50"
                >
                  {link.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden md:flex items-center space-x-3">
          {isPending ? (
            <div className="bg-white/10 rounded-md w-24 h-9 animate-pulse" />
          ) : session ? (
            <UserDropdown />
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hover:bg-white/10 px-4 py-2 rounded-md font-medium text-pin-gray-50 text-sm transition-colors duration-300"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="bg-white hover:bg-pin-gray-100 px-4 py-2 rounded-md font-medium text-pin-gray-900 text-sm transition-colors duration-300"
              >
                Create account
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden text-pin-gray-50"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-canvas-dark border-white/10 border-t">
          <nav
            className="flex flex-col gap-1 px-4 py-4 container"
            aria-label="Mobile navigation"
          >
            {navigationLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                className="px-2 py-2.5 rounded-md font-medium text-sm"
                activeClassName="text-pin-gray-50 bg-white/10"
                inactiveClassName="text-pin-gray-400 hover:text-pin-gray-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </NavLink>
            ))}
            <div className="flex flex-col gap-2 mt-3 pt-3 border-white/10 border-t">
              {session ? (
                <UserDropdown />
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    className="px-2 py-2.5 rounded-md font-medium text-pin-gray-50 text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    className="bg-white px-4 py-2.5 rounded-md font-medium text-pin-gray-900 text-sm text-center"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Create account
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
