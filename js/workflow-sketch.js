(function () {
  'use strict';

  const canvases = [...document.querySelectorAll('[data-sketch]')];
  const pause = document.getElementById('sketchPause');
  if (!canvases.length || !pause) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const brand = getComputedStyle(document.documentElement);
  const token = name => brand.getPropertyValue(`--brand-${name}`).trim();
  const colors = { text: token('text'), muted: token('muted'), green: token('green'), amber: token('amber'), cyan: token('cyan'), line: '#324647' };
  const visible = new Set();
  let frame = 0;
  let elapsed = 0;
  let previous = 0;

  function text(context, value, horizontal, vertical, color = colors.text, size = 13) {
    context.fillStyle = color;
    context.font = `${size}px monospace`;
    context.fillText(value, horizontal, vertical);
  }

  function line(context, start, end, color, dashed = false) {
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.setLineDash(dashed ? [6, 6] : []);
    context.beginPath();
    context.moveTo(...start);
    context.lineTo(...end);
    context.stroke();
    context.setLineDash([]);
  }

  function node(context, label, horizontal, vertical, width, color, detail) {
    context.fillStyle = token('surface');
    context.fillRect(horizontal, vertical, width, 48);
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.strokeRect(horizontal, vertical, width, 48);
    text(context, label, horizontal + 9, vertical + 21, colors.text, 11);
    if (detail) text(context, detail, horizontal + 9, vertical + 38, color, 9);
  }

  function draw(canvas, time) {
    const context = canvas.getContext('2d');
    if (!context) return;
    const bounds = canvas.getBoundingClientRect();
    const width = bounds.width;
    const height = bounds.height;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = token('bg');
    context.fillRect(0, 0, width, height);
    const compact = width < 600;
    const scale = width / (compact ? 360 : 900);
    context.scale(scale, scale);
    const logicalWidth = width / scale;
    const logicalHeight = height / scale;
    const margin = 18;
    const pulse = (time * 0.28) % 1;
    const kind = canvas.dataset.sketch;

    const contentWidth = logicalWidth - margin * 2;
    const travel = (start, end, color) => {
      line(context, start, end, colors.line);
      context.fillStyle = color;
      context.beginPath();
      context.arc(start[0] + (end[0] - start[0]) * pulse, start[1] + (end[1] - start[1]) * pulse, 3, 0, Math.PI * 2);
      context.fill();
    };

    if (kind === 'capture') {
      const column = contentWidth * 0.41;
      const right = logicalWidth - margin - column;
      text(context, 'LEGACY GAME', margin, 28, colors.green, 11);
      text(context, 'MODERN PLATFORM', right, 28, colors.amber, 11);
      const rows = [
        ['GAME CODE', 'SOURCE / BINARY', 'MODERN BUILD', 'ADAPT RUNTIME'],
        ['GRAPHICS CALLS', 'RECOVER BEHAVIOR', 'NEW BACKEND', 'MAP API / SHADERS'],
        ['ASSETS / DATA', 'TRACE FORMATS', 'CONTENT PATH', 'PRESERVE INTENT']
      ];
      rows.forEach((row, index) => {
        const vertical = 44 + index * 60;
        travel([margin + column, vertical + 24], [right, vertical + 24], index === 2 ? colors.amber : colors.cyan);
        node(context, row[0], margin, vertical, column, colors.green, row[1]);
        node(context, row[2], right, vertical, column, colors.amber, row[3]);
      });
      text(context, 'Understand before changing behavior', margin, logicalHeight - 16, colors.muted, 11);
    } else if (kind === 'trace') {
      const boxWidth = compact ? 138 : 190;
      const center = logicalWidth / 2;
      const branchLeft = compact ? margin : center - boxWidth - 55;
      const branchRight = compact ? logicalWidth - margin - boxWidth : center + 55;
      text(context, 'COMPATIBILITY BEFORE ENHANCEMENTS', margin, 27, colors.muted, 11);
      travel([center, 88], [branchLeft + boxWidth / 2, 111], colors.cyan);
      travel([center, 88], [branchRight + boxWidth / 2, 111], colors.amber);
      travel([branchLeft + boxWidth / 2, 159], [center, 182], colors.cyan);
      travel([branchRight + boxWidth / 2, 159], [center, 182], colors.amber);
      node(context, 'ORIGINAL BEHAVIOR', center - boxWidth / 2, 40, boxWidth, colors.green, 'REFERENCE CAPTURES');
      node(context, 'PLATFORM PORT', branchLeft, 111, boxWidth, colors.cyan, 'INPUT / MEMORY / TIME');
      node(context, 'RENDERER PORT', branchRight, 111, boxWidth, colors.amber, 'API / SHADERS / DATA');
      node(context, 'PLAYABLE BASELINE', center - boxWidth / 2, 182, boxWidth, colors.amber, 'TARGET TO VERIFY');
      text(context, 'Trace each adaptation to the original', margin, logicalHeight - 16, colors.muted, 11);
    } else if (kind === 'proposal') {
      const boxWidth = compact ? 138 : 200;
      const left = margin;
      const right = logicalWidth - margin - boxWidth;
      text(context, 'EXTEND PLATFORM / RENDERER CAPABILITIES', margin, 27, colors.muted, compact ? 10 : 11);
      travel([left + boxWidth / 2, 93], [left + boxWidth / 2, 149], colors.cyan);
      node(context, 'UPGRADE OPTIONS', left, 45, boxWidth, colors.green, 'RESOLUTION / HDR');
      node(context, 'PACING / TESTS', left, 149, boxWidth, colors.cyan, 'VISUAL INTENT / COST');
      const gate = logicalWidth / 2;
      line(context, [left + boxWidth, 69], [gate, 121], colors.amber, true);
      line(context, [left + boxWidth, 173], [gate, 121], colors.amber, true);
      line(context, [gate, 52], [gate, 191], colors.amber);
      context.fillStyle = colors.amber;
      context.fillRect(gate - 4, 116, 8, 10);
      line(context, [gate + 8, 121], [right, 121], colors.line, true);
      node(context, 'BUILD / DEVICE RUN', right, 97, boxWidth, colors.muted, 'BLOCKED UNTIL APPROVED');
      text(context, 'HUMAN APPROVAL', gate - 47, 222, colors.amber, 11);
      text(context, 'Optional upgrades / approval required', margin, logicalHeight - 16, colors.muted, 11);
    } else {
      text(context, 'VALIDATION EVIDENCE', margin, 27, colors.muted, 11);
      const column = compact ? 138 : 240;
      const right = logicalWidth - margin - column;
      ['ORIGINAL BEHAVIOR', 'ENHANCED VISUALS', 'TARGET FRAME TIMES'].forEach((label, index) => {
        const vertical = 44 + index * 60;
        travel([margin + column, vertical + 24], [right, 128], colors.cyan);
        node(context, label, margin, vertical, column, colors.cyan, 'COMPARE TO BASELINE');
      });
      node(context, 'REVIEW PACKET', right, 104, column, colors.green, 'ENGINEER DECISION');
      text(context, 'Regressions return to review', right, 185, colors.amber, compact ? 9 : 11);
      text(context, 'Compare against agreed tolerances', margin, logicalHeight - 16, colors.muted, 11);
    }
  }

  function tick(timestamp) {
    frame = 0;
    elapsed += previous ? Math.min((timestamp - previous) / 1000, 0.1) : 0;
    previous = timestamp;
    visible.forEach(canvas => draw(canvas, elapsed));
    if (!pause.checked && !document.hidden && visible.size) frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    previous = 0;
    canvases.forEach(canvas => draw(canvas, elapsed));
    if (!pause.checked && !document.hidden && visible.size) frame = requestAnimationFrame(tick);
  }

  pause.checked = motion.matches;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target));
    sync();
  });
  canvases.forEach(canvas => observer.observe(canvas));
  pause.addEventListener('change', sync);
  motion.addEventListener('change', () => { pause.checked = motion.matches; sync(); });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', sync);
  sync();
}());