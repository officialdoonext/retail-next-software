"use client";

import { useEffect } from "react";

export default function PwaUpdater() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let refreshing = false;

    // Capture PWA install prompt globally so components can trigger native installation
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaInstallPrompt = e;
      window.dispatchEvent(new CustomEvent("pwa-prompt-available"));
    };

    const handleAppInstalled = () => {
      (window as any).__pwaInstallPrompt = null;
      window.dispatchEvent(new CustomEvent("pwa-installed"));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Detect when new service worker takes over and auto-refresh the installed PWA
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // 1. Immediately check for updates
        registration.update();

        // 2. When an update is detected, tell the new worker to skip waiting
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // New code deployed! Force activate immediately
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          }
        });

        // 3. Auto-check for updates every 30 seconds
        const intervalId = setInterval(() => {
          registration.update().catch(() => {});
        }, 30000);

        // 4. Also check for updates whenever the window/tab is focused
        const onFocus = () => {
          registration.update().catch(() => {});
        };

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        });

        return () => {
          clearInterval(intervalId);
          window.removeEventListener("focus", onFocus);
        };
      })
      .catch((err) => {
        console.log("Service Worker registration skipped:", err);
      });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return null;
}
