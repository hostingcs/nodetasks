"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function Analytics() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/admin")) return;
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    const params = new URLSearchParams({
      p: pathname,
      r: document.referrer || "",
      t: String(Date.now()),
    });
    const img = new window.Image();
    img.src = `/api/pixel?${params.toString()}`;
  }, [pathname]);

  return null;
}
