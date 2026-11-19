(function () {
  'use strict';

  const header = document.querySelector('.recruit-unified-header');
  if (!header) return;

  const toggle = header.querySelector('.recruit-nav-toggle');
  const menu = header.querySelector('.recruit-nav-mobile');
  if (!toggle || !menu) return;

  function setOpen(open, restoreFocus) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    if (!open && restoreFocus) toggle.focus();
  }

  toggle.addEventListener('click', function () {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true', false);
  });
  menu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () { setOpen(false, false); });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !menu.hidden) setOpen(false, true);
  });
  document.addEventListener('pointerdown', function (event) {
    if (!menu.hidden && !header.contains(event.target)) setOpen(false, false);
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth > 980 && !menu.hidden) setOpen(false, false);
  });
}());
