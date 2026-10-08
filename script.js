(() => {
  'use strict';

  const motionPreferenceKey = 'aster-motion';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const motionToggle = document.getElementById('motion-toggle');
  const sky = document.getElementById('starfield');
  let userPaused = false;

  // Storage can be unavailable in private browsing or local-file previews.
  try {
    userPaused = window.localStorage.getItem(motionPreferenceKey) === 'paused';
  } catch (_) {
    // Motion controls still work for this visit without persistence.
  }

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

  const effectsPaused = () => userPaused || reducedMotion.matches;

  const syncMotion = () => {
    const paused = effectsPaused();
    const state = paused || document.hidden ? 'paused' : 'running';
    document.body.dataset.motion = state;
    document.documentElement.dataset.motion = state;

    if (paused || document.hidden || !finePointer.matches) clearSparkles();
    if (paused || document.hidden) clearPulses();

    if (motionToggle) {
      motionToggle.hidden = false;
      motionToggle.disabled = reducedMotion.matches;
      motionToggle.setAttribute('aria-pressed', String(paused));
      motionToggle.textContent = reducedMotion.matches
        ? 'Reduced motion on'
        : userPaused ? 'Resume effects' : 'Pause effects';
    }
  };

  if (motionToggle) {
    motionToggle.addEventListener('click', () => {
      // The operating-system preference takes precedence over a saved choice.
      if (reducedMotion.matches) return;
      userPaused = !userPaused;
      try {
        window.localStorage.setItem(motionPreferenceKey, userPaused ? 'paused' : 'running');
      } catch (_) {
        // A blocked store must not prevent the current choice taking effect.
      }
      syncMotion();
    });
  }

  document.addEventListener('pointerdown', (event) => {
    if (effectsPaused() || document.hidden || !event.isPrimary || pulses.size >= 8) return;
    // A context-menu click should not create a decorative tap effect.
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const pulse = document.createElement('span');
    pulse.className = 'tap-pulse';
    pulse.style.left = `${event.clientX}px`;
    pulse.style.top = `${event.clientY}px`;
    pulse.addEventListener('animationend', () => removePulse(pulse), { once: true });
    pulseLayer.appendChild(pulse);
    pulses.set(pulse, window.setTimeout(() => removePulse(pulse), 700));
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

