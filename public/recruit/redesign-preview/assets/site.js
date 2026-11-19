(function () {
  'use strict';

  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  const mobileNav = document.getElementById('mobile-menu');
  const backToTop = document.querySelector('.back-to-top');

  if (!header || !toggle || !mobileNav || !backToTop) return;

  function setMenuOpen(open, returnFocus) {
    mobileNav.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    if (!open && returnFocus) toggle.focus();
  }

  toggle.addEventListener('click', function () {
    setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true', false);
  });

  mobileNav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      setMenuOpen(false, false);
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !mobileNav.hidden) {
      setMenuOpen(false, true);
    }
  });

  document.addEventListener('pointerdown', function (event) {
    if (!mobileNav.hidden && !header.contains(event.target)) {
      setMenuOpen(false, false);
    }
  });

  const desktop = window.matchMedia('(min-width: 981px)');
  function handleViewportChange(event) {
    if (event.matches) setMenuOpen(false, false);
  }
  if (typeof desktop.addEventListener === 'function') {
    desktop.addEventListener('change', handleViewportChange);
  } else if (typeof desktop.addListener === 'function') {
    desktop.addListener(handleViewportChange);
  }

  let scrolling = false;
  function updateBackToTop() {
    backToTop.hidden = window.scrollY < 420;
    scrolling = false;
  }
  window.addEventListener('scroll', function () {
    if (!scrolling) {
      scrolling = true;
      window.requestAnimationFrame(updateBackToTop);
    }
  }, { passive: true });
  updateBackToTop();
}());
