import { NextResponse } from "next/server";

export const revalidate = 86400; // 24h

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  if (!title) {
    return NextResponse.json({ error: "missing title" }, { status: 400 });
  }
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "drunken-botanist/1.0 (personal use)" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "wikipedia error" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(
      {
        extract: data.extract,
        thumbnail: data.thumbnail,
        content_urls: data.content_urls,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
