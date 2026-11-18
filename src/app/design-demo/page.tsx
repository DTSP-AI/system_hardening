import Link from "next/link";

const VARIANTS = [
  {
    slug: "beacon",
    name: "Beacon",
    tagline: "HubSpot-inspired",
    description:
      "Airy top-nav layout, generous whitespace, card-based records, warm coral accent. Friendliest to learn.",
    swatch: "#ff5c35",
  },
  {
    slug: "meridian",
    name: "Meridian",
    tagline: "Salesforce Lightning-inspired",
    description:
      "Dense enterprise pattern: navy icon rail, compact tables, highlight panel + related-list detail view.",
    swatch: "#0176d3",
  },
  {
    slug: "current",
    name: "Current",
    tagline: "Pipedrive / Close-inspired",
    description:
      "Minimal chrome, thin icon-only sidebar, big whitespace, quick-action focused. Fastest day-to-day.",
    swatch: "#14855f",
  },
] as const;

export default function DesignDemoIndex() {
  return (
    <div className="min-h-screen bg-white px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-medium text-slate-500">YBRYX CRM — Design demo</p>
        <h1 className="mt-2 text-3xl font-bold">Pick a UI direction</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Three fully working light-theme variants, each modeling a different major CRM&apos;s
          layout conventions, backed by the same real Contacts data. Click into each one, browse
          the list, open a contact detail, and compare.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {VARIANTS.map((v) => (
            <Link
              key={v.slug}
              href={`/design-demo/${v.slug}`}
              className="group flex flex-col rounded-xl border border-slate-200 p-5 transition hover:border-slate-300 hover:shadow-md"
            >
              <span
                className="h-2 w-10 rounded-full"
                style={{ backgroundColor: v.swatch }}
              />
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
