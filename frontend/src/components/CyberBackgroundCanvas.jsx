import { useEffect, useRef } from 'react';

/**
 * CyberBackgroundCanvas Component
 * Renders an ultra-lightweight, GPU-accelerated constellation network
 * and ambient cursor glow in the background.
 *
 * Guaranteed 100% click-through (pointer-events: none),
 * throttled via requestAnimationFrame, automatically pauses on tab blur,
 * and gracefully respects prefers-reduced-motion.
 */
export default function CyberBackgroundCanvas({
  nodeCount = 38,
  maxConnectionDistance = 95,
  particleSpeed = 0.35,
  showCursorAura = true,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Respect reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animFrameId = null;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates (default off-screen)
    let mouse = { x: -1000, y: -1000, active: false };

    // Responsive node count
    const actualNodeCount = width < 768 ? Math.floor(nodeCount * 0.45) : nodeCount;

    // Initialize particles
    const particles = [];
    for (let i = 0; i < actualNodeCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * particleSpeed,
        vy: (Math.random() - 0.5) * particleSpeed,
        radius: Math.random() * 1.4 + 0.8,
        baseAlpha: Math.random() * 0.28 + 0.12,
        isCyan: Math.random() > 0.85, // 15% subtle cyan security nodes
      });
    }

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    let isDocumentVisible = !document.hidden;
    const handleVisibilityChange = () => {
      isDocumentVisible = !document.hidden;
      if (isDocumentVisible && !animFrameId) {
        loop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Render loop
    const loop = () => {
      if (!isDocumentVisible) {
        animFrameId = null;
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Draw cursor ambient cyber aura
      if (showCursorAura && mouse.active && mouse.x > 0 && mouse.y > 0) {
        const auraGradient = ctx.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          240
        );
        auraGradient.addColorStop(0, 'rgba(0, 229, 255, 0.055)');
        auraGradient.addColorStop(0.4, 'rgba(235, 240, 250, 0.025)');
        auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = auraGradient;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 240, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around boundaries
        if (p.x < 0) p.x = width;
        else if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        else if (p.y > height) p.y = 0;

        // Mouse gentle repulsion/attraction
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130 && dist > 5) {
            const force = (130 - dist) / 130;
            // Gentle nudge toward cursor path
            p.x += (dx / dist) * force * 0.4;
            p.y += (dy / dist) * force * 0.4;
          }
        }

        // Draw node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.isCyan
          ? `rgba(0, 229, 255, ${p.baseAlpha + 0.15})`
          : `rgba(235, 240, 248, ${p.baseAlpha})`;
        ctx.fill();

        // Connect nearby nodes
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxConnectionDistance) {
            const lineAlpha = (1 - dist / maxConnectionDistance) * 0.14;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = p.isCyan || p2.isCyan
              ? `rgba(0, 229, 255, ${lineAlpha * 1.3})`
              : `rgba(220, 230, 245, ${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      animFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [nodeCount, maxConnectionDistance, particleSpeed, showCursorAura]);

  return (
    <canvas
      ref={canvasRef}
      className="pg-cyber-bg-canvas"
      aria-hidden="true"
    />
  );
}
