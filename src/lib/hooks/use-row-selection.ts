"use client";

import { useMemo, useState } from "react";

export function useRowSelection<T extends { id: string }>(rows: T[] | undefined) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (!rows || rows.length === 0) return prev;
      const allSelected = rows.every((r) => prev.has(r.id));
      return allSelected ? new Set() : new Set(rows.map((r) => r.id));
    });
  }

  function clear() {
    setSelected(new Set());
  }

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const allSelected = !!rows && rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0;

  return {
    isSelected: (id: string) => selected.has(id),
    selectedIds,
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected,
  };
}
