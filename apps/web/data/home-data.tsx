import { ShieldCheck, Earth, Handshake } from "lucide-react";
import React from "react";
import { CardDetail, HowItWorksItems, ShortListing } from "../types/types";

export const cardDetails: CardDetail[] = [
  {
    id: 1,
    title: "Verified Identities",
    description:
      "Trusted users only. Every participant undergoes a secure identity check.",
    bgColor: "bg-green-300",
    icon: <ShieldCheck className="size-8 text-green-50" />,
  },
  {
    id: 2,
    title: "Country-matched",
    description:
      "Local matching within the same country to ensure fast, reliable delivery.",
    bgColor: "bg-green-900",
    icon: <Earth className="size-8 text-green-50" />,
  },
  {
    id: 3,
    title: "No Middlemen",
    description: "Direct communication between users without intermediaries.",
    bgColor: "bg-amber-950",
    icon: <Handshake className="size-8 text-gray-50" />,
  },
];

export const howItWorksData: HowItWorksItems = {
  forRequesters: [
    {
      id: 1,
      title: "Sign up and verify identity",
      description:
        "Create an account and complete a simple verification process to ensure a trusted community.",
    },
    {
      id: 2,
      title: "Browse available devices",
      description:
        "Search for laptops, tablets, or phones that meet your educational or professional needs.",
    },
    {
      id: 3,
      title: "Request a match",
      description:
        "Connect with donors and arrange secure, shipping/delivery once matched.",
    },
  ],
  forDonors: [
    {
      id: 1,
      title: "List your working device",
      description:
        "Provide simple details about your device's condition and specifications.",
    },
    {
      id: 2,
      title: "Get matched with a requester",
      description:
        "Review requester profiles and choose who you'd like to support.",
    },
    {
      id: 3,
      title: "Secure delivery",
      description: "Securely transport your device to the requester's address.",
    },
  ],
};

export const sampleListings: ShortListing[] = [
  {
    id: "1",
    condition: "Like New",
    model: "MacBook Air M1",
    deviceType: "LAPTOP",
    country: "Kenya",
    ram: 8,
    storage: 256,
  },
  {
    id: "2",
    condition: "Good",
    model: "iPad Pro 2020",
    deviceType: "TABLET",
    country: "Nigeria",
    ram: 6,
    storage: 128,
  },
  {
    id: "3",
    condition: "Fair",
    model: "Samsung Galaxy S10",
    deviceType: "SMARTPHONE",
    country: "Ghana",
    ram: 8,
    storage: 512,
  },
];
