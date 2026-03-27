import { Player } from "@remotion/player";

interface RemotionPlayerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: any;
  durationInFrames: number;
  fps?: number;
  compositionWidth: number;
  compositionHeight: number;
  inputProps?: Record<string, unknown>;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function RemotionPlayer({
  component,
  durationInFrames,
  fps = 30,
  compositionWidth,
  compositionHeight,
  inputProps = {},
  autoPlay = false,
  loop = false,
  controls = false,
  className,
  style,
}: RemotionPlayerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PlayerAny = Player as any;
  return (
    <PlayerAny
      component={component}
      durationInFrames={durationInFrames}
      fps={fps}
      compositionWidth={compositionWidth}
      compositionHeight={compositionHeight}
      inputProps={inputProps}
      autoPlayback={autoPlay}
      loop={loop}
      controls={controls}
      className={className}
      style={style}
    />
  );
}
