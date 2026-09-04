import { useSearchParams } from "react-router-dom";
import { FaqSection } from "./FaqSection";
import { TestimonialSection } from "./TestimonialSection";
import { RecipeSection } from "./RecipeSection";
import { FeaturedSection } from "./FeaturedSection";

const TABS = [
  { key: "faqs", label: "FAQs" },
  { key: "testimonials", label: "Testimonials" },
  { key: "recipes", label: "Recipes" },
  { key: "featured", label: "Featured" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ContentPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as TabKey | null) ?? "faqs";

  function setTab(t: TabKey) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", t);
      return next;
    });
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div>
          <h1 className="page-title">Content</h1>
          <p className="muted">
            Storefront copy staff edit without a deploy — FAQs, testimonials, recipes, and the
            homepage featured-product list.
          </p>
        </div>
      </div>

      <div className="filter-row">
        {TABS.map((t) => (
          <button
            key={t.key}
            className="chip"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "faqs" && <FaqSection />}
      {tab === "testimonials" && <TestimonialSection />}
      {tab === "recipes" && <RecipeSection />}
      {tab === "featured" && <FeaturedSection />}
    </div>
  );
}
