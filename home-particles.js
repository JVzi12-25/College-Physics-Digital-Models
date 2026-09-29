const canvas = document.querySelector("#home-particles");
const context = canvas?.getContext("2d", { alpha: true, desynchronized: true });

if (canvas && context) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const pointer = { x: 0, y: 0, lastMove: 0, active: false };
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let particles = [];
  let frameId = 0;
  let previousTime = 0;
  let running = false;

  const random = (min, max) => min + Math.random() * (max - min);

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const mobile = width < 640;
    const count = Math.max(mobile ? 22 : 42, Math.min(mobile ? 36 : 88, Math.round((width * height) / (mobile ? 21000 : 14500))));
    const colors = ["0, 242, 254", "0, 122, 255", "135, 155, 255", "181, 138, 255"];

    particles = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: random(-7, 7),
      vy: random(-5, 5),
      radius: random(0.8, 1.8),
      phase: random(0, Math.PI * 2),
      color: colors[index % colors.length],
      pulse: random(0.72, 1.16),
    }));

    paint(0, performance.now());
  }

  function paint(delta, now) {
    context.clearRect(0, 0, width, height);
    const mobile = width < 640;
    const linkDistance = mobile ? 92 : 132;
    const linkDistanceSquared = linkDistance * linkDistance;
    const pointerIsActive = finePointer.matches && pointer.active && now - pointer.lastMove < 1400;

    for (const particle of particles) {
      if (delta > 0) {
        const drift = Math.sin(now * 0.00024 + particle.phase) * 1.4;
        particle.x += (particle.vx + drift) * delta;
        particle.y += (particle.vy + Math.cos(now * 0.00019 + particle.phase) * 1.1) * delta;

        if (particle.x < -16) particle.x = width + 16;
        else if (particle.x > width + 16) particle.x = -16;
        if (particle.y < -16) particle.y = height + 16;
        else if (particle.y > height + 16) particle.y = -16;
      }
    }

    context.lineWidth = 0.7;
    for (let i = 0; i < particles.length; i += 1) {
      const first = particles[i];
      for (let j = i + 1; j < particles.length; j += 1) {
        const second = particles[j];
        const dx = first.x - second.x;
        const dy = first.y - second.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > linkDistanceSquared) continue;

        const distance = Math.sqrt(distanceSquared);
        const alpha = (1 - distance / linkDistance) * (mobile ? 0.105 : 0.13);
        context.strokeStyle = `rgba(96, 193, 211, ${alpha})`;
        context.beginPath();
        context.moveTo(first.x, first.y);
        context.lineTo(second.x, second.y);
        context.stroke();
      }
    }

    if (pointerIsActive) {
      const radius = mobile ? 118 : 168;
      for (const particle of particles) {
        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const strength = 1 - distance / radius;
        context.strokeStyle = `rgba(0, 242, 254, ${strength * 0.16})`;
        context.beginPath();
        context.moveTo(pointer.x, pointer.y);
        context.lineTo(particle.x, particle.y);
        context.stroke();
      }
    }

    for (const particle of particles) {
      const pulse = 0.88 + Math.sin(now * 0.001 + particle.phase) * 0.12;
      context.beginPath();
      context.fillStyle = `rgba(${particle.color}, ${0.48 * particle.pulse * pulse})`;
      context.shadowColor = `rgba(${particle.color}, .62)`;
      context.shadowBlur = particle.radius * 5;
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.shadowBlur = 0;
  }

  function tick(now) {
    if (!running) return;
    const delta = previousTime ? Math.min((now - previousTime) / 1000, 0.04) : 0;
    previousTime = now;
    paint(delta, now);
    frameId = window.requestAnimationFrame(tick);
  }

  function start() {
    if (running || reducedMotion.matches || document.hidden) return;
    running = true;
    previousTime = 0;
    frameId = window.requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    window.cancelAnimationFrame(frameId);
    frameId = 0;
    previousTime = 0;
  }

  function syncMotionPreference() {
    if (reducedMotion.matches) {
      stop();
      paint(0, performance.now());
    } else {
      start();
    }
  }

  window.addEventListener("resize", resizeCanvas, { passive: true });
  window.addEventListener("pointermove", (event) => {
    if (!finePointer.matches || event.pointerType === "touch") return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.lastMove = performance.now();
    pointer.active = true;
  }, { passive: true });
  window.addEventListener("pointerleave", () => { pointer.active = false; }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  reducedMotion.addEventListener?.("change", syncMotionPreference);

  resizeCanvas();
  syncMotionPreference();
}
