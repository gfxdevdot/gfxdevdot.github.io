(function () {
  'use strict';

  const canvas = document.getElementById('introCanvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) return;

  
  let W, H, DPR;
  let scrollT = 0;
  let time = 0;
  const mouse = { x: 0.5, y: 0.5 };
  let ready = false;

  
  function resize() {
    DPR = Math.min(window.devicePixelRatio, 2);
    W = canvas.clientWidth  || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  
  function compile(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error('Shader compile:', gl.getShaderInfoLog(s));
    return s;
  }
  function link(vsSrc, fsSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(vsSrc, gl.VERTEX_SHADER));
    gl.attachShader(p, compile(fsSrc, gl.FRAGMENT_SHADER));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      console.error('Program link:', gl.getProgramInfoLog(p));
    return p;
  }

  
  function parseOBJ(text) {
    const positions = [];
    const faces = [];
    for (const line of text.split('\n')) {
      const p = line.trim().split(/\s+/);
      if (p[0] === 'v' && p.length >= 4) {
        positions.push([+p[1], +p[2], +p[3]]);
      } else if (p[0] === 'f' && p.length >= 4) {
        const idx = [];
        for (let k = 1; k < p.length; k++) {
          const v = parseInt(p[k].split('/')[0]);
          idx.push(v > 0 ? v - 1 : positions.length + v);
        }
        for (let k = 1; k < idx.length - 1; k++)
          faces.push([idx[0], idx[k], idx[k + 1]]);
      }
    }
    return { positions, faces };
  }

  
  function extractEdges(obj) {
    const seen = new Set();
    const pairs = [];
    for (const [a, b, c] of obj.faces) {
      for (const [i, j] of [[a,b],[b,c],[c,a]]) {
        const key = Math.min(i,j) * 131072 + Math.max(i,j);
        if (!seen.has(key)) { seen.add(key); pairs.push(i, j); }
      }
    }
    const buf = new Float32Array(pairs.length * 3);
    for (let k = 0; k < pairs.length; k++) {
      const p = obj.positions[pairs[k]];
      if (p) { buf[k*3] = p[0]; buf[k*3+1] = p[1]; buf[k*3+2] = p[2]; }
    }
    return { buffer: buf, count: pairs.length };
  }

  
  function buildSolidMesh(obj) {
    const data = new Float32Array(obj.faces.length * 3 * 6);
    let off = 0;
    for (const [ai, bi, ci] of obj.faces) {
      const pa = obj.positions[ai], pb = obj.positions[bi], pc = obj.positions[ci];
      if (!pa || !pb || !pc) continue;
      const abx = pb[0]-pa[0], aby = pb[1]-pa[1], abz = pb[2]-pa[2];
      const acx = pc[0]-pa[0], acy = pc[1]-pa[1], acz = pc[2]-pa[2];
      let nx = aby*acz - abz*acy, ny = abz*acx - abx*acz, nz = abx*acy - aby*acx;
      const len = Math.hypot(nx, ny, nz);
      if (len > 1e-8) { nx /= len; ny /= len; nz /= len; }
      for (const p of [pa, pb, pc]) {
        data[off++] = p[0]; data[off++] = p[1]; data[off++] = p[2];
        data[off++] = nx;   data[off++] = ny;   data[off++] = nz;
      }
    }
    return { buffer: data.subarray(0, off), vertCount: off / 6 };
  }

  
  function samplePointCloud(obj, count) {
    const cum = new Float64Array(obj.faces.length);
    let total = 0;
    for (let t = 0; t < obj.faces.length; t++) {
      const [ai, bi, ci] = obj.faces[t];
      const pa = obj.positions[ai], pb = obj.positions[bi], pc = obj.positions[ci];
      if (!pa || !pb || !pc) { cum[t] = total; continue; }
      const abx = pb[0]-pa[0], aby = pb[1]-pa[1], abz = pb[2]-pa[2];
      const acx = pc[0]-pa[0], acy = pc[1]-pa[1], acz = pc[2]-pa[2];
      const cx = aby*acz - abz*acy, cy = abz*acx - abx*acz, cz = abx*acy - aby*acx;
      total += Math.sqrt(cx*cx + cy*cy + cz*cz) * 0.5;
      cum[t] = total;
    }

    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);
    const sizes     = new Float32Array(count);
    const phases    = new Float32Array(count);

    let minY = 1e9, maxY = -1e9;
    for (const p of obj.positions) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
    const rangeY = maxY - minY || 1;

    for (let i = 0; i < count; i++) {
      const r = Math.random() * total;
      let lo = 0, hi = obj.faces.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }

      const [ai, bi, ci] = obj.faces[lo];
      const pa = obj.positions[ai], pb = obj.positions[bi], pc = obj.positions[ci];
      let u = Math.random(), v = Math.random();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      const w = 1 - u - v;

      const x = pa[0]*w + pb[0]*u + pc[0]*v;
      const y = pa[1]*w + pb[1]*u + pc[1]*v;
      const z = pa[2]*w + pb[2]*u + pc[2]*v;
      positions[i*3] = x; positions[i*3+1] = y; positions[i*3+2] = z;

      const ny = (y - minY) / rangeY;
      const rnd = Math.random();
      if (ny < 0.15) {
        if (rnd < 0.6) {
          colors[i*3] = 0.02+Math.random()*0.06; colors[i*3+1] = 0.12+Math.random()*0.15; colors[i*3+2] = 0.1+Math.random()*0.12;
        } else {
          colors[i*3] = 0.15+Math.random()*0.12; colors[i*3+1] = 0.08+Math.random()*0.06; colors[i*3+2] = 0.02+Math.random()*0.03;
        }
      } else if (ny < 0.35) {
        if (rnd < 0.45) {
          colors[i*3] = 0.0+Math.random()*0.1; colors[i*3+1] = 0.5+Math.random()*0.4; colors[i*3+2] = 0.6+Math.random()*0.35;
        } else if (rnd < 0.75) {
          colors[i*3] = 0.7+Math.random()*0.25; colors[i*3+1] = 0.5+Math.random()*0.25; colors[i*3+2] = 0.05+Math.random()*0.1;
        } else {
          const s = 0.5+Math.random()*0.35; colors[i*3]=s; colors[i*3+1]=s; colors[i*3+2]=s+Math.random()*0.1;
        }
      } else {
        if (rnd < 0.35) {
          const g = 0.08+Math.random()*0.12; colors[i*3]=g+0.02; colors[i*3+1]=g; colors[i*3+2]=g+0.04;
        } else if (rnd < 0.55) {
          colors[i*3] = 0.0; colors[i*3+1] = 0.6+Math.random()*0.35; colors[i*3+2] = 0.7+Math.random()*0.3;
        } else if (rnd < 0.72) {
          colors[i*3] = 0.8+Math.random()*0.2; colors[i*3+1] = 0.3+Math.random()*0.25; colors[i*3+2] = 0.02+Math.random()*0.05;
        } else if (rnd < 0.85) {
          colors[i*3] = 0.75+Math.random()*0.2; colors[i*3+1] = 0.6+Math.random()*0.2; colors[i*3+2] = 0.1+Math.random()*0.1;
        } else {
          const b = 0.75+Math.random()*0.25; colors[i*3]=b; colors[i*3+1]=b; colors[i*3+2]=b;
        }
      }

      sizes[i]  = 0.4 + Math.random() * 1.4;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, colors, sizes, phases };
  }

  
  const HELIX_TOP_Y    = 4.0;
  const HELIX_BOTTOM_Y = -3.0;

  function helixPos(t) {
    var e = t * t * (3.0 - 2.0 * t);
    var y = HELIX_TOP_Y + (HELIX_BOTTOM_Y - HELIX_TOP_Y) * e;
    var bump = Math.sin(t * Math.PI);
    bump *= bump;
    var sway = Math.sin(e * Math.PI * 2.0);
    var x = sway * bump * 1.5;
    var z = Math.cos(e * Math.PI * 2.0) * bump * 0.5;
    return [x, y, z];
  }

  
  function projectToScreen(pos, vpMat) {
    var x = pos[0], y = pos[1], z = pos[2];
    var cx = vpMat[0]*x + vpMat[4]*y + vpMat[8]*z  + vpMat[12];
    var cy = vpMat[1]*x + vpMat[5]*y + vpMat[9]*z  + vpMat[13];
    var cw = vpMat[3]*x + vpMat[7]*y + vpMat[11]*z + vpMat[15];
    if (Math.abs(cw) < 0.0001) cw = 0.0001;
    return [(cx / cw) * 0.5 + 0.5, (cy / cw) * 0.5 + 0.5];
  }

  

  const envVS = [
    'precision mediump float;',
    'attribute vec3 aPos;',
    'attribute vec3 aLogoPos;',
    'attribute vec3 aCol;',
    'attribute float aSize;',
    'attribute float aPhase;',
    'uniform mat4 uMVP;',
    'uniform mat4 uLogoModel;',
    'uniform float uTime;',
    'uniform float uScroll;',
    'uniform float uMorph;',
    'uniform vec2 uRes;',
    'uniform vec3 uLogoWorldPos;',
    'uniform vec3 uBackLightPos;',
    'uniform vec3 uEyePos;',
    'varying vec3 vCol;',
    'varying float vAlpha;',
    'varying float vScatter;',
    'void main() {',
    '  vec3 logoWorld = (uLogoModel * vec4(aLogoPos, 1.0)).xyz;',
    '',
    '  vec3 p = mix(logoWorld, aPos, uMorph);',
    '',
    '  p.y += sin(uTime * 0.4 + aPhase) * 0.08 * uMorph;',
    '  p.x += cos(uTime * 0.3 + aPhase * 1.3) * 0.04 * uMorph;',
    '',
    '  float logoBreathe = (1.0 - uMorph) * sin(uTime * 0.8 + aPhase * 2.0) * 0.02;',
    '  vec3 logoDir = length(aLogoPos) > 0.001 ? normalize(aLogoPos) : vec3(0.0, 1.0, 0.0);',
    '  p += logoDir * logoBreathe;',
    '',
    '  float proximity = smoothstep(0.25, 0.65, uScroll);',
    '  vec3 toPoint = p - uLogoWorldPos;',
    '  float logoDist = length(toPoint);',
    '  vec3 radialDir = logoDist > 0.01 ? toPoint / logoDist : vec3(0.0, 1.0, 0.0);',
    '',
    '  float wave1 = sin(logoDist * 3.0 - uTime * 1.2) * exp(-logoDist * 0.1);',
    '  float wave2 = sin(logoDist * 5.5 - uTime * 1.6 + 1.0) * exp(-logoDist * 0.15);',
    '  float wave3 = sin(logoDist * 2.0 - uTime * 0.9 + 2.5) * exp(-logoDist * 0.08);',
    '  float wave4 = sin(logoDist * 8.0 - uTime * 2.0 + 0.7) * exp(-logoDist * 0.22);',
    '  float waveCombined = (wave1 * 0.4 + wave2 * 0.25 + wave3 * 0.2 + wave4 * 0.15);',
    '',
    '  float waveAmp = proximity * 1.2 * uMorph;',
    '  p += radialDir * waveCombined * waveAmp;',
    '  p.y += waveCombined * proximity * 0.45 * sin(aPhase + uTime * 0.7) * uMorph;',
    '  vec3 tangent = cross(radialDir, vec3(0.0, 1.0, 0.0));',
    '  p += tangent * waveCombined * proximity * 0.3 * uMorph;',
    '',
    '  vec3 viewDir = normalize(uEyePos - p);',
    '  vec3 lightToP = normalize(p - uBackLightPos);',
    '  float cosAngle = max(dot(viewDir, lightToP), 0.0);',
    '  float scatter = pow(cosAngle, 5.0);',
    '  float lightDist = length(p - uBackLightPos);',
    '  float scatterAtten = 1.0 / (1.0 + lightDist * lightDist * 0.04);',
    '  scatter *= scatterAtten;',
    '  vScatter = scatter;',
    '',
    '  gl_Position = uMVP * vec4(p, 1.0);',
    '  float dist = length(gl_Position.xyz / gl_Position.w);',
    '',
    '  float logoSz = 0.8 + sin(aPhase + uTime * 0.2) * 0.1;',
    '  float baseSz = mix(logoSz, aSize, uMorph);',
    '  float sz = baseSz * (uRes.y * 0.0025) / max(dist, 0.1);',
    '',
    '  float logoGlow = smoothstep(5.0, 0.5, logoDist) * smoothstep(0.3, 0.7, uScroll);',
    '  float wavePulse = max(waveCombined, 0.0) * proximity;',
    '  sz *= 1.0 + (logoGlow * 1.5 + wavePulse * 1.5) * uMorph + scatter * 2.0;',
    '  gl_PointSize = clamp(sz, 1.0, 10.0);',
    '',
    '  float logoHue = aLogoPos.y * 3.0 + aLogoPos.x * 1.5 + uTime * 0.15;',
    '  vec3 logoCol = vec3(',
    '    0.35 + sin(logoHue) * 0.15,',
    '    0.55 + sin(logoHue + 2.094) * 0.15,',
    '    0.95 + sin(logoHue + 4.189) * 0.05',
    '  );',
    '  logoCol += vec3(0.2, 0.3, 0.5) * (0.5 + 0.5 * sin(uTime * 0.15 + aPhase));',
    '  vec3 baseCol = mix(logoCol, aCol, uMorph);',
    '',
    '  float waveHue = logoDist * 2.0 - uTime * 0.5;',
    '  vec3 waveCol = vec3(',
    '    sin(waveHue) * 0.45 + 0.55,',
    '    sin(waveHue + 2.094) * 0.4 + 0.45,',
    '    sin(waveHue + 4.189) * 0.5 + 0.6',
    '  );',
    '  float waveColorMix = wavePulse * 0.85 * uMorph;',
    '  vec3 scatterCol = mix(vec3(0.5, 0.7, 1.0), vec3(1.0, 0.85, 0.5), scatter);',
    '  vCol = mix(baseCol, waveCol, waveColorMix) + vec3(0.2, 0.35, 0.65) * logoGlow * uMorph + scatterCol * scatter * 0.8;',
    '',
    '  float logoAlpha = 0.85 + sin(uTime * 0.25 + aPhase) * 0.06;',
    '  float envFade = smoothstep(0.08, 0.4, uScroll);',
    '  float fog = 1.0 - smoothstep(5.0, 16.0, dist);',
    '  float envAlpha = envFade * fog * (0.5 + sin(uTime * 0.25 + aPhase) * 0.1);',
    '  envAlpha += logoGlow * 0.2 + wavePulse * 0.1;',
    '  vAlpha = mix(logoAlpha, envAlpha, uMorph) + scatter * 0.25;',
    '}'
  ].join('\n');

  const envFS = [
    'precision mediump float;',
    'varying vec3 vCol;',
    'varying float vAlpha;',
    'varying float vScatter;',
    'void main() {',
    '  vec2 c = gl_PointCoord - 0.5;',
    '  float d = length(c);',
    '  if (d > 0.5) discard;',
    '  float soft = 1.0 - smoothstep(0.12, 0.5, d);',
    '  float scatterGlow = (1.0 - smoothstep(0.0, 0.48, d)) * vScatter;',
    '  vec3 col = vCol + vCol * soft * 0.3 + vec3(0.6, 0.75, 1.0) * scatterGlow * 0.8;',
    '  float alpha = vAlpha * soft + scatterGlow * 0.2;',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  const lightVS = [
    'precision mediump float;',
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  const lightFS = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform float uTime;',
    'uniform float uScroll;',
    'uniform vec2 uLogoScreen;',
    'uniform vec2 uBackLightScreen;',
    'void main() {',
    '  vec2 lightPos = uBackLightScreen;',
    '  vec2 logoPos  = uLogoScreen;',
    '',
    '  vec2 toLight = lightPos - vUv;',
    '  vec2 rayStep = toLight / 32.0;',
    '  vec2 sp = vUv;',
    '  float density = 0.0;',
    '  float weight = 1.0;',
    '  for (int i = 0; i < 32; i++) {',
    '    sp += rayStep;',
    '    float logoD = length(sp - logoPos);',
    '    float occlude = smoothstep(0.02, 0.12, logoD);',
    '    float sDist = length(sp - lightPos);',
    '    float contrib = 0.012 / (sDist + 0.08);',
    '    density += contrib * occlude * weight;',
    '    weight *= 0.96;',
    '  }',
    '',
    '  vec2 delta = vUv - lightPos;',
    '  float dist = length(delta);',
    '  float angle = atan(delta.y, delta.x);',
    '  float rays = sin(angle * 5.0) * 0.06',
    '             + sin(angle * 9.0) * 0.03;',
    '  rays = max(rays, 0.0);',
    '',
    '  float logoEdge = length(vUv - logoPos);',
    '  float corona = smoothstep(0.18, 0.05, logoEdge);',
    '  corona *= 1.0 - smoothstep(0.0, 0.04, logoEdge);',
    '  vec2 logoToLight = normalize(lightPos - logoPos);',
    '  vec2 logoToPixel = logoEdge > 0.001',
    '                   ? normalize(vUv - logoPos) : vec2(0.0);',
    '  float dirBias = dot(logoToPixel, logoToLight) * 0.5 + 0.5;',
    '  corona *= 0.4 + dirBias * 0.6;',
    '',
    '  float glow = 0.03 / (dist + 0.08);',
    '',
    '  vec3 col1 = vec3(0.2, 0.45, 0.95);',
    '  vec3 col2 = vec3(0.75, 0.6, 0.2);',
    '  vec3 col3 = vec3(0.6, 0.2, 0.8);',
    '  vec3 col4 = vec3(0.85, 0.15, 0.4);',
    '  vec3 col;',
    '  float s = uScroll;',
    '  if (s < 0.33) {',
    '    col = mix(col1, col2, s / 0.33);',
    '  } else if (s < 0.66) {',
    '    col = mix(col2, col3, (s - 0.33) / 0.33);',
    '  } else {',
    '    col = mix(col3, col4, (s - 0.66) / 0.34);',
    '  }',
    '',
    '  vec3 coronaCol = mix(col, vec3(0.7, 0.85, 1.0), 0.5);',
    '  vec3 finalCol = col * (density * 0.6 + rays * glow * 0.8 + glow)',
    '                + coronaCol * corona * 0.5;',
    '',
    '  float volume = density * 0.6 + rays * glow * 0.8 + corona * 0.5 + glow;',
    '  float alpha = min(volume * 0.2, 0.35);',
    '  float intensity = 0.3 + smoothstep(0.3, 0.8, s) * 0.7;',
    '  alpha *= intensity;',
    '  gl_FragColor = vec4(finalCol, alpha);',
    '}'
  ].join('\n');

  const pulseFS = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform float uTime;',
    'uniform float uScroll;',
    'uniform vec2 uLogoScreen;',
    'void main() {',
    '  float onset = 0.45;',
    '  float progress = clamp((uScroll - onset) / (1.0 - onset), 0.0, 1.0);',
    '  if (progress < 0.001) discard;',
    '  vec2 delta = vUv - uLogoScreen;',
    '  float dist = length(delta);',
    '  float waveSpeed = 0.2;',
    '  float waveFreq = 8.0;',
    '  float wave1 = sin(dist * waveFreq - uTime * waveSpeed) * 0.5 + 0.5;',
    '  float wave2 = sin(dist * waveFreq * 0.6 - uTime * waveSpeed * 1.3 + 1.5) * 0.5 + 0.5;',
    '  float radius = progress * 1.8;',
    '  float ringW = 0.12 + progress * 0.25;',
    '  float envelope = smoothstep(radius - ringW, radius - ringW * 0.3, dist)',
    '                 * (1.0 - smoothstep(radius, radius + ringW * 0.2, dist));',
    '  float innerGlow = smoothstep(radius * 0.6, 0.0, dist) * 0.12;',
    '  float hue = dist * 5.0 - uTime * 0.15 + progress * 2.0;',
    '  vec3 col = vec3(',
    '    sin(hue) * 0.4 + 0.5,',
    '    sin(hue + 2.094) * 0.35 + 0.4,',
    '    sin(hue + 4.189) * 0.45 + 0.5',
    '  );',
    '  float alpha = (envelope * (wave1 * 0.55 + wave2 * 0.45) + innerGlow) * progress * 0.08;',
    '  gl_FragColor = vec4(col * (alpha + innerGlow), alpha);',
    '}'
  ].join('\n');

  
  function mat4() { return new Float32Array(16); }
  function identity(m) { m.fill(0); m[0]=m[5]=m[10]=m[15]=1; return m; }

  function perspective(fov, asp, near, far) {
    const m = mat4(), f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    m[0] = f / asp; m[5] = f; m[10] = (far+near)*nf; m[11] = -1; m[14] = 2*far*near*nf;
    return m;
  }

  function lookAt(eye, cen, up) {
    const m = mat4();
    let zx=eye[0]-cen[0], zy=eye[1]-cen[1], zz=eye[2]-cen[2];
    let l = Math.hypot(zx,zy,zz); if(l<1e-6)l=1; zx/=l; zy/=l; zz/=l;
    let xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
    l=Math.hypot(xx,xy,xz); if(l<1e-6)l=1; xx/=l; xy/=l; xz/=l;
    const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
    m[0]=xx;m[1]=yx;m[2]=zx; m[4]=xy;m[5]=yy;m[6]=zy; m[8]=xz;m[9]=yz;m[10]=zz;
    m[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);
    m[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);
    m[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);
    m[15]=1;
    return m;
  }

  function mulMat4(a, b) {
    const o = mat4();
    for (let i=0;i<4;i++) for (let j=0;j<4;j++)
      o[j*4+i]=a[i]*b[j*4]+a[4+i]*b[j*4+1]+a[8+i]*b[j*4+2]+a[12+i]*b[j*4+3];
    return o;
  }

  function rotateY(m,a) {
    const c=Math.cos(a),s=Math.sin(a),r=identity(mat4());
    r[0]=c;r[2]=s;r[8]=-s;r[10]=c; return mulMat4(m,r);
  }
  function rotateX(m,a) {
    const c=Math.cos(a),s=Math.sin(a),r=identity(mat4());
    r[5]=c;r[6]=s;r[9]=-s;r[10]=c; return mulMat4(m,r);
  }
  function rotateZ(m,a) {
    const c=Math.cos(a),s=Math.sin(a),r=identity(mat4());
    r[0]=c;r[1]=s;r[4]=-s;r[5]=c; return mulMat4(m,r);
  }
  function translate(m,x,y,z) {
    const t=identity(mat4()); t[12]=x;t[13]=y;t[14]=z; return mulMat4(m,t);
  }
  function scaleMat(m,sx,sy,sz) {
    const s=identity(mat4()); s[0]=sx;s[5]=sy;s[10]=sz; return mulMat4(m,s);
  }

  
  let envProg, envAttr, envUni, envPosBuf, envLogoPosBuf, envColBuf, envSzBuf, envPhBuf, envN;
  let lightProg, lightAttr, lightUni, quadBuf;
  let pulseProg, pulseAttr, pulseUni;

  const ENV_SAMPLE_COUNT = 45000;

  
  async function init() {
    try {
      const [logoText, envText] = await Promise.all([
        fetch('assets/logo.obj').then(r => { if(!r.ok) throw new Error('logo.obj: '+r.status); return r.text(); }),
        fetch('assets/environment.obj').then(r => { if(!r.ok) throw new Error('environment.obj: '+r.status); return r.text(); }),
      ]);

      const logoObj = parseOBJ(logoText);
      const envObj  = parseOBJ(envText);
      console.log('OBJ loaded — logo:', logoObj.positions.length, 'verts,', logoObj.faces.length, 'tris');
      console.log('OBJ loaded — env:', envObj.positions.length, 'verts,', envObj.faces.length, 'tris');

      const logoCloud = samplePointCloud(logoObj, ENV_SAMPLE_COUNT);
      envLogoPosBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, envLogoPosBuf);
      gl.bufferData(gl.ARRAY_BUFFER, logoCloud.positions, gl.STATIC_DRAW);

      const cloud = samplePointCloud(envObj, ENV_SAMPLE_COUNT);
      envProg = link(envVS, envFS);
      envAttr = {
        pos:     gl.getAttribLocation(envProg, 'aPos'),
        logoPos: gl.getAttribLocation(envProg, 'aLogoPos'),
        col:     gl.getAttribLocation(envProg, 'aCol'),
        size:    gl.getAttribLocation(envProg, 'aSize'),
        phase:   gl.getAttribLocation(envProg, 'aPhase'),
      };
      envUni = {
        mvp:          gl.getUniformLocation(envProg, 'uMVP'),
        logoModel:    gl.getUniformLocation(envProg, 'uLogoModel'),
        time:         gl.getUniformLocation(envProg, 'uTime'),
        scroll:       gl.getUniformLocation(envProg, 'uScroll'),
        morph:        gl.getUniformLocation(envProg, 'uMorph'),
        res:          gl.getUniformLocation(envProg, 'uRes'),
        logoWorldPos:  gl.getUniformLocation(envProg, 'uLogoWorldPos'),
        backLightPos:  gl.getUniformLocation(envProg, 'uBackLightPos'),
        eyePos:        gl.getUniformLocation(envProg, 'uEyePos'),
      };
      envPosBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, envPosBuf);
      gl.bufferData(gl.ARRAY_BUFFER, cloud.positions, gl.STATIC_DRAW);
      envColBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, envColBuf);
      gl.bufferData(gl.ARRAY_BUFFER, cloud.colors, gl.STATIC_DRAW);
      envSzBuf  = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, envSzBuf);
      gl.bufferData(gl.ARRAY_BUFFER, cloud.sizes, gl.STATIC_DRAW);
      envPhBuf  = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, envPhBuf);
      gl.bufferData(gl.ARRAY_BUFFER, cloud.phases, gl.STATIC_DRAW);
      envN = ENV_SAMPLE_COUNT;

      lightProg = link(lightVS, lightFS);
      lightAttr = gl.getAttribLocation(lightProg, 'aPos');
      lightUni  = {
        time:           gl.getUniformLocation(lightProg, 'uTime'),
        scroll:         gl.getUniformLocation(lightProg, 'uScroll'),
        logoScreen:     gl.getUniformLocation(lightProg, 'uLogoScreen'),
        backLightScreen:gl.getUniformLocation(lightProg, 'uBackLightScreen'),
      };
      quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

      pulseProg = link(lightVS, pulseFS);
      pulseAttr = gl.getAttribLocation(pulseProg, 'aPos');
      pulseUni  = {
        time:       gl.getUniformLocation(pulseProg, 'uTime'),
        scroll:     gl.getUniformLocation(pulseProg, 'uScroll'),
        logoScreen: gl.getUniformLocation(pulseProg, 'uLogoScreen'),
      };

      ready = true;
      requestAnimationFrame(render);
      console.log('Intro scene ready');

    } catch (err) {
      console.error('Intro init failed:', err);
    }
  }

  
  function render(ts) {
    if (!ready) return;
    time = ts * 0.001;
    requestAnimationFrame(render);
    if (W <= 0 || H <= 0) { resize(); return; }

    gl.clearColor(0.02, 0.02, 0.03, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);

    var asp = W / H;

    
    var ease = scrollT * scrollT * (3.0 - 2.0 * scrollT);
    var logoWPos = helixPos(scrollT);
    var logoWorldX = logoWPos[0];
    var logoWorldY = logoWPos[1];
    var logoWorldZ = logoWPos[2];

    
    var camSwayX = Math.sin(time * 0.08) * 0.2 + (mouse.x - 0.5) * 0.25;
    var camSwayZ = Math.cos(time * 0.06) * 0.12;
    var eyeX = logoWorldX + camSwayX;
    var eyeY = logoWorldY + 1.8 - ease * 0.5;
    var eyeZ = logoWorldZ + 4.5 - ease * 1.0;
    var lookX = logoWorldX + Math.sin(time * 0.05) * 0.04;
    var lookY = logoWorldY - ease * 0.2;
    var lookZ = logoWorldZ;

    var eyePos = [eyeX, eyeY, eyeZ];
    var proj = perspective(Math.PI / 3.2, asp, 0.1, 60);
    var view = lookAt(eyePos, [lookX, lookY, lookZ], [0, 1, 0]);
    var vp = mulMat4(proj, view);

    
    var logoScreen = projectToScreen(logoWPos, vp);

    
    var toCamX = eyeX - logoWorldX, toCamY = eyeY - logoWorldY, toCamZ = eyeZ - logoWorldZ;
    var toCamLen = Math.sqrt(toCamX*toCamX + toCamY*toCamY + toCamZ*toCamZ);
    if (toCamLen > 0.01) { toCamX /= toCamLen; toCamY /= toCamLen; toCamZ /= toCamLen; }
    var blDist = 3.5;
    var blX = logoWorldX - toCamX * blDist;
    var blY = logoWorldY - toCamY * blDist;
    var blZ = logoWorldZ - toCamZ * blDist;
    var backLightScreen = projectToScreen([blX, blY, blZ], vp);

    
    gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(lightProg);
    gl.uniform1f(lightUni.time, time);
    gl.uniform1f(lightUni.scroll, scrollT);
    gl.uniform2f(lightUni.logoScreen, logoScreen[0], logoScreen[1]);
    gl.uniform2f(lightUni.backLightScreen, backLightScreen[0], backLightScreen[1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(lightAttr);
    gl.vertexAttribPointer(lightAttr, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(lightAttr);
    gl.enable(gl.DEPTH_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    
    var logoRot = scrollT * Math.PI * 4.0;
    var expand = 1.0 + ease * 0.8;
    var lm = identity(mat4());
    lm = translate(lm, logoWorldX, logoWorldY, logoWorldZ);
    lm = rotateY(lm, time * 0.15 + logoRot);
    lm = rotateX(lm, Math.sin(time * 0.25) * 0.1 + scrollT * 0.5);
    lm = rotateZ(lm, Math.sin(time * 0.18 + 1.0) * 0.08);
    lm = scaleMat(lm, expand, expand, expand);

    
    var morphRaw = Math.max(0, Math.min(1, scrollT / 0.5));
    var morph = morphRaw * morphRaw * (3 - 2 * morphRaw);

    
    gl.useProgram(envProg);
    gl.uniformMatrix4fv(envUni.mvp, false, vp);
    gl.uniformMatrix4fv(envUni.logoModel, false, lm);
    gl.uniform1f(envUni.time, time);
    gl.uniform1f(envUni.scroll, scrollT);
    gl.uniform1f(envUni.morph, morph);
    gl.uniform2f(envUni.res, W, H);
    gl.uniform3f(envUni.logoWorldPos, logoWorldX, logoWorldY, logoWorldZ);
    gl.uniform3f(envUni.backLightPos, blX, blY, blZ);
    gl.uniform3f(envUni.eyePos, eyeX, eyeY, eyeZ);

    gl.bindBuffer(gl.ARRAY_BUFFER, envPosBuf);
    gl.enableVertexAttribArray(envAttr.pos);
    gl.vertexAttribPointer(envAttr.pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, envLogoPosBuf);
    gl.enableVertexAttribArray(envAttr.logoPos);
    gl.vertexAttribPointer(envAttr.logoPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, envColBuf);
    gl.enableVertexAttribArray(envAttr.col);
    gl.vertexAttribPointer(envAttr.col, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, envSzBuf);
    gl.enableVertexAttribArray(envAttr.size);
    gl.vertexAttribPointer(envAttr.size, 1, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, envPhBuf);
    gl.enableVertexAttribArray(envAttr.phase);
    gl.vertexAttribPointer(envAttr.phase, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, envN);
    gl.disableVertexAttribArray(envAttr.pos);
    gl.disableVertexAttribArray(envAttr.logoPos);
    gl.disableVertexAttribArray(envAttr.col);
    gl.disableVertexAttribArray(envAttr.size);
    gl.disableVertexAttribArray(envAttr.phase);

    
    if (scrollT > 0.4) {
      gl.disable(gl.DEPTH_TEST);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(pulseProg);
      gl.uniform1f(pulseUni.time, time);
      gl.uniform1f(pulseUni.scroll, scrollT);
      gl.uniform2f(pulseUni.logoScreen, logoScreen[0], logoScreen[1]);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(pulseAttr);
      gl.vertexAttribPointer(pulseAttr, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(pulseAttr);
      gl.enable(gl.DEPTH_TEST);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  
  const introSection = document.getElementById('introSection');

  function updateScroll() {
    if (!introSection) return;
    const rect = introSection.getBoundingClientRect();
    const h = introSection.offsetHeight - window.innerHeight;
    if (h <= 0) { scrollT = 0; return; }
    scrollT = Math.max(0, Math.min(1, -rect.top / h));

    const overlay = document.querySelector('.intro-overlay');
    if (overlay) overlay.style.opacity = Math.max(0, 1 - scrollT * 4);
  }
  window.addEventListener('scroll', updateScroll, { passive: true });

  
  document.addEventListener('mousemove', function(e) {
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = 1.0 - e.clientY / window.innerHeight;
  });

  
  resize();
  window.addEventListener('resize', resize);
  init();

  
  function revealLabels() {
    var labels = document.querySelectorAll('.intro-label');
    labels.forEach(function(l, i) {
      setTimeout(function() { l.classList.add('visible'); }, i * 200 + 100);
    });
  }

  var introBand = document.getElementById('introBand');
  if (introBand) {
    var bandIO = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          revealLabels();
          bandIO.disconnect();
        }
      });
    }, { threshold: 0.15 });
    bandIO.observe(introBand);
  }

  
  if (introSection) {
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        var ov = document.querySelector('.intro-overlay');
        if (ov) ov.style.visibility = e.isIntersecting ? 'visible' : 'hidden';
      });
    }, { threshold: 0 });
    io.observe(introSection);
  }

})();
