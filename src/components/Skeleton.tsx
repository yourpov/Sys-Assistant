interface Props {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({ width = '100%', height = 14, className = '' }: Props) {
  return <div className={`skeleton ${className}`} style={{ width, height }} />;
}
