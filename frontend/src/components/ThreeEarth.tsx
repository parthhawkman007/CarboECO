"use client";

import React, { useRef, useState, useEffect } from "react";

export default function ThreeEarth() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const rotation = useRef({ x: 0.3, y: 0.5 });
  const velocity = useRef({ x: 0, y: 0.005 }); // auto rotate

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const radius = 95;
    const particles: { x: number; y: number; z: number; size: number; speed: number; angle: number }[] = [];

    // Initialize 70 carbon particles orbiting the earth
    for (let i = 0; i < 70; i++) {
      const dist = radius * (1.2 + Math.random() * 0.45);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      particles.push({
        x: dist * Math.sin(phi) * Math.cos(theta),
        y: dist * Math.sin(phi) * Math.sin(theta),
        z: dist * Math.cos(phi),
        size: 1 + Math.random() * 1.5,
        speed: 0.004 + Math.random() * 0.008,
        angle: Math.random() * Math.PI * 2
      });
    }

    const resizeCanvas = () => {
      canvas.width = 380;
      canvas.height = 380;
    };
    resizeCanvas();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw Atmospheric Glow (Cyan/Green radial gradient)
      const glowGrad = ctx.createRadialGradient(cx, cy, radius - 15, cx, cy, radius + 45);
      glowGrad.addColorStop(0, "rgba(16, 185, 129, 0.12)");
      glowGrad.addColorStop(0.5, "rgba(14, 165, 233, 0.06)");
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 45, 0, Math.PI * 2);
      ctx.fill();

      // Auto rotation velocity decay/apply if not dragging or paused
      if (!isDragging && !isPaused) {
        rotation.current.y += velocity.current.y;
        rotation.current.x += velocity.current.x;
        // Dampen velocity
        velocity.current.y *= 0.97;
        velocity.current.x *= 0.97;
        // Keep minimum auto rotation speed
        if (Math.abs(velocity.current.y) < 0.002) velocity.current.y = 0.002;
      }

      const rotX = rotation.current.x;
      const rotY = rotation.current.y;

      const project3D = (x: number, y: number, z: number) => {
        // Rotate around Y axis (longitude rotation)
        const x1 = x * Math.cos(rotY) - z * Math.sin(rotY);
        const z1 = x * Math.sin(rotY) + z * Math.cos(rotY);

        // Rotate around X axis (latitude rotation)
        const y2 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
        const z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);

        return {
          x: cx + x1,
          y: cy + y2,
          z: z2,
          visible: z2 > 0 // Front facing if projected z is positive
        };
      };

      // Draw Earth Wireframe Grid (Meridians & Parallels)
      ctx.strokeStyle = "rgba(16, 185, 129, 0.22)";
      ctx.lineWidth = 1.0;

      // Parallels (Latitude lines)
      const latCount = 9;
      for (let j = 1; j < latCount; j++) {
        const phi = (j / latCount) * Math.PI;
        const latRadius = radius * Math.sin(phi);
        const yVal = radius * Math.cos(phi);

        ctx.beginPath();
        let first = true;
        for (let theta = 0; theta <= Math.PI * 2 + 0.15; theta += 0.15) {
          const pt = project3D(latRadius * Math.cos(theta), yVal, latRadius * Math.sin(theta));
          if (pt.visible) {
            if (first) {
              ctx.moveTo(pt.x, pt.y);
              first = false;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            first = true;
          }
        }
        ctx.stroke();
      }

      // Meridians (Longitude lines)
      const lonCount = 10;
      for (let j = 0; j < lonCount; j++) {
        const theta = (j / lonCount) * Math.PI * 2;
        ctx.beginPath();
        let first = true;
        for (let phi = 0; phi <= Math.PI * 2 + 0.15; phi += 0.15) {
          const pt = project3D(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
          if (pt.visible) {
            if (first) {
              ctx.moveTo(pt.x, pt.y);
              first = false;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            first = true;
          }
        }
        ctx.stroke();
      }

      // Draw Earth Sphere Outer Ring Outline
      ctx.strokeStyle = "rgba(14, 165, 233, 0.35)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw carbon particles orbiting the earth
      particles.forEach((p) => {
        p.angle += p.speed;
        
        // Circular orbit calculations
        const orbRadius = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        const ox = orbRadius * Math.cos(p.angle);
        const oy = orbRadius * Math.sin(p.angle) * 0.4; // orbit tilt
        const oz = orbRadius * Math.sin(p.angle) * 0.9;

        const pt = project3D(ox, oy, oz);

        // Draw particle
        const alpha = pt.z > 0 ? 0.75 : 0.2;
        ctx.fillStyle = `rgba(14, 165, 233, ${alpha})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.size * (pt.z > 0 ? 1.2 : 0.8), 0, Math.PI * 2);
        ctx.fill();

        // Core dot for particles in front
        if (pt.z > 0) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, p.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Core glow in center
      const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      innerGlow.addColorStop(0, "rgba(16, 185, 129, 0.1)");
      innerGlow.addColorStop(0.8, "rgba(14, 165, 233, 0.02)");
      innerGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = innerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    rotation.current.y += dx * 0.007;
    rotation.current.x += dy * 0.007;

    // Limit pitch to avoid gimbal lock flip
    rotation.current.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, rotation.current.x));

    dragStart.current = { x: e.clientX, y: e.clientY };
    velocity.current = { x: dy * 0.0015, y: dx * 0.0015 };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      rotation.current.y -= 0.1;
      velocity.current.y = -0.01;
    } else if (e.key === "ArrowRight") {
      rotation.current.y += 0.1;
      velocity.current.y = 0.01;
    } else if (e.key === "ArrowUp") {
      rotation.current.x -= 0.1;
      rotation.current.x = Math.max(-Math.PI / 2 + 0.1, rotation.current.x);
      velocity.current.x = -0.01;
    } else if (e.key === "ArrowDown") {
      rotation.current.x += 0.1;
      rotation.current.x = Math.min(Math.PI / 2 - 0.1, rotation.current.x);
      velocity.current.x = 0.01;
    }
  };

  return (
    <div 
      className="h-[380px] w-full max-w-[380px] mx-auto cursor-grab active:cursor-grabbing relative flex items-center justify-center select-none focus-visible:ring-2 focus-visible:ring-brand-emerald focus-visible:outline-none rounded-full"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      tabIndex={0}
      role="region"
      aria-label="Interactive 3D Digital Twin Earth Globe showing carbon particle orbit layers. Use arrow keys to rotate."
      onKeyDown={handleKeyDown}
    >
      <div className="absolute inset-0 bg-brand-emerald/5 rounded-full blur-[80px] pointer-events-none -z-10" />
      <button
        onClick={() => setIsPaused(!isPaused)}
        className="absolute top-4 right-4 bg-gray-100 dark:bg-brand-cardDark hover:bg-gray-200 dark:hover:bg-brand-borderDark text-gray-800 dark:text-gray-200 rounded-xl px-2.5 py-1 text-[10px] font-bold transition-colors border border-gray-200/50 dark:border-brand-borderDark/50 z-10 shadow-sm"
        aria-label={isPaused ? "Play Earth auto rotation" : "Pause Earth auto rotation"}
      >
        {isPaused ? "Play" : "Pause"}
      </button>
      <div className="sr-only">
        This is an interactive 3D digital representation of Earth. It has rotating orbits representing carbon emissions. You can rotate the view using mouse drag or arrow keys.
      </div>
      <canvas 
        ref={canvasRef} 
        className="h-full w-full block drop-shadow-[0_0_15px_rgba(16,185,129,0.15)]"
        aria-hidden="true"
      />
      <div className="absolute bottom-4 text-[9px] text-gray-400/80 uppercase font-mono tracking-widest font-bold pointer-events-none">
        Drag Earth or use Arrow Keys to Rotate
      </div>
    </div>
  );
}
