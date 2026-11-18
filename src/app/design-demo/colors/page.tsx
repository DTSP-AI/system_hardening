import Link from "next/link";

const VARIANTS = [
  {
    slug: "command-light",
    name: "Command Light",
    tagline: "Hybrid — solid YBRYX navy sidebar",
    description:
      "Same navy (#0a1f3d) as the current sidebar, just solid instead of glass-over-photo. Light content area. Closest to today's brand identity.",
    swatch: "#0a1f3d",
  },
  {
    slug: "slate",
    name: "Slate",
    tagline: "Hybrid — neutral dark slate sidebar",
    description:
      "Neutral dark slate-grey sidebar (no navy/brand tint), light content, blue accent. Generic modern enterprise look.",
    swatch: "#1e293b",
  },
  {
    slug: "ink",
    name: "Ink",
    tagline: "Hybrid — near-black minimal sidebar",
    description:
      "Near-black sidebar, off-white content, indigo accent. Premium/minimal, Linear-inspired.",
    swatch: "#0a0a0b",
  },
  {
    slug: "daylight",
    name: "Daylight",
    tagline: "Fully light",
    description:
      "Sidebar and content both light/white, blue accent. Closest to Salesforce Lightning / HubSpot's default look.",
    swatch: "#2563eb",
  },
] as const;

export default function ColorDemoIndex() {
  return (
    <div className="min-h-screen bg-white px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-medium text-slate-500">YBRYX CRM — Color demo</p>
        <h1 className="mt-2 text-3xl font-bold">Same layout, four color directions</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Identical sidebar nav, Contacts list, and Contact detail as the real app — no
          glassmorphism or background photo, just retoned. Click into each and compare.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {VARIANTS.map((v) => (
            <Link
              key={v.slug}
              href={`/design-demo/colors/${v.slug}`}
              className="group flex flex-col rounded-xl border border-slate-200 p-5 transition hover:border-slate-300 hover:shadow-md"
            >
              <span className="h-2 w-10 rounded-full" style={{ backgroundColor: v.swatch }} />
              <h2 className="mt-4 text-lg font-semibold">{v.name}</h2>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {v.tagline}
              </p>
              <p className="mt-3 flex-1 text-sm text-slate-600">{v.description}</p>
              <span className="mt-4 text-sm font-medium text-slate-900 group-hover:underline">
                Open demo →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
