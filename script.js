(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const sky = document.getElementById('starfield');

  // A small, repeatable starfield avoids layout work on pointer movement.
  let seed = 120935;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  if (sky) {
    const stars = document.createDocumentFragment();
    const count = window.matchMedia('(max-width: 680px)').matches ? 55 : 90;
    for (let index = 0; index < count; index += 1) {
      const star = document.createElement('span');
      const opacity = (0.25 + random() * 0.55).toFixed(2);
      star.className = index < 7 ? 'star big' : 'star';
      star.style.left = `${(random() * 100).toFixed(2)}%`;
      star.style.top = `${(random() * 100).toFixed(2)}%`;
      star.style.opacity = opacity;
      star.style.setProperty('--star-opacity', opacity);
      star.style.animationDelay = `${(-random() * 12).toFixed(2)}s`;
      star.style.animationDuration = `${(7 + random() * 8).toFixed(2)}s`;
      stars.appendChild(star);
    }
    sky.appendChild(stars);
  }

  const sparkleLayer = document.createElement('div');
  sparkleLayer.className = 'cursor-sparkles';
  sparkleLayer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(sparkleLayer);

  // Pointer feedback is separate from the decorative mouse sparkles so it
  // works on touch screens, too, without intercepting clicks or scrolling.
  const pulseLayer = document.createElement('div');
  pulseLayer.className = 'tap-pulses';
  pulseLayer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(pulseLayer);

  const sparkles = new Map();
  let lastSparkleTime = -Infinity;
  let lastSparklePosition = null;

  const removeSparkle = (sparkle) => {
    window.clearTimeout(sparkles.get(sparkle));
    sparkles.delete(sparkle);
    sparkle.remove();
  };

  const clearSparkles = () => {
    for (const sparkle of sparkles.keys()) removeSparkle(sparkle);
    lastSparklePosition = null;
    lastSparkleTime = -Infinity;
  };

  // Keep a bounded number of short-lived rings; timer cleanup is a fallback
  // for browsers that suppress animationend during navigation or tab switches.
  const pulses = new Map();
  const removePulse = (pulse) => {
    window.clearTimeout(pulses.get(pulse));
    pulses.delete(pulse);
    pulse.remove();
  };
  const clearPulses = () => {
    for (const pulse of pulses.keys()) removePulse(pulse);
  };

  const effectsPaused = () => reducedMotion.matches;
  // Safari and embedded iOS browsers vary in which pointer events they send.
  // All sources share a small coordinate/time dedupe to avoid double rings.
  let lastPulseAt = -Infinity;
  let lastPulsePosition = null;
  let lastTouchAt = -Infinity;

  const showPulse = (x, y) => {
    if (document.hidden || pulses.size >= 8) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const now = performance.now();
    if (lastPulsePosition && now - lastPulseAt < 120 && Math.hypot(
      x - lastPulsePosition.x, y - lastPulsePosition.y
    ) < 24) return;

    lastPulseAt = now;
    lastPulsePosition = { x, y };
    const staticFeedback = reducedMotion.matches;
    const pulse = document.createElement('span');
    pulse.className = staticFeedback ? 'tap-pulse tap-pulse-static' : 'tap-pulse';
    pulse.style.left = `${x}px`;
    pulse.style.top = `${y}px`;
    pulse.addEventListener('animationend', () => removePulse(pulse), { once: true });
    pulseLayer.appendChild(pulse);
    pulses.set(pulse, window.setTimeout(() => removePulse(pulse), staticFeedback ? 250 : 700));
  };

  const syncMotion = () => {
    const paused = effectsPaused();
    const state = paused || document.hidden ? 'paused' : 'running';
    document.body.dataset.motion = state;
    document.documentElement.dataset.motion = state;

    if (paused || document.hidden || !finePointer.matches) clearSparkles();
    if (document.hidden || reducedMotion.matches) clearPulses();

  };

  document.addEventListener('pointerdown', (event) => {
    if (event.isPrimary === false) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.pointerType === 'touch') lastTouchAt = performance.now();
    showPulse(event.clientX, event.clientY);
  }, { passive: true });

  // touchstart is an explicit fallback for Safari/iOS WebViews. It also
  // handles devices where PointerEvent exists but pointerdown is not fired.
  document.addEventListener('touchstart', (event) => {
    if ((event.touches && event.touches.length > 1) ||
        !event.changedTouches || event.changedTouches.length !== 1) return;
    lastTouchAt = performance.now();
    const point = event.changedTouches[0];
    showPulse(point.clientX, point.clientY);
  }, { passive: true });

  // Older browsers may have mouse events without Pointer Events.
  document.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || performance.now() - lastTouchAt < 900) return;
    showPulse(event.clientX, event.clientY);
  }, { passive: true });

  document.addEventListener('pointermove', (event) => {
    if (effectsPaused() || document.hidden || !finePointer.matches || event.pointerType !== 'mouse') return;
    if (event.buttons !== 0 || sparkles.size >= 6) return;

    const now = performance.now();
    if (now - lastSparkleTime < 160) return;
    if (lastSparklePosition && Math.hypot(
      event.clientX - lastSparklePosition.x,
      event.clientY - lastSparklePosition.y
    ) < 24) return;

    lastSparkleTime = now;
    lastSparklePosition = { x: event.clientX, y: event.clientY };

    const sparkle = document.createElement('span');
    sparkle.className = 'cursor-sparkle';
    sparkle.textContent = '✦';
    sparkle.style.left = `${event.clientX}px`;
    sparkle.style.top = `${event.clientY}px`;
    sparkle.addEventListener('animationend', () => removeSparkle(sparkle), { once: true });
    sparkleLayer.appendChild(sparkle);

    // This also removes nodes when animation events are unavailable or CSS fails.
    sparkles.set(sparkle, window.setTimeout(() => removeSparkle(sparkle), 900));
  }, { passive: true });

  // Keep OS and pointer changes live; older Safari exposes addListener instead.
  for (const query of [reducedMotion, finePointer]) {
    if (query.addEventListener) query.addEventListener('change', syncMotion);
    else query.addListener(syncMotion);
  }

  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('pagehide', () => {
    clearSparkles();
    clearPulses();
  });
  window.addEventListener('pageshow', syncMotion);
  syncMotion();
})();

