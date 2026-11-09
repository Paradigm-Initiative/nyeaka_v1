"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { MAX_PHOTOS } from "@/validations/post-validation";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
};

const PhotoUploader = ({ value, onChange, onBusyChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Keep the latest list in a ref so parallel uploads don't overwrite each other.
  const urlsRef = useRef(value);
  useEffect(() => {
    urlsRef.current = value;
  }, [value]);
  const commit = (urls: string[]) => {
    urlsRef.current = urls;
    onChange(urls);
  };

  const pending = useRef(0);
  const bump = (delta: number) => {
    pending.current += delta;
    setUploading(pending.current);
    onBusyChange?.(pending.current > 0);
  };

  async function uploadOne(file: File): Promise<string> {
    const presign = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type, size: file.size }),
    });
    const body = await presign.json();
    if (!presign.ok) throw new Error(body.error ?? "Upload failed");
    const put = await fetch(body.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!put.ok) throw new Error("Upload failed. Please try again.");
    return body.publicUrl as string;
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_PHOTOS - urlsRef.current.length - pending.current;
    const picked = Array.from(files).slice(0, Math.max(room, 0));
    if (files.length > picked.length) setError(`You can add up to ${MAX_PHOTOS} photos.`);

    const valid = picked.filter((f) => {
      if (!ACCEPT.split(",").includes(f.type)) {
        setError("Use JPG, PNG or WebP photos.");
        return false;
      }
      if (f.size > MAX_BYTES) {
        setError("Each photo must be 5 MB or smaller.");
        return false;
      }
      return true;
    });
    if (!valid.length) return;

    bump(valid.length);
    await Promise.all(
      valid.map(async (file) => {
        try {
          const url = await uploadOne(file);
          commit([...urlsRef.current, url]);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Upload failed");
        } finally {
          bump(-1);
        }
      }),
    );
    if (inputRef.current) inputRef.current.value = "";
  }

  const remove = (url: string) => commit(urlsRef.current.filter((u) => u !== url));
  const full = value.length + uploading >= MAX_PHOTOS;

  return (
    <div className="flex flex-col gap-2.5">
      <span className="font-heading font-semibold text-heading-6">Photos</span>
      <div className="gap-3 grid grid-cols-2 sm:grid-cols-3">
        {value.map((url) => (
          <div key={url} className="relative rounded-sm h-28 overflow-hidden">
            <Image src={url} alt="Device photo" fill sizes="200px" className="object-cover" />
            <button
              type="button"
              onClick={() => remove(url)}
              aria-label="Remove photo"
              className="top-1.5 right-1.5 absolute flex justify-center items-center bg-black/60 rounded-full size-7 text-white"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div
            key={`u${i}`}
            className="flex justify-center items-center bg-pin-gray-50 rounded-sm h-28 text-muted-foreground text-body-sm animate-pulse"
          >
            Uploading…
          </div>
        ))}
        {!full && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-col justify-center items-center gap-1 border border-hairline-strong border-dashed rounded-sm h-28 text-muted-foreground text-body-sm"
          >
            <span className="text-pin-green-600 text-xl">+</span>
            <span>Add photo</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        data-testid="photo-input"
        onChange={(e) => onFiles(e.target.files)}
      />
      {error && (
        <span role="alert" className="font-semibold text-destructive text-xs">
          {error}
        </span>
      )}
      <span className="text-muted-foreground text-body-sm">
        Up to {MAX_PHOTOS} photos, JPG, PNG or WebP, 5 MB each. Photograph any damage too — it saves a wasted trip for both of you.
      </span>
    </div>
  );
};

export default PhotoUploader;
