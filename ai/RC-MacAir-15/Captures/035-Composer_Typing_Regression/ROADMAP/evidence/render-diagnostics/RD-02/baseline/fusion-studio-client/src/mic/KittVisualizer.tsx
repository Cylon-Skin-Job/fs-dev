interface KittVisualizerProps {
  audioLevel: number; // 0-1 normalized
}

const barHeight = (level: number) => Math.max(4, 4 + level * 106);

export function KittVisualizer({ audioLevel }: KittVisualizerProps) {
  const visualLevel = Math.max(audioLevel, 0.08);
  return (
    <div className="rv-voice-recorder__kitt">
      <div className="rv-voice-recorder__kitt-bar" style={{ '--kitt-h': `${barHeight(visualLevel * 0.8)}px` } as React.CSSProperties} />
      <div className="rv-voice-recorder__kitt-bar" style={{ '--kitt-h': `${barHeight(visualLevel)}px` } as React.CSSProperties} />
      <div className="rv-voice-recorder__kitt-bar" style={{ '--kitt-h': `${barHeight(visualLevel * 0.6)}px` } as React.CSSProperties} />
    </div>
  );
}
