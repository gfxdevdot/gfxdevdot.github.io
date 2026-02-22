(function () {
  'use strict';

  const preloader    = document.getElementById('preloader');
  const preloaderBar = document.getElementById('preloaderBar');
  const preloaderPct = document.getElementById('preloaderPct');
  let loadProgress = 0;
  const targetProgress = 100;

  function tickLoader() {
    if (loadProgress >= targetProgress) {
      preloaderPct.textContent = '100';
      preloaderBar.style.width = '100%';
      setTimeout(() => {
        preloader.classList.add('done');
        document.body.classList.add('loaded');
        initRevealForSection(document.querySelector('.section--hero'));
      }, 400);
      return;
    }
    loadProgress += Math.random() * 12 + 2;
    if (loadProgress > targetProgress) loadProgress = targetProgress;
    preloaderPct.textContent = Math.floor(loadProgress);
    preloaderBar.style.width = loadProgress + '%';
    requestAnimationFrame(() => setTimeout(tickLoader, 60 + Math.random() * 80));
  }
  tickLoader();

  const cursorEl  = document.getElementById('cursor');
  const cursorDot = document.getElementById('cursorDot');
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const cursorPos = { x: mouse.x, y: mouse.y };
  const dotPos    = { x: mouse.x, y: mouse.y };

  document.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  const hoverTargets = 'a, button, input, textarea, select, .svc, .plat-node, .exp-item';
  document.addEventListener('mouseover', e => {
    if (e.target.closest(hoverTargets)) document.body.classList.add('cursor-hover');
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(hoverTargets)) document.body.classList.remove('cursor-hover');
  });

  function animateCursor() {
    cursorPos.x += (mouse.x - cursorPos.x) * 0.12;
    cursorPos.y += (mouse.y - cursorPos.y) * 0.12;
    dotPos.x += (mouse.x - dotPos.x) * 0.6;
    dotPos.y += (mouse.y - dotPos.y) * 0.6;

    cursorEl.style.left  = cursorPos.x + 'px';
    cursorEl.style.top   = cursorPos.y + 'px';
    cursorDot.style.left = dotPos.x + 'px';
    cursorDot.style.top  = dotPos.y + 'px';

    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  const canvas = document.getElementById('bgCanvas');
  const ctx    = canvas.getContext('2d');
  let W, H;
  const particles = [];
  const PARTICLE_COUNT = 120;
  const CONNECTION_DIST = 150;
  let bgCanvasVisible = false;

  function checkBgCanvasVisibility() {
    const intro = document.getElementById('introSection');
    if (!intro) {
      bgCanvasVisible = true;
      canvas.style.opacity = '1';
      canvas.style.visibility = 'visible';
      return;
    }
    const rect = intro.getBoundingClientRect();
    const pastIntro = rect.bottom <= window.innerHeight * 0.5;
    if (pastIntro && !bgCanvasVisible) {
      bgCanvasVisible = true;
      canvas.style.transition = 'opacity 1s ease';
      canvas.style.visibility = 'visible';
      canvas.style.opacity = '1';
    } else if (!pastIntro && bgCanvasVisible) {
      bgCanvasVisible = false;
      canvas.style.opacity = '0';
      canvas.style.visibility = 'hidden';
    }
  }
  canvas.style.opacity = '0';
  canvas.style.visibility = 'hidden';
  window.addEventListener('scroll', checkBgCanvasVisibility, { passive: true });

  function resizeCanvas() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createParticles() {
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.3 + 0.1,
      });
    }
  }

  function drawParticles() {
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DIST) {
          const alpha = (1 - dist / CONNECTION_DIST) * 0.08;
          ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    const mouseInfluence = 200;
    for (const p of particles) {
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < mouseInfluence && dist > 0) {
        const alpha = (1 - dist / mouseInfluence) * 0.12;
        ctx.strokeStyle = `rgba(123, 97, 255, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
    }

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;

      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < mouseInfluence && dist > 0) {
        const force = (1 - dist / mouseInfluence) * 0.015;
        p.vx -= dx / dist * force;
        p.vy -= dy / dist * force;
      }

      p.vx *= 0.999;
      p.vy *= 0.999;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 255, ${p.alpha})`;
      ctx.fill();
    }

    requestAnimationFrame(drawParticles);
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
  });
  resizeCanvas();
  createParticles();
  drawParticles();

  const sections = document.querySelectorAll('.section');
  const navCurrentEl = document.getElementById('navCurrent');
  const scrollProgress = document.getElementById('scrollProgress');

  function initRevealForSection(section) {
    if (!section || section.classList.contains('in-view')) return;

    const revealLines = section.querySelectorAll('.reveal-line');
    revealLines.forEach((line, i) => {
      const parent = line.closest('[data-delay]');
      const baseDelay = parent ? parseFloat(parent.dataset.delay) : 0;
      const lineIndex = Array.from(line.parentElement.querySelectorAll('.reveal-line')).indexOf(line);
      const totalDelay = baseDelay + lineIndex * 0.1;
      const span = line.querySelector('span');
      if (span) {
        span.style.transitionDelay = totalDelay + 's';
      }
    });

    section.querySelectorAll('.reveal-fade').forEach(el => {
      const delay = el.dataset.delay || 0;
      el.style.transitionDelay = delay + 's';
    });

    void section.offsetHeight;
    section.classList.add('in-view');
  }

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        initRevealForSection(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });

  sections.forEach(s => sectionObserver.observe(s));

  const indexObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = entry.target.dataset.index;
        if (idx && navCurrentEl) navCurrentEl.textContent = idx;
      }
    });
  }, { threshold: 0.2 });

  sections.forEach(s => indexObserver.observe(s));

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    scrollProgress.style.width = pct + '%';

    const scrollHint = document.getElementById('scrollHint');
    if (scrollHint) {
      scrollHint.style.opacity = Math.max(0, 1 - scrollTop / 300);
    }
  }, { passive: true });

  const parallaxEls = document.querySelectorAll('[data-parallax]');
  let parallaxTicking = false;

  const introEl      = document.getElementById('introSection');
  const heroSection  = document.getElementById('hero');
  const heroInner    = heroSection ? heroSection.querySelector('.section-inner') : null;

  function updateParallax() {
    if (introEl && heroInner) {
      var introRect = introEl.getBoundingClientRect();
      var introEnd = introRect.bottom;
      var vh = window.innerHeight;
      var rawT = 1.0 - (introEnd / (vh * 1.5));
      var t = Math.max(0, Math.min(1, rawT));
      var eased = t * t * (3 - 2 * t);

      var yOff = (1 - eased) * 80; // 80px offset at start, 0 at end
      var scale = 0.97 + eased * 0.03;
      var opacity = 0.3 + eased * 0.7;
      heroInner.style.transform = 'translateY(' + yOff + 'px) scale(' + scale + ')';
      heroInner.style.opacity = opacity;
    }

    parallaxEls.forEach(el => {
      const parentSection = el.closest('.section');
      if (parentSection && !parentSection.classList.contains('in-view')) return;

      const speed = parseFloat(el.dataset.parallax) || 0.1;
      const rect = el.getBoundingClientRect();
      const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * speed;
      el.style.translate = `0 ${offset}px`;
    });
    parallaxTicking = false;
  }

  window.addEventListener('scroll', () => {
    if (!parallaxTicking) {
      parallaxTicking = true;
      requestAnimationFrame(updateParallax);
    }
  }, { passive: true });

  updateParallax();

  const menuBtn     = document.getElementById('navMenuBtn');
  const menuOverlay = document.getElementById('menuOverlay');

  menuBtn.addEventListener('click', () => {
    menuBtn.classList.toggle('active');
    menuOverlay.classList.toggle('open');
    document.body.style.overflow = menuOverlay.classList.contains('open') ? 'hidden' : '';
  });

  menuOverlay.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menuBtn.classList.remove('active');
      menuOverlay.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href === '#') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      try {
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (_) {  }
    });
  });

})();
