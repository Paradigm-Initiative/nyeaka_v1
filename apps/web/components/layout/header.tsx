"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { navigationLinks } from "@/data/home-data";
import NavLink from "../ui/navigation-link";
import { useSession } from "@/lib/auth-client";
import { UserDropdown } from "../user-dropdown"; // adjust path to your file

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: session, isPending } = useSession();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  return (
    <header
      className={cn(
        "top-0 left-0 z-50 fixed w-full transition-colors duration-300",
        isScrolled
          ? "bg-[#0B1F3A]/95 backdrop-blur-sm shadow-md"
          : "bg-transparent",
      )}
    >
      <div className="flex justify-between items-center mx-auto w-full h-16 text-white container">
        <Link href="/" className="font-bold text-lg" aria-label="Nyeaka home">
          Nyeaka
        </Link>

        <nav className="hidden md:block" aria-label="Main navigation">
          <ul className="flex space-x-6">
            {navigationLinks.map((link) => (
              <li key={link.href}>
                <NavLink
                  href={link.href}
                  className="hover:text-gray-300 transition-colors duration-300"
                >
                  {link.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Desktop auth area */}
        <div className="hidden md:flex items-center space-x-3">
          {isPending ? (
            // avoid a login/register flash while session is resolving
            <div className="bg-white/10 rounded-md w-24 h-9 animate-pulse" />
          ) : session ? (
            <UserDropdown />
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hover:bg-white/10 px-4 py-2 rounded-md font-medium text-sm transition-colors duration-300"
              >
                Login
              </Link>
              <Link
                href="/sign-up"
                className="bg-white hover:bg-gray-100 px-4 py-2 rounded-md font-medium text-[#0B1F3A] text-sm transition-colors duration-300"
              >
                Register
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </header>
  );
};

export default Header;
