import { useEffect, useState } from 'react';

type DataConnection = { saveData?: boolean; addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void };
const compactQuery = '(max-width: 760px), (pointer: coarse)';
function connection() { return (navigator as Navigator & {connection?: DataConnection}).connection; }
function preferenceReason() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'Reduce Motion is on in your device settings.';
  if (connection()?.saveData) return 'Data Saver is on for this connection.';
  return null;
}
function prefersCompact() {
  return matchMedia(compactQuery).matches || (navigator.hardwareConcurrency || 8) <= 4;
}
export function useScenePolicy() {
  const [still, setStill] = useState(() => preferenceReason() !== null);
  const [reason, setReason] = useState(preferenceReason);
  const [compact, setCompact] = useState(prefersCompact);
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const viewport = matchMedia(compactQuery);
    const network = connection();
    const respectPreference = () => { const next = preferenceReason(); setReason(next); if (next) setStill(true); };
    const resize = () => setCompact(prefersCompact());
    motion.addEventListener('change', respectPreference);
    viewport.addEventListener('change', resize);
    network?.addEventListener?.('change', respectPreference);
    return () => {
      motion.removeEventListener('change', respectPreference);
      viewport.removeEventListener('change', resize);
      network?.removeEventListener?.('change', respectPreference);
    };
  }, []);
  return {still, setStill, compact, reason};
}
