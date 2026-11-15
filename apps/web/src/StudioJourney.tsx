import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';
import { useScenePolicy } from '../../shared/useScenePolicy';

const Scene = lazy(() => import('./StudioScene'));
const labels = ['The blueprint', 'The interface', 'The architecture', 'The finished product'];
class SceneBoundary extends Component<{children: ReactNode; onError: () => void}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}
export function StudioJourney() {
  const {still, setStill, compact, reason} = useScenePolicy();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState(0);
  const stageRef = useRef(0);
  const progress = useRef({value: 0});
  useEffect(() => {
    let disposed = false;
    let destroy = () => {};
    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{gsap}, {ScrollTrigger}]) => {
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      // Tie the camera to actual section positions, including resized/wrapped content.
      const stops = [0, 0.3, 0.65, 0.85, 1];
      let offsets: number[] = [];
      const measure = () => {
        const bottom = document.documentElement.scrollHeight - innerHeight;
        offsets = ['blueprint', 'services', 'security', 'work', 'project'].map((id, i) => {
          const element = document.getElementById(id);
          return i === 0 ? 0 : Math.min(bottom, Math.max(0, (element?.offsetTop || bottom) - 120));
        });
      };
      measure();
      const trigger = ScrollTrigger.create({
        trigger: document.documentElement, start: 'top top', end: 'bottom bottom',
        onRefreshInit: measure,
        onUpdate: self => {
          const y = self.scroll();
          let segment = offsets.findIndex((offset, i) => i > 0 && y < offset) - 1;
          if (segment < 0) segment = offsets.length - 2;
          const local = Math.max(0, Math.min(1, (y - offsets[segment]) / Math.max(1, offsets[segment + 1] - offsets[segment])));
          const value = stops[segment] + (stops[segment + 1] - stops[segment]) * local;
          progress.current.value = value;
          const next = value < 0.22 ? 0 : value < 0.57 ? 1 : value < 0.82 ? 2 : 3;
          if (next !== stageRef.current) { stageRef.current = next; setStage(next); }
        },
      });
      destroy = () => trigger.kill();
      ScrollTrigger.refresh();
      // Recompute once local fonts are ready; no scroll hijacking or snap points.
      void document.fonts.ready.then(() => { if (!disposed) ScrollTrigger.refresh(); });
    }).catch(() => setStill(true));
    return () => { disposed = true; destroy(); };
  }, []);
  return <>
    <div className="studio-canvas" aria-hidden="true" data-testid="studio-journey"
      data-mode={failed ? 'fallback' : still ? 'still' : ready ? 'webgl' : 'loading'} data-quality={compact ? 'compact' : 'full'} data-stage={stage}>
      <div className="blueprint-still"><div className="still-grid"/><div className="still-frame frame-a"/><div className="still-frame frame-b"/><div className="still-core"/><div className="still-axis"/></div>
      {!still && !failed && <SceneBoundary onError={() => setFailed(true)}><Suspense fallback={null}>
        <Scene progress={progress} compact={compact} onReady={() => setReady(true)} onLost={() => setFailed(true)}/>
      </Suspense></SceneBoundary>}
      <div className="studio-vignette"/>
    </div>
    {still && reason && <div className="studio-preference-notice" role="status">
      <span><strong>3D preview paused</strong>{reason} You can turn it on for this visit.</span>
      <button type="button" onClick={() => { setReady(false); setStill(false); }}>View 3D anyway</button>
    </div>}
    {!(still && reason) && <div className="studio-controls" role="group" aria-label="3D journey controls">
      <span className="studio-control-stage"><i/>{String(stage + 1).padStart(2, '0')} / {labels[stage]}</span>
      <button type="button" aria-label={still || failed ? 'Enable 3D journey' : 'Pause 3D journey'} aria-pressed={still || failed}
        onClick={() => { setReady(false); if (failed) setFailed(false); setStill(failed ? false : !still); }}>
        {still || failed ? <Play size={12}/> : <Pause size={12}/>} {still || failed ? 'Enable 3D' : 'Pause motion'}
      </button>
    </div>}
  </>;
}
