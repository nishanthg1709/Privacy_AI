import { useEffect, useRef } from 'react';

/**
 * Custom hook for gentle, performant 3D card tilt and specular rim lighting.
 * Dynamically updates CSS custom properties (--tilt-x, --tilt-y, --mouse-x, --mouse-y).
 * Automatically respects prefers-reduced-motion and touch devices.
 */
export default function useCardTilt(options = {}) {
  const { maxTilt = 4, scale = 1.015, speed = 400 } = options;
  const cardRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Skip on touch devices or reduced-motion preference
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouch || prefersReducedMotion) return;

    const card = cardRef.current;
    if (!card) return;

    let rafId = null;

    const handleMouseMove = (e) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Position relative to card center (-1 to +1)
        const x = (e.clientX - rect.left) / width;
        const y = (e.clientY - rect.top) / height;

        const tiltX = (0.5 - y) * maxTilt * 2;
        const tiltY = (x - 0.5) * maxTilt * 2;

        card.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
        card.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
        card.style.setProperty('--tilt-scale', `${scale}`);
        card.style.setProperty('--mouse-x', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--mouse-y', `${(y * 100).toFixed(1)}%`);
        card.classList.add('pg-tilt-active');
      });
    };

    const handleMouseLeave = () => {
      if (rafId) cancelAnimationFrame(rafId);
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
      card.style.setProperty('--tilt-scale', '1');
      card.classList.remove('pg-tilt-active');
    };

    card.addEventListener('mousemove', handleMouseMove, { passive: true });
    card.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
      card.classList.remove('pg-tilt-active');
    };
  }, [maxTilt, scale, speed]);

  return cardRef;
}

export { useCardTilt };

