interface Props {
  width    ? : string | number;
  height   ? : string | number;
  className? : string;
}

export function Skeleton({ width = '100%', height = 14, className = '' }: Props) {
  return <div className={`skeleton drag-surface ${className}`} style={{ width, height }} data-tauri-drag-region />;
}
