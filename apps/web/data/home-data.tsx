import { ListItem, HowItWorksStep } from "../types/types";

export const trustPoints: ListItem[] = [
  {
    id: 1,
    title: "Nothing goes through us",
    description:
      "No shipping, no commission, no platform holding your device. You agree a public spot and hand it over yourself.",
  },
  {
    id: 2,
    title: "You see who you're meeting",
    description:
      "Everyone verifies their identity before they can list or request. Ratings and completed handoffs stay on the profile.",
  },
  {
    id: 3,
    title: "Free, and not for resale",
    description:
      "Requesters sign a no-resale pledge you can read before choosing. Money never enters the conversation.",
  },
];

export const howItWorksData: HowItWorksStep[] = [
  {
    id: 1,
    eyebrow: "Step one",
    title: "List it, or ask for one",
    description:
      "Device type, brand, condition, a photo, your area. Requesters post what they need and why.",
  },
  {
    id: 2,
    eyebrow: "Step two",
    title: "Get matched",
    description:
      "Requests come with a short note explaining the need. The donor reads them and chooses one person.",
  },
  {
    id: 3,
    eyebrow: "Step three",
    title: "Coordinate the handoff",
    description:
      "Chat in Nyeaka, agree a public spot, swap numbers only if you both want to. Both confirm when it's done.",
  },
];

export const navigationLinks = [
  {
    name: "Browse devices",
    href: "/listings",
  },
  {
    name: "Requests",
    href: "/requests",
  },
  {
    name: "How it works",
    href: "/#how-it-works",
  },
];

export const footerLinks = [
  {
    name: "Privacy Policy",
    href: "/privacy",
  },
  {
    name: "Terms of Service",
    href: "/terms",
  },
  {
    name: "Contact Us",
    href: "/contact",
  },
];
