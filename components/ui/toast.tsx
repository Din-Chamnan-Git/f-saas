"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

let toastId = 0;
const listeners: Set<(toast: Toast) => void> = new Set();

export function showToast(message: string, type: ToastType = "success") {
  const id = String(toastId++);
  const toast: Toast = { id, message, type };
  listeners.forEach((listener) => listener(toast));
  return id;
}

export function Toast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleNewToast = (toast: Toast) => {
      setToasts((prev) => [...prev, toast]);
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3000); // Auto-dismiss after 3 seconds
      return () => clearTimeout(timer);
    };

    listeners.add(handleNewToast);
    return () => {
      listeners.delete(handleNewToast);
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg text-sm font-medium animate-in slide-in-from-bottom fade-in-0 ${
            toast.type === "success"
              ? "bg-[#2d5f2e] text-[#bff2c7] border border-[#4a8f4e]"
              : toast.type === "error"
                ? "bg-[#5f2d2d] text-[#ff9b7a] border border-[#8f4a4a]"
                : "bg-[#2d3f5f] text-[#a8c5e8] border border-[#4a6f8f]"
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
