/**
 * Diagrams can be link targets — a lesson points back at one with "box ① in
 * the pipeline diagram". Landing there should be visible, so the figure gets
 * a brief accent frame.
 *
 * A CSS `:target` rule can't do this on its own: clicking the same link twice
 * doesn't change the hash, so the animation never re-runs. The highlight is
 * therefore driven from here, restarted on every click and on every route
 * update, and applied through the .diagram-flash class.
 */
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

const FLASH = 'diagram-flash';
const DURATION = 2200;

let clearTimer;

function flash(figure) {
  window.clearTimeout(clearTimer);
  figure.classList.remove(FLASH);
  // Force a reflow so removing and re-adding the class restarts the animation
  // rather than being collapsed into no change at all.
  void figure.offsetWidth;
  figure.classList.add(FLASH);
  clearTimer = window.setTimeout(() => figure.classList.remove(FLASH), DURATION);
}

function figureForHash(hash) {
  if (!hash || hash === '#') {
    return null;
  }
  let id;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    id = hash.slice(1);
  }
  const el = document.getElementById(id);
  return el && el.classList.contains('diagram') ? el : null;
}

if (ExecutionEnvironment.canUseDOM) {
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link) {
      return;
    }
    const href = link.getAttribute('href') || '';
    const hashIndex = href.indexOf('#');
    if (hashIndex < 0) {
      return;
    }
    const figure = figureForHash(href.slice(hashIndex));
    if (!figure) {
      return;
    }
    // When the hash is already current the router won't move the page, so do
    // the scrolling here. CSS scroll-margin keeps it clear of the navbar.
    if (window.location.hash === href.slice(hashIndex)) {
      event.preventDefault();
      figure.scrollIntoView({block: 'start', behavior: 'smooth'});
    }
    flash(figure);
  });
}

export function onRouteDidUpdate({location}) {
  const figure = figureForHash(location.hash);
  if (figure) {
    // Let the router finish its own scroll before drawing attention to it.
    window.setTimeout(() => flash(figure), 50);
  }
}
