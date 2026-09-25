// Shared model navigation for the two electromagnetic labs.
(() => {
  const nav = document.querySelector('.model-nav-shell .model-nav');
  if (!nav) return;

  const shell = nav.closest('.model-nav-shell');
  const previous = shell.querySelector('[data-nav-step="-1"]');
  const next = shell.querySelector('[data-nav-step="1"]');
  const tabs = [...nav.querySelectorAll('.nav-tab')];

  function updateArrows() {
    const maxScroll = Math.max(0, nav.scrollWidth - nav.clientWidth);
    previous.disabled = nav.scrollLeft <= 1;
    next.disabled = nav.scrollLeft >= maxScroll - 1;
    shell.classList.toggle('is-scrollable', maxScroll > 1);
  }

  for (const arrow of [previous, next]) {
    arrow.addEventListener('click', () => {
      nav.scrollBy({ left: Number(arrow.dataset.navStep) * Math.max(180, nav.clientWidth * 0.75), behavior: 'smooth' });
    });
  }

  let drag = null;
  let ignoreClick = false;

  nav.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' || event.button !== 0) return;
    drag = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: nav.scrollLeft, moved: false };
  });

  nav.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(distance) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      nav.classList.add('is-dragging');
      nav.setPointerCapture?.(event.pointerId);
    }
    nav.scrollLeft = drag.startScrollLeft - distance;
    event.preventDefault();
  });

  function finishDrag(event) {
    if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    const pointerId = drag.pointerId;
    const moved = drag.moved;
    drag = null;
    nav.classList.remove('is-dragging');
    if (moved) {
      ignoreClick = true;
      setTimeout(() => { ignoreClick = false; }, 0);
    }
    if (nav.hasPointerCapture?.(pointerId)) nav.releasePointerCapture(pointerId);
    updateArrows();
  }

  nav.addEventListener('pointerup', finishDrag);
  nav.addEventListener('pointercancel', finishDrag);
  nav.addEventListener('lostpointercapture', finishDrag);
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);
  window.addEventListener('blur', () => finishDrag());

  nav.addEventListener('click', (event) => {
    if (!ignoreClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ignoreClick = false;
  }, true);

  nav.addEventListener('keydown', (event) => {
    const tab = event.target.closest('.nav-tab');
    if (!tab) return;
    const index = tabs.indexOf(tab);
    const nextIndex = event.key === 'ArrowRight' ? index + 1
      : event.key === 'ArrowLeft' ? index - 1
      : event.key === 'Home' ? 0
      : event.key === 'End' ? tabs.length - 1 : -1;
    if (nextIndex < 0 || nextIndex >= tabs.length || nextIndex === index) return;
    event.preventDefault();
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  });

  nav.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  window.addEventListener('load', updateArrows);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateArrows).observe(nav);
  requestAnimationFrame(updateArrows);
})();
