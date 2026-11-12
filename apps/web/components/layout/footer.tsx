import Image from "next/image";
import Link from "next/link";
import React from "react";
import OrganicEdge from "./organic-edge";
import { getTranslations } from "next-intl/server";

const Footer = async () => {
  const t = await getTranslations("footer");
  return (
    <footer className="w-full">
      <OrganicEdge position="top" />
      <div className="bg-canvas-dark">
        <div className="flex flex-wrap justify-between items-center gap-6 py-8! section-wrapper">
          <div className="flex flex-col gap-2">
            <span className="font-heading font-bold text-pin-gray-50 text-lg">
              Nyeaka
            </span>
            <span className="max-w-[52ch] text-body-sm text-pin-gray-400">
              {t("tagline")}
            </span>
          </div>
          <Link
            href="https://www.paradigm-initiative.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-lg"
            aria-label={t("projectLabel")}
          >
            <span className="font-heading font-semibold text-pin-gray-600 text-xs uppercase tracking-wide">
              {t("projectOf")}
            </span>
            <Image
              src="/brand/paradigm-initiative-logo.png"
              alt="Paradigm Initiative"
              width={640}
              height={220}
              className="w-auto h-9"
            />
          </Link>
        </div>
        <div className="border-pin-gray-800 border-t w-full">
          <div className="flex flex-wrap justify-center items-center gap-4 py-2! section-wrapper">
            <span className="font-semibold text-body-sm text-pin-gray-400">
              {t.rich("rights", {
                year: new Date().getFullYear(),
                org: (chunks) => (
                  <Link
                    href="https://www.paradigm-initiative.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pin-gray-50 underline"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
