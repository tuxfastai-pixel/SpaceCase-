import type { Metadata } from "next";
import JoinClient from "./JoinClient";
export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };
export default function JoinPage() { return <JoinClient />; }
