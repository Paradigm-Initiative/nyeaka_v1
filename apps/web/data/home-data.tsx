// Copy lives in messages/*.json (namespaces `nav`, `footer`, `home`). Only ids and hrefs here.
export const trustPointIds = [1, 2, 3] as const;
export const howItWorksIds = [1, 2, 3] as const;

export const navigationLinks = [
  { key: "browse", href: "/listings" },
  { key: "requests", href: "/requests" },
  { key: "howItWorks", href: "/#how-it-works" },
] as const;

export const footerLinks = [
  { key: "privacy", href: "/privacy" },
  { key: "terms", href: "/terms" },
  { key: "contact", href: "/contact" },
] as const;
