"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteWatchItem } from "@/app/(app)/watch/actions";
import { browserClient } from "@/lib/supabase-browser";
import { FILTERS, FILTER_LABEL, filterItems, newestFirst, type WatchFilter, type WatchItem } from "@/lib/watch/notes";
import { WatchCard } from "./watch-card";
import { WatchDrawer } from "./watch-drawer";
import { WatchPaste } from "./watch-paste";

type Change = { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> };

function setItemParam(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("item", id);
  else url.searchParams.delete("item");
  window.history.replaceState(null, "", url);
}

export function WatchBoard({ initialItems, initialOpenId }: { initialItems: WatchItem[]; initialOpenId: string | null }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<WatchFilter>("all");
  const [openId, setOpenId] = useState<string | null>(initialOpenId);

  useEffect(() => setItems(initialItems), [initialItems]);

  const open = useCallback((id: string | null) => {
    setOpenId(id);
    setItemParam(id);
  }, []);

  const addItem = useCallback((item: WatchItem) => {
    setItems((all) => (all.some((i) => i.id === item.id) ? all : newestFirst([item, ...all])));
  }, []);

  const setNotes = useCallback((id: string, notes: string, rev: number) => {
    setItems((all) => all.map((i) => (i.id === id && rev >= i.rev ? { ...i, notes, rev } : i)));
  }, []);

  // Items and notes saved on other devices.
  useEffect(() => {
    const supabase = browserClient();
    const channel = supabase
      .channel("watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "watch_items" }, async (p: Change) => {
        if (p.eventType === "DELETE") {
          const id = p.old.id as string;
          setItems((all) => all.filter((i) => i.id !== id));
          return;
        }
        const row = p.new as { id: string; notes: string; rev: number; thumb_url: string | null; thumb_path: string | null } & Omit<WatchItem, "thumb" | "notes" | "rev">;
        let thumb = row.thumb_url;
        if (!thumb && row.thumb_path) thumb = (await supabase.storage.from("media").createSignedUrl(row.thumb_path, 3600)).data?.signedUrl ?? null;
        const { thumb_url: _u, thumb_path: _p, ...rest } = row;
        void _u;
        void _p;
        setItems((all) => {
          const old = all.find((i) => i.id === row.id);
          if (!old) return newestFirst([{ ...rest, thumb } as WatchItem, ...all]);
          return old.rev > row.rev ? all : all.map((i) => (i.id === row.id ? { ...i, ...rest, thumb: thumb ?? i.thumb } : i));
        });
      })
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, []);

  async function remove(id: string): Promise<string | null> {
    const r = await deleteWatchItem(id);
    if (!r.ok) return r.error;
    setItems((all) => all.filter((i) => i.id !== id));
    if (openId === id) open(null);
    return null;
  }

  const shown = filterItems(items, filter);
  const current = openId ? (items.find((i) => i.id === openId) ?? null) : null;

  return (
    <>
      <WatchPaste
        onSaved={(item) => {
          addItem(item);
          open(item.id);
          router.refresh();
        }}
        onOpen={open}
      />

      {items.length > 0 && (
        <div className="filter-row" role="group" aria-label="Filter by source">
          {FILTERS.map((f) => (
            <button key={f} type="button" className="chip chip-btn chip-idle" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <p className="hint wempty">Nothing saved yet. Paste a YouTube or X link above to start taking notes.</p>
      ) : shown.length === 0 ? (
        <p className="hint wempty">No {FILTER_LABEL[filter]} items yet.</p>
      ) : (
        <div className="wgrid">
          {shown.map((item) => (
            <WatchCard key={item.id} item={item} onOpen={() => open(item.id)} onDelete={() => remove(item.id)} />
          ))}
        </div>
      )}

      {current && <WatchDrawer key={current.id} item={current} onClose={() => open(null)} onNotes={setNotes} />}
    </>
  );
}
