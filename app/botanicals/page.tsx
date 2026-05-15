import Link from "next/link";
import { botanicalsGroupedByFamily, botanicals } from "@/lib/botanicals";

export const dynamic = "force-static";

export default function BotanicalsIndex() {
  const grouped = botanicalsGroupedByFamily();
  const families = Object.keys(grouped).sort();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 text-center">
        <p className="smallcaps text-xs text-ink-soft mb-2">the field guide</p>
        <h1 className="font-serif text-4xl text-ink">Botanicals</h1>
        <p className="text-ink-soft text-sm mt-2 max-w-xl mx-auto">
          {botanicals.length} plants that quietly do the work behind your bar. Grouped by family the
          way a herbarium would arrange them.
        </p>
      </header>

      <div className="space-y-10">
        {families.map((family) => (
          <section key={family}>
            <h2 className="font-serif text-2xl text-sage-deep border-b border-paper-edge pb-2 mb-4">
              {family}
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {grouped[family].map((b) => (
                <li key={b.slug}>
                  <Link
                    href={`/botanicals/${b.slug}`}
                    className="specimen-card rounded-sm p-4 h-full flex flex-col hover:border-sage transition-colors"
                  >
                    <p className="font-serif text-lg text-ink leading-tight">
                      {b.commonName}
                    </p>
                    <p className="text-xs italic text-ink-soft mt-1">{b.latinName}</p>
                    <p className="text-xs text-ink-soft mt-2 line-clamp-2">
                      {b.blurb}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
