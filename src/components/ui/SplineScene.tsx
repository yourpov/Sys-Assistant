import { SPLINE_SCENE_URL } from '../../constants/urls';

interface SplineSceneProps {
  className?: string;
  title?: string;
  passive?: boolean;
}

export function SplineScene({ className, title = '3D scene', passive = false }: SplineSceneProps) {
  return (
    <iframe
      src={SPLINE_SCENE_URL}
      title={title}
      loading="lazy"
      className={['spline-scene', passive && 'spline-scene--passive', className].filter(Boolean).join(' ')}
      allow="fullscreen"
    />
  );
}