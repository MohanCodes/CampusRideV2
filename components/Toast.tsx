"use client";

import { useEffect, useState } from "react";

// A quiet confirmation that goes away by itself. Screen readers hear it as a status message.
export function Toast({ message, seconds = 6 }: { message: string; seconds?: number }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setVisible(false), seconds * 1000);
    return () => clearTimeout(id);
  }, [seconds]);
  if (!visible) return null;
  return (
    <div role="status" className="toast" data-testid="toast">
      {message}
    </div>
  );
}
