import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "spacecase",
    surface: "stos",
    status: "ok",
  });
}
