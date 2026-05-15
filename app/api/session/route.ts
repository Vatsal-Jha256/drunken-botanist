import { NextResponse } from "next/server";
import { getUser, isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUser();
  return NextResponse.json(
    {
      signedIn: !!user,
      isOwner: isOwner(user),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
