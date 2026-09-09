// src/OnbordaContext.tsx
//
// Ported from uixmat/onborda (MIT license) — https://github.com/uixmat/onborda
// This file is close to a verbatim copy: it's generic tour-state plumbing,
// not app-specific, so there was nothing to adapt here beyond dropping the
// Next.js "use client" directive (meaningless in a Vite app).

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface OnbordaContextType {
  currentStep: number;
  currentTour: string | null;
  setCurrentStep: (step: number, delay?: number) => void;
  closeOnborda: () => void;
  startOnborda: (tourName: string) => void;
  isOnbordaVisible: boolean;
}

const OnbordaContext = createContext<OnbordaContextType | undefined>(undefined);

export const useOnborda = () => {
  const context = useContext(OnbordaContext);
  if (context === undefined) {
    throw new Error('useOnborda must be used within an OnbordaProvider');
  }
  return context;
};

export const OnbordaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTour, setCurrentTour] = useState<string | null>(null);
  const [currentStep, setCurrentStepState] = useState(0);
  const [isOnbordaVisible, setOnbordaVisible] = useState(false);

  const setCurrentStep = useCallback((step: number, delay?: number) => {
    if (delay) {
      setTimeout(() => {
        setCurrentStepState(step);
        setOnbordaVisible(true);
      }, delay);
    } else {
      setCurrentStepState(step);
      setOnbordaVisible(true);
    }
  }, []);

  const closeOnborda = useCallback(() => {
    setOnbordaVisible(false);
    setCurrentTour(null);
  }, []);

  const startOnborda = useCallback((tourName: string) => {
    setCurrentTour(tourName);
    setCurrentStepState(0);
    setOnbordaVisible(true);
  }, []);

  return (
    <OnbordaContext.Provider
      value={{ currentTour, currentStep, setCurrentStep, closeOnborda, startOnborda, isOnbordaVisible }}
    >
      {children}
    </OnbordaContext.Provider>
  );
};
