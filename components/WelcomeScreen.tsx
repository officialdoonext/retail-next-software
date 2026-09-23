"use client";

import React, { useState, useEffect, useRef } from "react";

interface WelcomeScreenProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

const STORAGE_KEY = "retail_welcome_shown";

export default function WelcomeScreen({ forceOpen = false, onClose }: WelcomeScreenProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Check sessionStorage on mount:
  // When software is closed and opened again, sessionStorage is fresh/cleared,
  // so the welcome screen will display.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const alreadyShown = sessionStorage.getItem(STORAGE_KEY);
      if (forceOpen || !alreadyShown) {
        setIsOpen(true);
      }
    }

    const handleCustomOpen = () => {
      setIsFadingOut(false);
      setIsOpen(true);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
        videoRef.current.play().catch(() => {});
      }
    };

    window.addEventListener("open-retail-welcome", handleCustomOpen);
    return () => window.removeEventListener("open-retail-welcome", handleCustomOpen);
  }, [forceOpen]);

  // Autoplay with sound automatically enabled - zero buttons
  useEffect(() => {
    if (isOpen && videoRef.current) {
      const video = videoRef.current;
      video.currentTime = 0;
      video.muted = false;
      video.volume = 1.0;

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // If browser strictly blocks sound before any user interaction,
          // play and automatically unmute on the earliest interaction (mouse movement, touch, click, key)
          video.muted = true;
          video.play().catch(() => {});

          const autoEnableSound = () => {
            if (videoRef.current) {
              videoRef.current.muted = false;
              videoRef.current.volume = 1.0;
            }
            window.removeEventListener("pointerdown", autoEnableSound);
            window.removeEventListener("touchstart", autoEnableSound);
            window.removeEventListener("keydown", autoEnableSound);
            window.removeEventListener("click", autoEnableSound);
            window.removeEventListener("mousemove", autoEnableSound);
          };

          window.addEventListener("pointerdown", autoEnableSound, { once: true });
          window.addEventListener("touchstart", autoEnableSound, { once: true });
          window.addEventListener("keydown", autoEnableSound, { once: true });
          window.addEventListener("click", autoEnableSound, { once: true });
          window.addEventListener("mousemove", autoEnableSound, { once: true });
        });
      }
    }
  }, [isOpen]);

  const handleVideoEnded = () => {
    // Smooth fade out before removing and revealing software
    setIsFadingOut(true);
    setTimeout(() => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEY, "true");
      }
      setIsOpen(false);
      setIsFadingOut(false);
      if (onClose) onClose();
    }, 400);
  };

  const handleVideoError = () => {
    // Fallback if video fails to load so user is never stuck
    console.error("Welcome video error, proceeding to software.");
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, "true");
    }
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] w-screen h-screen bg-[#f3f4f6] flex items-center justify-center overflow-hidden transition-opacity duration-400 select-none ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* 16:9 Aspect Ratio and 100% Width Video Container on Light Gray background - No buttons, No actions */}
      <div className="w-full aspect-video flex items-center justify-center bg-[#f3f4f6]">
        <video
          ref={videoRef}
          src="/intro.mp4"
          autoPlay
          playsInline
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          className="w-full h-full object-contain aspect-video"
        />
      </div>
    </div>
  );
}
