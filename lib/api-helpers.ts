import { NextResponse } from "next/server";

type CacheControl = {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  isPrivate?: boolean;
};

export function jsonResponse<T>(data: T, init?: ResponseInit & { cache?: CacheControl }) {
  const { cache, ...responseInit } = init || {};
  const headers = new Headers(responseInit?.headers);

  if (cache) {
    const parts: string[] = [];
    if (cache.isPrivate) parts.push("private");
    else parts.push("public");
    if (cache.maxAge !== undefined) parts.push(`max-age=${cache.maxAge}`);
    if (cache.sMaxAge !== undefined) parts.push(`s-maxage=${cache.sMaxAge}`);
    if (cache.staleWhileRevalidate !== undefined) parts.push(`stale-while-revalidate=${cache.staleWhileRevalidate}`);
    headers.set("Cache-Control", parts.join(", "));
  }

  return NextResponse.json(data, { ...responseInit, headers });
}

export function sanitizeErrorMessage(message: string): string {
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
