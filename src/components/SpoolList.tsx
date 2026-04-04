import React, { useEffect, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { usePrintJobStore } from '@/store/printJobStore';
import { useSettingsStore } from '@/store/settingsStore';
import { fetchSpools } from '@/lib/spoolmanApi';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import type { ISpool } from '@/types/spoolman';
import { spoolDisplayName } from '@/lib/utils';

function spoolMatchesSearch(spool: ISpool, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    spoolDisplayName(spool).toLowerCase().includes(q) ||
    (spool.location ?? '').toLowerCase().includes(q) ||
    String(spool.id).includes(q)
  );
}

export function SpoolList() {
  const {
    spools,
    selectedSpoolIds,
    searchQuery,
    showArchived,
    setSpools,
    toggleSpool,
    selectAllVisible,
    setSearchQuery,
    setShowArchived,
  } = usePrintJobStore();
  const { spoolmanUrl } = useSettingsStore();

  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSpools() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSpools(spoolmanUrl, { allowArchived: showArchived });
      setSpools(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load spools';
      setError(msg);
      toast.error('Could not reach Spoolman. Check the URL in Settings → General.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSpools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spoolmanUrl, showArchived]);

  const filtered = spools.filter((s) => spoolMatchesSearch(s, searchQuery));
  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selectedSpoolIds.has(s.id));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      // Deselect all visible
      filtered.forEach((s) => { if (selectedSpoolIds.has(s.id)) toggleSpool(s.id); });
    } else {
      selectAllVisible(filtered.map((s) => s.id));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Search + refresh */}
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search…"
            className="pl-8 h-8 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadSpools} disabled={loading} title="Refresh">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          <Checkbox
            checked={allFilteredSelected}
            onCheckedChange={toggleSelectAll}
            className="h-3.5 w-3.5"
          />
          {allFilteredSelected ? 'Deselect all' : 'Select all'}
        </label>
        <div className="flex items-center gap-1.5 ml-auto">
          <Checkbox
            id="show-archived"
            checked={showArchived}
            onCheckedChange={(v) => setShowArchived(!!v)}
            className="h-3.5 w-3.5"
          />
          <Label htmlFor="show-archived" className="text-xs cursor-pointer">Archived</Label>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Spool list */}
      <div className="max-h-56 overflow-y-auto rounded-md border">
        {filtered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            {loading ? 'Loading…' : 'No spools found'}
          </p>
        ) : (
          <ul>
            {filtered.map((spool) => (
              <li key={spool.id}>
                <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-accent transition-colors">
                  <Checkbox
                    checked={selectedSpoolIds.has(spool.id)}
                    onCheckedChange={() => toggleSpool(spool.id)}
                    className="flex-shrink-0"
                  />
                  {spool.filament.color_hex && (
                    <span
                      className="h-3 w-3 rounded-full border border-border flex-shrink-0"
                      style={{ backgroundColor: `#${spool.filament.color_hex}` }}
                    />
                  )}
                  <span className="flex-1 min-w-0 text-sm truncate">
                    <span className="text-muted-foreground text-xs">#{spool.id}</span>
                    <span className="ml-1">{spoolDisplayName(spool)}</span>
                    {spool.archived && (
                      <span className="ml-1 text-xs text-muted-foreground">(archived)</span>
                    )}
                  </span>
                  {spool.remaining_weight != null && (
                    <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                      {Math.round(spool.remaining_weight)}g
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {selectedSpoolIds.size} spool{selectedSpoolIds.size !== 1 ? 's' : ''} selected
      </p>
    </div>
  );
}
