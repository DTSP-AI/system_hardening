import type { NextConfig } from "next";

/**
 * Clerk's Frontend API host, derived from the publishable key
 * (pk_test_/pk_live_ + base64 of "<host>$"). Never throws: the build must
 * work without env.
 */
function getClerkFapiHost(): string | null {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) {
    console.warn("next.config: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set; omitting Clerk FAPI from CSP");
    return null;
  }
  try {
    const host = Buffer.from(key.replace(/^pk_(test|live)_/, ""), "base64")
      .toString("utf8")
      .replace(/\$$/, "");
    return host || null;
  } catch {
    console.warn("next.config: could not decode NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY; omitting Clerk FAPI from CSP");
    return null;
  }
}

function buildReportOnlyCsp(): string {
  const fapi = getClerkFapiHost();
  const fapiSrc = fapi ? ` https://${fapi}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${fapiSrc} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.clerk.com",
    "font-src 'self' data:",
    `connect-src 'self'${fapiSrc} https://*.protect.clerk.com:* https://clerk-telemetry.com wss://*.twilio.com https://*.twilio.com https://api.open-meteo.com https://geocoding-api.open-meteo.com`,
    "media-src 'self' https://sdk.twilio.com",
    "worker-src 'self' blob:",
    "frame-src https://challenges.cloudflare.com https://*.protect.clerk.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  async headers() {
    const headers = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value:
          "camera=(), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=(), display-capture=(), browsing-topics=()",
      },
      // Enforced subset: cannot break Clerk, Twilio, or Blob.
      {
        key: "Content-Security-Policy",
        value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
      },
    ];
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Content-Security-Policy-Report-Only", value: buildReportOnlyCsp() });
    }
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
