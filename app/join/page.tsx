import type { Metadata } from "next";
import JoinClient from "./JoinClient";
// Keep the Origin on our sign-in form POST while withholding referrers from external sites.
export const metadata: Metadata = { referrer: "same-origin", robots: { index: false, follow: false } };
export default function JoinPage() { return <JoinClient />; }
