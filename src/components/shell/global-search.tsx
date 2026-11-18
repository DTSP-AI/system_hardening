"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Building2, DollarSign, UserPlus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useSearchStore } from "@/lib/stores/search-store";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

export function GlobalSearch() {
  const router = useRouter();
  const open = useSearchStore((s) => s.open);
  const setOpen = useSearchStore((s) => s.setOpen);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const toggle = useSearchStore((s) => s.toggle);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const results = trpc.search.global.useQuery(
    { query: debounced },
    { enabled: debounced.length > 0 },
  );

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search contacts, companies, deals, leads…" value={query} onValueChange={setQuery} />
      <CommandList>
        {debounced.length === 0 ? (
          <CommandEmpty>Type to search…</CommandEmpty>
        ) : results.isLoading ? (
          <CommandEmpty>Searching…</CommandEmpty>
        ) : (
          <>
            <CommandEmpty>No results found.</CommandEmpty>
            {!!results.data?.contacts.length && (
              <CommandGroup heading="Contacts">
                {results.data.contacts.map((c) => (
                  <CommandItem key={c.id} onSelect={() => go(`/contacts/${c.id}`)}>
                    <Users className="text-[var(--viz-aqua)]" />
                    {c.firstName} {c.lastName}
                    {c.email && <span className="text-muted-foreground">{c.email}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!!results.data?.companies.length && (
              <CommandGroup heading="Companies">
                {results.data.companies.map((c) => (
                  <CommandItem key={c.id} onSelect={() => go(`/companies/${c.id}`)}>
                    <Building2 className="text-[var(--viz-yellow)]" />
                    {c.name}
                    {c.domain && <span className="text-muted-foreground">{c.domain}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!!results.data?.deals.length && (
              <CommandGroup heading="Deals">
                {results.data.deals.map((d) => (
                  <CommandItem key={d.id} onSelect={() => go(`/deals/${d.id}`)}>
                    <DollarSign className="text-[var(--viz-blue)]" />
                    {d.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!!results.data?.leads.length && (
              <CommandGroup heading="Leads">
                {results.data.leads.map((l) => (
                  <CommandItem key={l.id} onSelect={() => go(`/leads/${l.id}`)}>
                    <UserPlus className="text-[var(--viz-orange)]" />
                    {l.firstName} {l.lastName}
                    {l.companyName && <span className="text-muted-foreground">{l.companyName}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
