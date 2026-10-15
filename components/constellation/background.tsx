"use client";
import { useEffect, useRef } from "react";
import { ParticleEngine, BackgroundSettings } from "./particle-engine";
export function ConstellationBackground({
  settings,
}: {
  settings: BackgroundSettings;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<ParticleEngine | null>(null);
  useEffect(() => {
    if (canvas.current)
      engine.current = new ParticleEngine(canvas.current, settings);
    return () => engine.current?.destroy();
  }, []);
  useEffect(() => engine.current?.update(settings), [settings]);
  return (
    <div className="constellation-background" aria-hidden="true">
      <canvas ref={canvas} />
      <div className="noise" />
    </div>
  );
}
