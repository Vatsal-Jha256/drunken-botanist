import { canonicalIngredients, recipes } from "@/lib/calculator";
import { CalculatorUI } from "./calculator-ui";

export const dynamic = "force-static";

export default function CalculatorPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
      <header className="mb-8 max-w-3xl">
        <p className="smallcaps text-xs text-ink-soft mb-2">field calculation</p>
        <h1 className="font-serif text-4xl text-ink">The Cocktail Calculator</h1>
        <p className="text-ink-soft mt-3 leading-relaxed">
          Tell me what&apos;s on your shelf and how many guests are arriving. I&apos;ll scan{" "}
          {recipes.length.toLocaleString()} bar-quality recipes and tell you exactly what you can
          pour tonight, what you&apos;re one ingredient away from, and a suggested party menu that
          spends your inventory efficiently.
        </p>
        <p className="text-ink-soft text-xs mt-3">
          Pure rule-based scoring · no LLMs · runs entirely on the server next to this page.
        </p>
      </header>
      <CalculatorUI canonicals={canonicalIngredients} />
    </div>
  );
}
