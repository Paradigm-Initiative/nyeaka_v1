"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { navigationLinks } from "@/data/home-data";
import NavLink from "../ui/navigation-link";
import { useSession } from "@/lib/auth-client";
import { UserDropdown } from "../user-dropdown";
import { Button } from "../ui/button";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "./language-switcher";

const Header = () => {
  const t = useTranslations("header");
  const tNav = useTranslations("nav");
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
      <div className="flex justify-between items-center mx-auto w-full h-16 px-6 max-w-300 text-pin-gray-50">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-heading leading-none"
          aria-label={t("homeLabel")}
        >
          <Image
            src="/brand/paradigm-initiative-mark.png"
            alt=""
            width={512}
            height={512}
            priority
            className="size-9"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-bold text-lg">Nyeaka</span>
            <span className="font-semibold text-[11px] text-pin-gray-400 tracking-wide">
              {t("byParadigm")}
            </span>
          </span>
        </Link>

        <nav className="hidden md:block" aria-label={t("mainNav")}>
          <ul className="flex items-center space-x-6">
            {navigationLinks.map((link) => (
              <li key={link.href}>
                <NavLink
                  href={link.href}
                  className="font-medium text-sm"
                  activeClassName="text-pin-gray-50 font-semibold"
                  inactiveClassName="text-pin-gray-400 hover:text-pin-gray-50"
                >
                  {tNav(link.key)}
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
              <Button
                asChild
                variant="ghost"
                className="hover:bg-white/10 text-pin-gray-50 hover:text-pin-gray-50"
              >
                <Link href="/sign-in">{t("signIn")}</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">{t("createAccount")}</Link>
              </Button>
            </>
          )}
          <LanguageSwitcher />
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <LanguageSwitcher />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hover:bg-white/10 text-pin-gray-50 hover:text-pin-gray-50"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-label={isMobileMenuOpen ? t("closeMenu") : t("openMenu")}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </Button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-canvas-dark border-white/10 border-t">
          <nav
            className="flex flex-col gap-1 px-6 py-4 max-w-300 mx-auto w-full"
            aria-label={t("mobileNav")}
          >
            {navigationLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                className="flex items-center px-2 min-h-11 rounded-md font-medium text-sm"
                activeClassName="text-pin-gray-50 bg-white/10"
                inactiveClassName="text-pin-gray-400 hover:text-pin-gray-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {tNav(link.key)}
              </NavLink>
            ))}
            <div className="flex flex-col gap-2 mt-3 pt-3 border-white/10 border-t">
              {session ? (
                <UserDropdown />
              ) : (
                <>
                  <Button
                    asChild
                    variant="ghost"
                    className="justify-start hover:bg-white/10 text-pin-gray-50 hover:text-pin-gray-50"
                  >
                    <Link href="/sign-in" onClick={() => setIsMobileMenuOpen(false)}>
                      {t("signIn")}
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/sign-up" onClick={() => setIsMobileMenuOpen(false)}>
                      {t("createAccount")}
                    </Link>
                  </Button>
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
