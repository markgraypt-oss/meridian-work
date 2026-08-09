import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Ruler, Camera, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Measurement, Photo } from "./types";

// ─── Measurements ─────────────────────────────────────────────────────────────

const MEAS_COLS: { key: keyof Measurement; label: string }[] = [
  { key: 'waist',      label: 'Waist' },
  { key: 'chest',      label: 'Chest' },
  { key: 'hips',       label: 'Hips' },
  { key: 'neck',       label: 'Neck' },
  { key: 'shoulders',  label: 'Shoulders' },
  { key: 'leftBicep',  label: 'L Bicep' },
  { key: 'rightBicep', label: 'R Bicep' },
  { key: 'leftThigh',  label: 'L Thigh' },
  { key: 'rightThigh', label: 'R Thigh' },
  { key: 'leftCalf',   label: 'L Calf' },
  { key: 'rightCalf',  label: 'R Calf' },
];

function MeasurementsPanel({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery<Measurement[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/measurements`],
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No measurements logged yet.</p>;
  }

  const sorted  = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const latest  = sorted[sorted.length - 1];
  const earliest = sorted[0];

  const cols = MEAS_COLS.filter(c => latest[c.key] != null || sorted.some(r => r[c.key] != null));

  function delta(key: keyof Measurement): string | null {
    const latestVal   = latest[key]   as number | null | undefined;
    const earliestVal = earliest[key] as number | null | undefined;
    if (latestVal == null || earliestVal == null || latest.date === earliest.date) return null;
    const diff = latestVal - earliestVal;
    if (diff === 0) return null;
    return (diff > 0 ? '+' : '') + diff.toFixed(1) + ' cm';
  }

  function fmtDate(d: string) {
    try { return format(parseISO(d), 'd MMM yyyy'); } catch { return d.slice(0, 10); }
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Latest: {fmtDate(latest.date)}
        {latest.date !== earliest.date && ` · Earliest: ${fmtDate(earliest.date)}`}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left pb-1.5 font-medium pr-4 whitespace-nowrap">Site</th>
              <th className="text-right pb-1.5 font-medium pr-4 whitespace-nowrap">Latest</th>
              <th className="text-right pb-1.5 font-medium whitespace-nowrap">Change</th>
            </tr>
          </thead>
          <tbody>
            {cols.map(c => {
              const val = latest[c.key] as number | null | undefined;
              if (val == null) return null;
              const d = delta(c.key);
              return (
                <tr key={c.key} className="border-b border-border/40 last:border-0">
                  <td className="py-1.5 pr-4 text-muted-foreground whitespace-nowrap">{c.label}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums font-medium">{val} cm</td>
                  <td className={`py-1.5 text-right tabular-nums text-xs ${!d ? 'text-muted-foreground' : d.startsWith('+') ? 'text-red-400' : 'text-emerald-400'}`}>
                    {d ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Progress Photos ──────────────────────────────────────────────────────────

const ANGLE_ORDER = ['front', 'side', 'back', 'left', 'right'];

function sortByAngle(photos: Photo[]): Photo[] {
  return [...photos].sort((a, b) => {
    const ai = ANGLE_ORDER.indexOf(a.category?.toLowerCase());
    const bi = ANGLE_ORDER.indexOf(b.category?.toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function PhotoSet({ set, date, label }: { set: Photo[]; date: string; label: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {sortByAngle(set).map(p => (
          <div key={p.id} className="relative group">
            <img src={p.imageUrl} alt={p.category}
              className="h-36 w-24 object-cover rounded-md border border-border bg-muted"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="absolute bottom-1 left-1 text-[9px] uppercase tracking-wide font-medium bg-black/70 text-white rounded px-1 py-0.5">
              {p.category}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotosPanel({ userId }: { userId: string }) {
  const [compareMode, setCompareMode] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const { data, isLoading } = useQuery<Photo[]>({
    queryKey: [`/api/admin/coach-access/clients/${userId}/photos`],
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No progress photos yet.</p>;
  }

  // Group by photoSetId, sorted newest-first
  const setMap = new Map<string, Photo[]>();
  for (const p of data) {
    const arr = setMap.get(p.photoSetId) ?? [];
    arr.push(p);
    setMap.set(p.photoSetId, arr);
  }
  const sets = Array.from(setMap.entries())
    .sort((a, b) => b[1][0].date.localeCompare(a[1][0].date));

  function fmtDate(d: string) {
    try { return format(parseISO(d), 'd MMM yyyy'); } catch { return d.slice(0, 10); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{sets.length} set{sets.length > 1 ? 's' : ''}</span>
        {sets.length >= 2 && (
          <Button variant="outline" size="sm" className="h-6 text-xs px-2"
            onClick={() => setCompareMode(m => !m)}>
            {compareMode ? 'Hide compare' : 'Compare'}
          </Button>
        )}
      </div>

      {compareMode ? (
        <div className="grid grid-cols-2 gap-6">
          {sets.slice(0, 2).map(([, set]) => (
            <PhotoSet key={set[0].photoSetId} set={set} date={set[0].date} label={fmtDate(set[0].date)} />
          ))}
        </div>
      ) : (
        <PhotoSet set={sets[0][1]} date={sets[0][1][0].date} label={`Latest · ${fmtDate(sets[0][1][0].date)}`} />
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setLightboxSrc(null)}>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white" onClick={() => setLightboxSrc(null)}>
            <X className="h-5 w-5" />
          </Button>
          <img src={lightboxSrc} alt="" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ─── BodyPanel ────────────────────────────────────────────────────────────────

export function BodyPanel({ userId }: { userId: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Body</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-border">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              <Ruler className="h-3.5 w-3.5" />
              Measurements
            </div>
            <MeasurementsPanel userId={userId} />
          </div>
          <div className="pt-8 md:pt-0 md:pl-8">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              <Camera className="h-3.5 w-3.5" />
              Progress photos
            </div>
            <PhotosPanel userId={userId} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
