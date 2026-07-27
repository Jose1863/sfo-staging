/* The Stakeholder's Family Office — progressive enhancement only.
   The page is fully usable with this file absent: content is visible,
   nav links work, and the form submits via its mailto action. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- scroll reveals ----
     Three tiers, in order of preference:
       1. GSAP + ScrollTrigger  : batched, staggered reveals plus scrub-linked parallax
       2. IntersectionObserver  : the original per-element reveal (GSAP absent or failed)
       3. everything visible    : reduced motion, or no observer support
     Tier 3 is also what a JS-off visitor gets, because .reveal is visible in CSS until
     the inline head script adds .js to <html>. */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

  function showAll() { revealEls.forEach(function (el) { el.classList.add("in"); }); }

  if (reduceMotion || !("IntersectionObserver" in window)) {
    showAll();
  } else if (hasGsap) {
    try { initGsap(); } catch (err) { showAll(); }   // never strand content invisible
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
    revealEls.forEach(function (el) { io.observe(el); });
    /* Failsafe: in throttled, prerendered, or webview tabs the observer can simply
       never fire, leaving a blank page. Something is always in the viewport at load,
       so if nothing has revealed by 1.6s the observer is broken: show everything.
       The worst case is "no animation", never "no content". */
    window.setTimeout(function () {
      if (!document.querySelector(".reveal.in")) { showAll(); }
    }, 1600);
  }

  function initGsap() {
    gsap.registerPlugin(ScrollTrigger);

    /* The CSS hides .reveal under html.js. GSAP now owns those elements, so clear the
       class hook and drive opacity/transform from inline styles instead. */
    document.documentElement.classList.add("gsap");

    /* Reveals, batched so a row of cards rises together with a short stagger rather
       than firing one element at a time. data-d ordering in the markup is preserved
       by ScrollTrigger.batch, which hands us elements in document order. */
    /* Sort every .reveal by where it sits at load, because ScrollTrigger.batch only
       fires onEnter on an actual crossing: anything already past its start point when
       the page opens would otherwise sit at opacity 0 permanently. Three groups:
         above  - scrolled past already (deep link, or a restored scroll position)
         inView - on screen now, so it animates immediately as the entrance
         below  - the normal case, revealed on scroll by the batch
       The 0.88 boundary is the same one the batch uses for its "top 88%" start. */
    var fold = window.innerHeight * 0.88;
    var above = [], inView = [], below = [], heroEls = [];

    revealEls.forEach(function (el) {
      if (el.closest(".hero")) { heroEls.push(el); return; }
      var top = el.getBoundingClientRect().top;
      if (top < 0) { above.push(el); }
      else if (top < fold) { inView.push(el); }
      else { below.push(el); }
    });

    /* Hero entrance: the hero reveals are CSS-visible before JS (LCP guarantee), so the
       entrance runs FROM hidden TO the natural visible state. The from() tween's end
       state is the stylesheet's, which removes the stranded-content class of bug by
       construction. */
    if (heroEls.length) {
      gsap.from(heroEls, { opacity: 0, y: 20, duration: 0.7, ease: "power3.out", stagger: 0.08, overwrite: true });
    }

    if (above.length) { gsap.set(above, { opacity: 1, y: 0 }); }

    if (inView.length) {
      gsap.to(inView, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.08,
        overwrite: true
      });
    }

    ScrollTrigger.batch(below, {
      start: "top 88%",
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.08,
          overwrite: true
        });
      }
    });

    /* Parallax on the two full-bleed photographic grounds (hero and CTA). Each sits in an
       inset:0 wrapper inside an overflow:hidden section, so the image is scaled
       slightly and drifts within that frame. At scroll position 0 the drift is at
       its start value, so nothing shifts before first paint. */
    var media = document.querySelectorAll(".hero-media img, .cta-media img");
    Array.prototype.forEach.call(media, function (img) {
      gsap.set(img, { scale: 1.14, willChange: "transform" });
      gsap.fromTo(img,
        { yPercent: -5 },
        {
          yPercent: 5,
          ease: "none",
          scrollTrigger: {
            trigger: img.closest("section"),
            start: "top bottom",
            end: "bottom top",
            scrub: true
          }
        }
      );
    });

    /* Gold rules draw in from the left. The rule is a brand element, so it gets motion
       of its own rather than riding the generic fade. The hero eyebrow is excluded on
       purpose: nothing above the fold waits on a tween. */
    var rules = document.querySelectorAll(".eyebrow");
    Array.prototype.forEach.call(rules, function (el) {
      if (el.closest(".hero")) { return; }
      gsap.fromTo(el,
        { "--rule-scale": 0 },
        {
          "--rule-scale": 1,
          duration: 0.9,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true }
        }
      );
    });

    /* Scroll progress bar, driven by ScrollTrigger instead of a scroll handler. */
    var progressBar = document.querySelector(".scroll-progress");
    if (progressBar) {
      gsap.to(progressBar, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 0.2 }
      });
    }

    /* Everything GSAP hides is registered here so the safety sweep below can rescue
       it. Anything appended to this list must end at opacity 1, y 0. */
    var managed = revealEls.slice();

    /* The compare panels answer each other: the fragmented stack lands first, the
       integrated column replies. Hidden only under GSAP, and only until the section
       nears the viewport. */
    var stackRows = gsap.utils.toArray(".stack-list li");
    var gainRows = gsap.utils.toArray(".gain-list li");
    if (stackRows.length && gainRows.length) {
      var compareRows = stackRows.concat(gainRows);
      gsap.set(compareRows, { opacity: 0, y: 12 });
      compareRows.forEach(function (el) { managed.push(el); });
      ScrollTrigger.create({
        trigger: ".compare",
        start: "top 78%",
        once: true,
        onEnter: function () {
          gsap.to(stackRows, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.07, overwrite: true });
          gsap.to(gainRows, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.07, delay: stackRows.length * 0.07 + 0.2, overwrite: true });
        }
      });
    }

    /* The 75/80/50 statistics do not animate. A rolling number reads as a sales
       device on figures about regret and unpreparedness; sober data sits still. */

    /* Framework phase dots pop in sequence, the one motion on the page that carries
       meaning: four phases of one continuous plan. Dots are 9px decoration, and the
       sweep restores them if the trigger never fires. */
    var phases = gsap.utils.toArray(".phase");
    if (phases.length) {
      gsap.set(phases, { "--dot-scale": 0 });
      ScrollTrigger.create({
        trigger: ".flow",
        start: "top 82%",
        once: true,
        onEnter: function () {
          gsap.to(phases, { "--dot-scale": 1, duration: 0.45, ease: "back.out(2)", stagger: 0.12 });
        }
      });
    }

    /* Scrollspy: the nav names its destinations; mark the one the reader is in.
       aria-current for assistive tech, a quiet underline for everyone else. */
    var navLinks = Array.prototype.slice.call(
      document.querySelectorAll('.nav-links a[href^="#"]:not(.btn)')
    );
    navLinks.forEach(function (link) {
      var target = document.querySelector(link.getAttribute("href"));
      if (!target) { return; }
      ScrollTrigger.create({
        trigger: target,
        start: "top 45%",
        end: "bottom 45%",
        onToggle: function (self) {
          if (self.isActive) {
            navLinks.forEach(function (l) {
              l.classList.remove("is-current");
              l.removeAttribute("aria-current");
            });
            link.classList.add("is-current");
            link.setAttribute("aria-current", "true");
          } else if (link.classList.contains("is-current")) {
            link.classList.remove("is-current");
            link.removeAttribute("aria-current");
          }
        }
      });
    });

    /* If the user switches to reduced motion mid-session, stop everything and settle
       every managed element into its final state, then hand the page back to the
       non-animated code paths. */
    var rmq = window.matchMedia("(prefers-reduced-motion: reduce)");
    function onMotionChange() {
      if (!rmq.matches) { return; }
      ScrollTrigger.getAll().forEach(function (t) { t.kill(); });
      gsap.globalTimeline.clear();
      gsap.set(managed, { opacity: 1, y: 0 });
      gsap.set(media, { clearProps: "transform" });
      gsap.set(rules, { "--rule-scale": 1 });
      gsap.set(phases, { "--dot-scale": 1 });
      if (progressBar) { gsap.set(progressBar, { clearProps: "transform" }); }
      document.documentElement.classList.remove("gsap");
    }
    if (rmq.addEventListener) { rmq.addEventListener("change", onMotionChange); }
    else if (rmq.addListener) { rmq.addListener(onMotionChange); }

    /* Safety net. This script is deferred, so it measures the page before the webfonts
       have settled and before images have reserved their space; the final layout can
       put an element on a different side of its trigger than it was at setup. Rather
       than trust one measurement, recheck after load and rescue anything that is on
       screen and still transparent. Visible content is the guarantee, not the animation. */
    function sweep() {
      ScrollTrigger.refresh();
      managed.forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight &&
            parseFloat(window.getComputedStyle(el).opacity) < 0.05 &&
            !gsap.isTweening(el)) {
          gsap.to(el, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", overwrite: true });
        }
      });
      phases.forEach(function (p) {
        var scale = parseFloat(window.getComputedStyle(p).getPropertyValue("--dot-scale") || "1");
        if (scale < 0.05 && !gsap.isTweening(p) &&
            p.getBoundingClientRect().top < window.innerHeight) {
          gsap.to(p, { "--dot-scale": 1, duration: 0.3 });
        }
      });
    }
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(sweep); }
    window.addEventListener("load", sweep);
  }

  /* ---- sticky header state ---- */
  var header = document.querySelector(".site-header");
  var progress = document.querySelector(".scroll-progress");
  var ticking = false;

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if (header) { header.classList.toggle("is-stuck", y > 8); }
    /* When GSAP is driving the bar via ScrollTrigger, stay out of its way. */
    if (progress && !reduceMotion && !document.documentElement.classList.contains("gsap")) {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var ratio = max > 0 ? y / max : 0;
      progress.style.transform = "scaleX(" + ratio.toFixed(4) + ")";
    }
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---- mobile nav ---- */
  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("nav");
  if (toggle && nav) {
    /* While the dropdown is open the page beneath stays visible but must be out of the
       tab order and the accessibility tree: inert on everything except the header. */
    var inertTargets = [document.getElementById("main"), document.querySelector(".site-footer"), document.querySelector(".mobile-cta")].filter(Boolean);
    function isOpen() { return toggle.getAttribute("aria-expanded") === "true"; }
    function setOpen(open) {
      nav.classList.toggle("open", open);
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.style.overflow = open ? "hidden" : "";   // lock background scroll while open
      inertTargets.forEach(function (el) {
        if (open) { el.setAttribute("inert", ""); } else { el.removeAttribute("inert"); }
      });
      if (open) {
        var first = nav.querySelector("a");
        /* The panel becomes focusable only once the .open styles apply, so a synchronous
           focus can silently fail; retry on the next frame and on a short timer (rAF can
           starve in background tabs, so neither channel alone is reliable). */
        if (first) {
          var tryFocus = function () {
            if (isOpen() && document.activeElement !== first) { first.focus(); }
          };
          tryFocus();
          requestAnimationFrame(tryFocus);
          window.setTimeout(tryFocus, 80);
        }
      }
    }
    toggle.addEventListener("click", function () { setOpen(!isOpen()); });
    nav.addEventListener("click", function (e) {
      /* Close on link-click without yanking focus back to the toggle: the click is a
         navigation, and returning focus would drag the reader away from the target. */
      if (e.target.closest("a")) { setOpen(false); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (isOpen() && !nav.contains(e.target) && !toggle.contains(e.target)) { setOpen(false); }
    });
  }

  /* ---- form: POST to the configured endpoint and confirm inline; fall back to
          the mailto action when no endpoint is set or the request fails ---- */
  var form = document.getElementById("callForm");
  var status = document.getElementById("formStatus");
  if (form && status) {
    var mailTo = form.getAttribute("data-mailto") || "info@eg-capital.co";

    function endpoint() {
      var url = form.getAttribute("data-endpoint") || "";
      return /^https?:\/\//.test(url) && url.indexOf("REPLACE_WITH_FORM_ID") === -1 ? url : "";
    }

    function openMailto() {
      var lines = [];
      Array.prototype.forEach.call(form.querySelectorAll("input, select, textarea"), function (el) {
        if (!el.name || !el.value) { return; }
        var lab = form.querySelector('label[for="' + el.id + '"]');
        var label = lab ? lab.textContent.replace(/\s*\*?\s*\(required\)\s*$/, "").trim() : el.name;
        lines.push(label + ": " + el.value);
      });
      window.location.href = "mailto:" + mailTo +
        "?subject=" + encodeURIComponent("Strategy call request") +
        "&body=" + encodeURIComponent(lines.join("\n"));
    }

    /* ---- validation. novalidate turns off the browser's own constraint UI, so
            everything it used to do has to be replaced deliberately: a message per
            field that says what to do, a visible invalid state, checking on blur so
            the reader learns before the button, and clearing the moment it is fixed. */
    var nameEl = form.querySelector("#f-name");
    var emailEl = form.querySelector("#f-email");
    var submitBtn = form.querySelector('button[type="submit"]');
    var submitLabel = submitBtn ? submitBtn.innerHTML : "";

    function setStatus(text, state) {
      status.textContent = text || "";
      status.className = "form-status" + (text && state ? " " + state : "");
    }

    /* The old status was the last node in the form and rendered ~82px below the fold
       at 1440x900, so the answer to a click arrived off-screen. It sits above the
       button now; this covers the phone case, where the button can still be the last
       thing on screen when the send resolves. */
    function revealStatus() {
      var r = status.getBoundingClientRect();
      if (r.top < 0 || r.bottom > (window.innerHeight || 0)) {
        status.scrollIntoView({ block: "center" });
      }
    }

    var CHECKS = {
      "f-name": function (v) {
        if (!v.trim()) { return "Add your name so we know who we are replying to."; }
        return "";
      },
      "f-email": function (v) {
        if (!v.trim()) { return "Add an email address so we can send the reply."; }
        /* checkValidity() accepts "a@b", which is valid per the HTML spec and useless
           as a reply address. Require a dotted domain with a real TLD. */
        if (!emailEl.checkValidity() || !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v.trim())) {
          return "That email is missing something. Check for a typo in the address, for example you@company.com.";
        }
        return "";
      }
    };

    function errNode(el) { return document.getElementById("err-" + el.id.replace(/^f-/, "")); }

    function showError(el, msg) {
      el.setAttribute("aria-invalid", "true");
      var n = errNode(el);
      if (n) { n.textContent = msg; n.classList.add("is-shown"); }
    }

    function clearError(el) {
      el.setAttribute("aria-invalid", "false");
      var n = errNode(el);
      if (n) { n.textContent = ""; n.classList.remove("is-shown"); }
    }

    function validate(el, quiet) {
      var check = CHECKS[el.id];
      if (!check) { return true; }
      var msg = check(el.value);
      if (msg) {
        if (!quiet) { showError(el, msg); }
        return false;
      }
      clearError(el);
      return true;
    }

    [nameEl, emailEl].forEach(function (el) {
      if (!el) { return; }
      /* blur teaches before the button; input forgives the moment it is corrected,
         so a reader is never scolded while still typing. */
      el.addEventListener("blur", function () { if (el.value.trim()) { validate(el); } });
      el.addEventListener("input", function () {
        if (el.getAttribute("aria-invalid") === "true" && validate(el, true)) {
          clearError(el);
          if (status.classList.contains("is-error")) { setStatus("", ""); }
        }
      });
    });

    /* Draft persistence. An interrupted reader who comes back, or anyone bounced out
       by the mailto fallback, previously found four empty fields and started again.
       sessionStorage, so it dies with the tab and nothing personal outlives the visit. */
    var DRAFT = "sfo-contact-draft";
    var draftFields = ["f-name", "f-email", "f-rev", "f-msg"];

    function saveDraft() {
      try {
        var d = {};
        draftFields.forEach(function (id) {
          var el = document.getElementById(id);
          if (el && el.value) { d[id] = el.value; }
        });
        window.sessionStorage.setItem(DRAFT, JSON.stringify(d));
      } catch (err) { /* private mode or a full quota: a lost draft is not worth throwing over */ }
    }

    function clearDraft() {
      try { window.sessionStorage.removeItem(DRAFT); } catch (err) {}
    }

    (function restoreDraft() {
      try {
        var raw = window.sessionStorage.getItem(DRAFT);
        if (!raw) { return; }
        var d = JSON.parse(raw);
        var restored = false;
        draftFields.forEach(function (id) {
          var el = document.getElementById(id);
          if (el && !el.value && d[id]) { el.value = d[id]; restored = true; }
        });
        /* Say so. Finding your own half-written text in a form with no explanation is
           unsettling, not helpful. */
        if (restored) { offerDiscard(); }
      } catch (err) {}
    })();

    /* One inline control idiom for the status line, shared by the discard escape hatch
       and the cancel-a-send control. Underlined text, never a button shape: the page
       has exactly one filled CTA and neither of these may read as a second. */
    function statusAction(label, onClick) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "status-action";
      btn.textContent = label;
      btn.addEventListener("click", onClick);
      status.appendChild(document.createTextNode(" "));
      status.appendChild(btn);
      return btn;
    }

    /* Restoring someone's text without offering a way out is a trap, not a courtesy:
       the reader who wants a clean form would otherwise have to empty four fields by
       hand. The control only exists when there is actually something to discard. */
    function offerDiscard() {
      setStatus("We kept what you had already typed.", "is-busy");
      statusAction("Start with a blank form", function () {
        form.reset();
        clearDraft();
        [nameEl, emailEl].filter(Boolean).forEach(clearError);
        setStatus("", "");
        if (nameEl) { nameEl.focus(); }
      });
    }

    draftFields.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.addEventListener("input", saveDraft); el.addEventListener("change", saveDraft); }
    });

    function busy(on) {
      if (!submitBtn) { return; }
      submitBtn.disabled = on;
      submitBtn.innerHTML = on ? "Sending" : submitLabel;
    }

    form.addEventListener("submit", function (e) {
      var fields = [nameEl, emailEl].filter(Boolean);
      var bad = fields.filter(function (el) { return !validate(el); });
      if (bad.length) {
        e.preventDefault();
        setStatus(bad.length === 1
          ? "One field needs a correction before we can send this. It is marked with the reason."
          : "Two fields need a correction before we can send this. Each is marked with the reason.", "is-error");
        /* Take the reader to the field and its message, not to the summary: the fix is
           what they need on screen. role="alert" carries the summary to AT regardless. */
        bad[0].scrollIntoView({ block: "center" });
        bad[0].focus();
        return;
      }
      /* NOTE: there is deliberately no client-side drop on the honeypot. Dropping the
         submit here saved a send against the monthly cap, but it did it by doing
         nothing at all: no status, no error, no navigation. A real prospect whose
         password manager or form-filler ignored autocomplete="off" and populated the
         trap would tap the primary CTA and watch the page die in silence, then leave
         without reporting it. A silently lost lead costs more than a wasted send.
         The field stays in the markup because Formspree consumes _gotcha server-side,
         which is where a spam check belongs. */

      var url = endpoint();
      if (!url) {
        /* No endpoint configured, so the native mailto action runs and the page stays
           where it is. Nothing is in flight and nothing will ever resolve, so this must
           not be a busy state: a spinner that never ends is a lie. Neutral state, a
           report of what just happened, and an address that works when the handoff to
           the mail client does not. */
        setStatus("Your email app should be opening with this request. If it does not, write to ", "");
        var link = document.createElement("a");
        link.className = "status-action";
        link.href = "mailto:" + mailTo;
        link.textContent = mailTo;
        status.appendChild(link);
        status.appendChild(document.createTextNode(" directly."));
        revealStatus();
        return;
      }
      e.preventDefault();
      /* A send the reader cannot stop is a send they have to sit through. The request
         gets an AbortController and the status line gets a way to use it. */
      var controller = window.AbortController ? new window.AbortController() : null;
      var aborted = false;
      setStatus("Sending your request.", "is-busy");
      if (controller) {
        statusAction("Cancel", function () {
          aborted = true;
          controller.abort();
          busy(false);
          setStatus("", "");
          /* The clicked control leaves the DOM with the status text, so hand focus back
             to the button rather than dropping it on the body. */
          if (submitBtn) { submitBtn.focus(); }
        });
      }
      busy(true);
      var opts = { method: "POST", body: new FormData(form), headers: { "Accept": "application/json" } };
      if (controller) { opts.signal = controller.signal; }
      fetch(url, opts)
        .then(function (r) {
          if (!r.ok) { throw new Error("bad status"); }
          form.reset();
          clearDraft();
          fields.forEach(clearError);
          busy(false);
          setStatus("Thank you. We will reply within one business day.", "is-ok");
          revealStatus();
        })
        .catch(function (err) {
          /* An abort is a decision, not a failure. It gets no error state and no mailto
             fallback: the reader asked for the send to stop, not for another one. */
          if (aborted || (err && err.name === "AbortError")) { return; }
          busy(false);
          setStatus("We could not send that just now. Opening your email app as a fallback.", "is-error");
          revealStatus();
          openMailto();
        });
    });
  }

  /* ---- hide the sticky mobile CTA where a CTA is already on screen
          (the hero and the contact form both carry one) ---- */
  var mcta = document.querySelector(".mobile-cta");
  var ctaZones = [document.querySelector(".hero"), document.getElementById("contact")].filter(Boolean);
  if (mcta && ctaZones.length && "IntersectionObserver" in window) {
    var inView = new Set();
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { inView.add(en.target); } else { inView.delete(en.target); }
      });
      document.body.classList.toggle("cta-near", inView.size > 0);
      syncTop();   // the back-to-top control hides wherever a CTA is already on screen
    }, { rootMargin: "0px 0px -35% 0px" });
    ctaZones.forEach(function (z) { cio.observe(z); });
  }

  /* ---- back to top ----
     One fixed control at every width, for a page that runs to roughly 22,000px at 375px
     wide and 13,982px at 1440. Two conditions gate it, and both matter: past two viewports, and only
     while the reader is moving UP. Direction is the whole mitigation. A control that
     appeared on the way down would arrive beside the sticky gold CTA and split the one
     action the page asks for; a reader moving back up has already declined that action
     and is looking for something else. The cta-near class from the observer above is
     reused rather than observed again, so hero and #contact suppress both controls
     together and there is one definition of "a CTA is already on screen". */
  var toTop = document.getElementById("toTop");
  var topShown = false;
  var topWanted = false;
  var lastTopY = window.pageYOffset || document.documentElement.scrollTop;

  function syncTop() {
    if (!toTop) { return; }
    var on = topWanted && !document.body.classList.contains("cta-near");
    if (on === topShown) { return; }
    topShown = on;
    document.body.classList.toggle("show-top", on);
    /* Out of the tab order when hidden, not merely invisible. A fixed control a keyboard
       user can reach but cannot see is worse than no control at all. */
    if (on) { toTop.removeAttribute("inert"); } else { toTop.setAttribute("inert", ""); }
  }

  if (toTop) {
    /* Direction is read on the raw scroll event rather than in the rAF-throttled handler
       above: coalescing frames would merge a reversal into a single net delta and the
       turn would be missed. The work is two comparisons and a guarded class toggle. */
    window.addEventListener("scroll", function () {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      if (y < window.innerHeight * 2) { topWanted = false; }
      else if (y < lastTopY - 4) { topWanted = true; }
      else if (y > lastTopY) { topWanted = false; }
      lastTopY = y;
      syncTop();
    }, { passive: true });

    toTop.addEventListener("click", function () {
      /* Read the preference at click time, not at load: someone can turn it on mid-visit,
         and the rest of the file already honours that. */
      var instant = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: instant ? "auto" : "smooth" });
      topWanted = false;
      syncTop();
      /* The control leaves the screen at the top of the page, so focus cannot stay on it.
         Hand it to the first thing at the destination, without letting focus() cancel the
         smooth scroll by jumping the page itself. */
      var brand = document.querySelector(".site-header .brand");
      if (brand) { brand.focus({ preventScroll: true }); }
    });
  }

  /* ---- FAQ: open every answer at once ----
     Eight questions, and the only way to read them was eight taps. This is the page's one
     accelerator, and it is deliberately a text control on the .status-action idiom, not a
     button shape: there is exactly one filled gold control on the page and nothing may
     read as a second. Built in JS rather than shipped in the markup, so a reader without
     JS is never offered a control that cannot work. The native <details> are untouched and
     keep opening on their own either way; this only sets and clears their open attribute.
     The label is the state, and it re-syncs when an individual answer is toggled, so the
     control can never claim "Close all" over a list the reader has partly closed. */
  var faqList = document.getElementById("faqList");
  var faqItems = faqList ? faqList.querySelectorAll("details.faq-item") : [];
  if (faqList && faqItems.length > 1) {
    var faqBar = document.createElement("div");
    faqBar.className = "faq-bar";
    var faqAll = document.createElement("button");
    faqAll.type = "button";
    faqAll.className = "status-action";
    faqAll.setAttribute("aria-controls", "faqList");
    faqBar.appendChild(faqAll);
    faqList.insertBefore(faqBar, faqList.firstChild);

    var syncFaqAll = function () {
      var open = 0;
      Array.prototype.forEach.call(faqItems, function (d) { if (d.open) { open++; } });
      var allOpen = open === faqItems.length;
      faqAll.textContent = allOpen ? "Close all" : "Open all";
      faqAll.setAttribute("aria-expanded", allOpen ? "true" : "false");
    };

    faqAll.addEventListener("click", function () {
      var wantOpen = faqAll.getAttribute("aria-expanded") !== "true";
      Array.prototype.forEach.call(faqItems, function (d) { d.open = wantOpen; });
      syncFaqAll();
    });
    Array.prototype.forEach.call(faqItems, function (d) {
      d.addEventListener("toggle", syncFaqAll);
    });
    syncFaqAll();
  }

  /* ---- current year, if a placeholder is present ---- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) { yearEl.textContent = String(new Date().getFullYear()); }
})();
