import { memo, type CSSProperties } from 'react';
import { colorFromString, initials } from '@/lib/utils';
import { useSettings } from '@/store/settings';

interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  className?: string;
  shape?: 'circle' | 'rounded' | 'square';
}

export const Avatar = memo(function Avatar({ name, src, size, className, shape }: AvatarProps) {
  const configured = useSettings((state) => state.appearance.avatarShape);
  const resolved = shape ?? configured;
  const shift = (colorFromString(name || '?') % 61) - 30;

  return (
    <span
      className={className ? `avatar ${className}` : 'avatar'}
      data-shape={resolved}
      style={
        {
          width: size,
          height: size,
          fontSize: size ? size * 0.4 : undefined,
          '--avatar-shift': shift,
        } as CSSProperties
      }
      aria-hidden
    >
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : initials(name || '?')}
    </span>
  );
});
