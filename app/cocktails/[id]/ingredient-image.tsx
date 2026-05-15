"use client";

import Image from "next/image";
import { useState } from "react";

export function IngredientImage({ src, alt }: { src: string; alt: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return <span className="w-9 h-9 shrink-0" aria-hidden />;
  return (
    <Image
      src={src}
      alt={alt}
      width={36}
      height={36}
      loading="lazy"
      className="w-9 h-9 object-contain shrink-0"
      onError={() => setHidden(true)}
    />
  );
}
