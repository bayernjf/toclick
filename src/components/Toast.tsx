"use client";

import { useEffect, useState } from "react";

type ToastType = "info" | "error" | "success";

type Props = {
  message: string;
  type?: ToastType;
  onClose: () => void;
};

// Toast 形式提醒，不用红色框框
export default function Toast({ message, type = "info", onClose }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
    const t = setTimeout(() => {
      setShow(false);
      setTimeout(onClose, 200);
    }, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  const bg =
    type === "error"
      ? "bg-ink-800/90"
      : type === "success"
      ? "bg-success-500/90"
      : "bg-ink-800/90";

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-full text-white text-sm shadow-lg transition-all duration-200 ${bg} ${
        show ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      {message}
    </div>
  );
}
