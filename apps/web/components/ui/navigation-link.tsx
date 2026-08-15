"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className">;

const NavLink = ({
  href,
  children,
  className,
  activeClassName = "text-white font-semibold",
  inactiveClassName = "hover:text-gray-400",
  ...props
}: NavLinkProps) => {
  const pathname = usePathname();

  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "transition-colors duration-300",
        className,
        isActive ? activeClassName : inactiveClassName,
      )}
      {...props}
    >
      {children}
    </Link>
  );
};

export default NavLink;
