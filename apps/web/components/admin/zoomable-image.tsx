"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/** Admin only, English only. Click to open full screen; click again to zoom in and scroll around; Esc closes. */
export default function ZoomableImage({ src, label }: { src: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setOpen(false), setZoomed(false));
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="cursor-zoom-in" aria-label={`Enlarge ${label}`}>
        <Image src={src} alt={label} width={600} height={400} unoptimized className="rounded-sm w-full h-auto" />
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={label} className="z-50 fixed inset-0 flex flex-col bg-black/90">
          <div className="flex justify-between items-center p-3 text-white text-body-sm">
            <span>{label} · {zoomed ? "click to fit" : "click to zoom"}</span>
            <button type="button" onClick={() => { setOpen(false); setZoomed(false); }} className="px-3 py-1 border border-white/40 rounded-sm">
              Close (Esc)
            </button>
          </div>
          <div className="flex-1 p-3 overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={label}
              onClick={() => setZoomed((z) => !z)}
              className={zoomed ? "max-w-none w-[250%] cursor-zoom-out" : "mx-auto max-h-full max-w-full object-contain cursor-zoom-in"}
            />
          </div>
        </div>
      )}
    </>
  );
}
