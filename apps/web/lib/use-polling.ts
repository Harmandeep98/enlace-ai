"use client";

import { useEffect, useRef } from "react";

export function usePolling(callback: () => void, shouldPoll: boolean, intervalMs = 4000): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!shouldPoll) return;
    const id = setInterval(() => savedCallback.current(), intervalMs);
    return () => clearInterval(id);
  }, [shouldPoll, intervalMs]);
}
