"use client";

import { useEffect } from "react";

function sanitizeErrorMessage(message: string): string {
  const msg = message.toLowerCase();
  if (
    msg.includes("secureconnect") ||
    msg.includes("connecttimeoutms") ||
    msg.includes("mongoserverselectionerror") ||
    msg.includes("econnrefused") ||
    msg.includes("socket timed out") ||
    msg.includes("connection timed out") ||
    msg.includes("timed out after") ||
    msg.includes("socket 'secureconnect' timed out")
  ) {
    return "We are experiencing connection issues. Please try again later.";
  }
  return message;
}

export default function FetchErrorSanitizer() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch(...args);
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const cloned = response.clone();
        try {
          const data = await cloned.json();
          let modified = false;
          
          if (data && typeof data === "object") {
            if (data.message && typeof data.message === "string") {
              const sanitized = sanitizeErrorMessage(data.message);
              if (sanitized !== data.message) {
                data.message = sanitized;
                modified = true;
              }
            }
            if (data.error && typeof data.error === "string") {
              const sanitized = sanitizeErrorMessage(data.error);
              if (sanitized !== data.error) {
                data.error = sanitized;
                modified = true;
              }
            }
          }
          
          if (modified) {
            return new Response(JSON.stringify(data), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
      
      return response;
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
