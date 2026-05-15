"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Summary = {
  extract?: string;
  thumbnail?: { source: string };
  content_urls?: { desktop: { page: string } };
};

export function WikipediaSummary({
  title,
  commonName,
}: {
  title: string;
  commonName: string;
}) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/wikipedia?title=${encodeURIComponent(title)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [title]);

  if (error) {
    return (
      <p className="text-ink-soft text-sm">
        Wikipedia summary unavailable.{" "}
        <a
          href={`https://en.wikipedia.org/wiki/${title}`}
          target="_blank"
          rel="noreferrer"
          className="link-underline"
        >
          Read directly →
        </a>
      </p>
    );
  }

  if (!data) {
    return <p className="text-ink-soft text-sm italic">Loading from Wikipedia…</p>;
  }

  return (
    <div className="specimen-card rounded-md p-4 sm:p-5 flex gap-4">
      {data.thumbnail && (
        <Image
          src={data.thumbnail.source}
          alt={commonName}
          width={96}
          height={96}
          className="w-24 h-24 object-cover rounded-sm border border-paper-edge"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-ink-soft text-sm leading-relaxed">{data.extract}</p>
        {data.content_urls && (
          <a
            href={data.content_urls.desktop.page}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 text-xs smallcaps text-sage-deep hover:text-burgundy"
          >
            Read more on Wikipedia →
          </a>
        )}
      </div>
    </div>
  );
}
