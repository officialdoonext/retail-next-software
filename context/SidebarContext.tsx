"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { SIDEBAR_NAV } from "@/lib/nav-pages";

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  openAccordions: Record<string, boolean>;
  setOpenAccordions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  toggleAccordion: (groupId: string) => void;
  openAccordion: (groupId: string) => void;
  setAllAccordions: (open: boolean) => void;
  areAllOpen: boolean;
  hasInteracted: boolean;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  // Default all managers to expanded
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    SIDEBAR_NAV.forEach((group) => {
      if (group.children) {
        initial[group.id] = true;
      }
    });
    return initial;
  });

  // Restore saved collapse state safely on client mount without hydration mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved === "true") {
        setIsCollapsed(true);
      }
    } catch {}
  }, []);

  const toggleSidebar = useCallback(() => {
    setHasInteracted(true);
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  }, []);

  const toggleAccordion = useCallback((groupId: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, []);

  const openAccordion = useCallback((groupId: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [groupId]: true,
    }));
  }, []);

  const setAllAccordions = useCallback((open: boolean) => {
    const updated: Record<string, boolean> = {};
    SIDEBAR_NAV.forEach((group) => {
      if (group.children) {
        updated[group.id] = open;
      }
    });
    setOpenAccordions(updated);
  }, []);

  const areAllOpen = SIDEBAR_NAV.filter((g) => g.children).every(
    (g) => openAccordions[g.id]
  );

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleSidebar,
        openAccordions,
        setOpenAccordions,
        toggleAccordion,
        openAccordion,
        setAllAccordions,
        areAllOpen,
        hasInteracted,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
