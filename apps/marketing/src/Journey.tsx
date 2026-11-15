import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useScenePolicy } from '../../shared/useScenePolicy';
const Scene = lazy(() => import("./JourneyScene"));
class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
export function Journey({ metric }: { metric: number }) {
  const {still, setStill, compact, reason} = useScenePolicy();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState(0);
  const stageRef = useRef(0);
  const progress = useRef({ value: 0 });
  useEffect(() => {
    let disposed = false;
    let destroy = () => {};
    if (still || failed) return;
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger);
        const trigger = ScrollTrigger.create({
          trigger: document.documentElement,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (self) => {
            progress.current.value = self.progress;
            const next =
              self.progress < 0.22
                ? 0
                : self.progress < 0.48
                  ? 1
                  : self.progress < 0.73
                    ? 2
                    : 3;
            if (stageRef.current !== next) {
              stageRef.current = next;
              setStage(next);
            }
          },
          invalidateOnRefresh: true,
        });
        progress.current.value = trigger.progress;
        destroy = () => trigger.kill();
        ScrollTrigger.refresh();
      })
      .catch(() => setStill(true));
    return () => {
      disposed = true;
      destroy();
    };
  }, [still, failed]);
  const labels = [
    "Market noise",
    "Focused signals",
    "Meaningful measures",
    "Your next chapter",
  ];
  return (
    <>
      <div
        className={"journey-canvas " + (still || failed ? "is-still" : "")}
        aria-hidden="true"
        data-testid="journey-visual"
        data-mode={
          failed ? "fallback" : still ? "still" : ready ? "webgl" : "loading"
        }
        data-stage={stage}
        data-quality={compact ? 'compact' : 'full'}
      >
        <div className="fallback-art">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="fallback-prism" />
          <div className="fallback-rays" />
        </div>
        {!still && !failed && (
          <SceneBoundary onError={() => setFailed(true)}>
            <Suspense fallback={null}>
              <Scene
                progress={progress}
                metric={metric}
                compact={compact}
                onReady={() => setReady(true)}
                onLost={() => setFailed(true)}
              />
            </Suspense>
          </SceneBoundary>
        )}
        <div className="scene-vignette" />
      </div>
      {still && reason && <div className="journey-preference-notice" role="status">
        <span><strong>3D preview paused</strong>{reason} You can turn it on for this visit.</span>
        <button type="button" onClick={() => { setReady(false); setStill(false); }}>View 3D anyway</button>
      </div>}
      {!(still && reason) && <div className="scene-controls">
        <span className="signal-dot" />
        <span>{still || failed ? "Still composition" : labels[stage]}</span>
        <button
          type="button"
          onClick={() => {
            setReady(false);
            if (failed) {
              setFailed(false);
              setReady(false);
              setStill(false);
            } else {
              setStill((v) => !v);
            }
          }}
          aria-pressed={still || failed}
          aria-label={
            still || failed ? "Enable 3D journey" : "Pause 3D journey"
          }
        >
          {failed ? (
            <RotateCcw size={13} />
          ) : still ? (
            <Play size={13} />
          ) : (
            <Pause size={13} />
          )}
          <span>{still || failed ? "Enable 3D" : "Pause motion"}</span>
        </button>
      </div>}
    </>
  );
}
