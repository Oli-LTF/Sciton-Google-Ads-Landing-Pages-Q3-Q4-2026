/* ==========================================================================
   Sciton UK — Google Ads landing page behaviour
   No dependencies. All motion via transform/opacity.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------------
     1. Scroll reveals
     Drives the theme's own .js-fade / .js-animated CSS with an
     IntersectionObserver. Children of .js-fade-group get .js-fade so the
     theme's nth-child stagger delays apply.
     ---------------------------------------------------------------------- */
  function initReveals() {
    var groups = document.querySelectorAll('.js-fade-group');
    Array.prototype.forEach.call(groups, function (group) {
      Array.prototype.forEach.call(group.children, function (child) {
        child.classList.add('js-fade');
      });
    });

    var targets = document.querySelectorAll('.js-fade, .js-fade-group');

    if (reduceMotion || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add('js-animated'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('js-animated');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

    Array.prototype.forEach.call(targets, function (el) { observer.observe(el); });
  }

  /* ------------------------------------------------------------------------
     2. FAQ accordion
     Uses the theme's .is-open / .is-icon-plus-minus state classes.
     Disclosure runs at 0.5s ease — deliberately slower than the 0.15s used
     on links and buttons, matching sciton.uk.
     ---------------------------------------------------------------------- */
  function initAccordion() {
    var triggers = document.querySelectorAll('.accordion-trigger');

    Array.prototype.forEach.call(triggers, function (trigger) {
      var item = trigger.closest('.content-accordion__item');
      var panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!item || !panel) return;

      panel.classList.remove('hidden');
      panel.style.overflow = 'hidden';
      panel.style.height = '0px';
      if (!reduceMotion) panel.style.transition = 'height .5s ease';

      var pending = null;

      var timer = null;

      function clearPending() {
        if (pending) {
          panel.removeEventListener('transitionend', pending);
          pending = null;
        }
        if (timer) { clearTimeout(timer); timer = null; }
      }

      function settleOpen() {
        clearPending();
        panel.style.height = 'auto';
      }

      function open() {
        clearPending();
        panel.style.height = panel.scrollHeight + 'px';
        if (reduceMotion) { panel.style.height = 'auto'; return; }
        pending = function (e) {
          if (e.propertyName !== 'height') return;
          settleOpen();
        };
        panel.addEventListener('transitionend', pending);
        // transitionend does not fire if the transition is interrupted or the
        // element is not being painted; settle on a timer either way.
        timer = setTimeout(settleOpen, 600);
      }

      function close() {
        clearPending();
        if (reduceMotion) { panel.style.height = '0px'; return; }
        // Pin the current auto height, force a reflow so the browser has a
        // concrete start value, then animate to zero. requestAnimationFrame
        // is not sufficient here: the two writes get coalesced and the
        // transition never starts.
        panel.style.height = panel.scrollHeight + 'px';
        void panel.offsetHeight;
        panel.style.height = '0px';
      }

      trigger.addEventListener('click', function () {
        var isOpen = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', String(!isOpen));
        item.classList.toggle('is-open', !isOpen);
        if (isOpen) close(); else open();
      });
    });
  }

  /* ------------------------------------------------------------------------
     3. Anchor nav scrollspy
     ---------------------------------------------------------------------- */
  function initScrollspy() {
    var links = document.querySelectorAll('.anchor-nav a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;

    var map = {};
    var sections = [];
    Array.prototype.forEach.call(links, function (link) {
      var id = link.getAttribute('href').slice(1);
      var section = document.getElementById(id);
      if (!section) return;
      map[id] = link;
      sections.push(section);
    });

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Array.prototype.forEach.call(links, function (l) { l.classList.remove('is-active'); });
        if (map[entry.target.id]) map[entry.target.id].classList.add('is-active');
      });
    }, { rootMargin: '-30% 0px -60% 0px' });

    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ------------------------------------------------------------------------
     4. Smooth in-page scrolling, offset for the fixed navbar + sticky nav
     ---------------------------------------------------------------------- */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute('href').slice(1);
      if (!id) return;
      var target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();
      var navbar = document.querySelector('.navbar');
      var anchorNav = document.querySelector('.anchor-nav');
      var offset = (navbar ? navbar.offsetHeight : 0) + (anchorNav ? anchorNav.offsetHeight : 0);
      var top = target.getBoundingClientRect().top + window.pageYOffset - offset;

      window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  /* ------------------------------------------------------------------------
     5. Sticky mobile CTA — appears once the hero CTA has scrolled away
     ---------------------------------------------------------------------- */
  function initStickyCta() {
    var bar = document.querySelector('.lp-sticky');
    var hero = document.getElementById('hero');
    if (!bar || !hero || !('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function (entries) {
      bar.classList.toggle('is-visible', !entries[0].isIntersecting);
    }, { threshold: 0 });

    observer.observe(hero);
  }

  /* ------------------------------------------------------------------------
     6. Sciton iQ reels — scroll-linked counter-slide
     As the section travels through the viewport the top reel slides right and
     the bottom reel slides left (about 15% each way), matching the treatment
     on sciton.com/joule.

     Runs a rAF loop only while the section is on screen, gated by an
     IntersectionObserver. Layout is read once per frame and only transform
     is written, so this never triggers a reflow.
     ---------------------------------------------------------------------- */
  function initReels() {
    var section = document.querySelector('.graphic-screens');
    if (!section) return;

    var top = section.querySelector('.top-reel');
    var bottom = section.querySelector('.bottom-reel');
    if (!top || !bottom) return;

    // Leave the theme's static -15% / +15% rest state in place.
    if (reduceMotion) return;

    var SHIFT = 15;   // percent, matches the theme's rest state

    // Scroll events are dispatched at most once per frame, and this does one
    // rect read plus two transform writes on a single element — cheap enough
    // to run directly, and it invalidates no layout.
    function draw() {
      var rect = section.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var travel = rect.height + vh;

      // 0 when the section's top reaches the bottom of the viewport,
      // 1 when its bottom reaches the top.
      var progress = travel > 0 ? (vh - rect.top) / travel : 0;
      if (progress < 0) progress = 0;
      if (progress > 1) progress = 1;

      var offset = (progress * 2 - 1) * SHIFT;   // -SHIFT .. +SHIFT
      top.style.transform = 'translate3d(' + offset.toFixed(2) + '%, 0, 0)';
      bottom.style.transform = 'translate3d(' + (-offset).toFixed(2) + '%, 0, 0)';
    }

    window.addEventListener('scroll', draw, { passive: true });
    window.addEventListener('resize', draw, { passive: true });
    // images settling can change the section's position after first paint
    window.addEventListener('load', draw);
    draw();
  }

  /* ------------------------------------------------------------------------
     7. Demo form
     Client-side validation only. Submission is left unwired — see README.
     Fires a dataLayer event so Google Ads conversion tracking can attach
     without editing markup.
     ---------------------------------------------------------------------- */
  function initForm() {
    var form = document.getElementById('demo-form');
    if (!form) return;

    var status = form.querySelector('.lp-form__status');

    // The error paragraph is found via the field's wrapper rather than as an
    // adjacent sibling: the consent inputs sit inside their <label>, so a
    // sibling selector would never reach them.
    function validate(field) {
      var valid = field.checkValidity();
      field.setAttribute('aria-invalid', String(!valid));
      var wrapper = field.closest('.lp-form__field');
      var error = wrapper && wrapper.querySelector('.lp-form__error');
      if (error) error.classList.toggle('is-visible', !valid);
      return valid;
    }

    Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (field) {
      var evt = field.type === 'checkbox' ? 'change' : 'blur';
      field.addEventListener(evt, function () { validate(field); });
      field.addEventListener('input', function () {
        if (field.getAttribute('aria-invalid') === 'true') validate(field);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var fields = form.querySelectorAll('[required]');
      var firstInvalid = null;
      Array.prototype.forEach.call(fields, function (field) {
        if (!validate(field) && !firstInvalid) firstInvalid = field;
      });

      if (firstInvalid) {
        firstInvalid.focus();
        if (status) status.textContent = 'Please check the highlighted fields.';
        return;
      }

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'generate_lead',
        form_id: 'demo-form',
        campaign: form.getAttribute('data-campaign') || 'C1-sciton-brand',
        product_interest: (form.querySelector('[name="interest"]') || {}).value || '',
        budget: (form.querySelector('[name="budget"]') || {}).value || '',
        marketing_opt_in: !!(form.querySelector('[name="marketing"]') || {}).checked
      });

      // TODO: POST to the endpoint named in data-endpoint. See README.md.
      if (status) {
        status.textContent = 'Form validated. Submission endpoint is not yet connected — see README.md.';
      }
    });
  }

  /* ---------------------------------------------------------------------- */
  function init() {
    initReveals();
    initAccordion();
    initScrollspy();
    initSmoothScroll();
    initStickyCta();
    initReels();
    initForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
