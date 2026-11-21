/* Storyboard Scenari | Space Economy — Terra 3D guidata dal tempo della scena (three.js r128).
   data-globo="intro": nero, punto di luce, la Terra si accende e l'Italia si illumina.
   data-globo="geo":   il globo ruota da Stati Uniti a Europa a Cina, con i tre marcatori.
   La pagina mette e toglie .play sul frame: qui si riparte da zero e, fuori da .play, si disegna lo stato finale. */
(function () {
  if (!window.THREE) return;
  var css = getComputedStyle(document.documentElement);
  var tok = function (n, f) { return new THREE.Color((css.getPropertyValue(n) || '').trim() || f); };
  var LIME = tok('--lime-400', '#B9FF69'), NOTTE = new THREE.Color('#05060F');
  var cl = function (x) { return Math.min(1, Math.max(0, x)); };
  var sm = function (a, b, t) { t = cl((t - a) / (b - a)); return t * t * (3 - 2 * t); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  function dir(lon, lat) {
    var phi = (lon + 180) / 360 * Math.PI * 2, th = (90 - lat) * Math.PI / 180;
    return new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
  }
  function rotY(lon) { var v = dir(lon, 0); return -Math.atan2(v.x, v.z); }

  var tex = null;
  function textures(renderer) {
    if (tex) return tex;
    var L = new THREE.TextureLoader();
    var ok = function () { (window.__globi || []).forEach(function (f) { f(); }); };
    tex = { giorno: L.load('assets/3d/terra-giorno.jpg', ok), luci: L.load('assets/3d/terra-luci.jpg', ok) };
    tex.giorno.anisotropy = tex.luci.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  function Globo(frame, host) {
    var mode = host.dataset.globo, DUR = parseFloat(frame.dataset.dur) || 10;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); } catch (e) { return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(NOTTE, 1);
    host.appendChild(renderer.domElement);
    frame.classList.add('has-globo');
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 16 / 9, .01, 1000);
    var T = textures(renderer);

    /* stelle */
    var sg = new THREE.BufferGeometry(), sp = [], seed = 7, rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (var i = 0; i < 2200; i++) { var u = rnd() * 2 - 1, a = rnd() * 6.283, r = 300; sp.push(r * Math.sqrt(1 - u * u) * Math.cos(a), r * u, r * Math.sqrt(1 - u * u) * Math.sin(a)); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    var stelle = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: .55, transparent: true, opacity: .75 }));
    scene.add(stelle);

    var tilt = new THREE.Group(), spin = new THREE.Group(); scene.add(tilt); tilt.add(spin);
    var hlDir = dir(12.5, 42.5);
    var mat = new THREE.ShaderMaterial({
      uniforms: { giorno: { value: T.giorno }, luci: { value: T.luci }, rim: { value: new THREE.Color(0x3d6bff) },
                  acc: { value: 1 }, hl: { value: hlDir }, hlK: { value: 0 }, lime: { value: LIME } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vO; void main(){ vUv=uv; vO=normalize(position); vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
      fragmentShader: [
        'uniform sampler2D giorno; uniform sampler2D luci; uniform vec3 rim; uniform float acc; uniform vec3 hl; uniform float hlK; uniform vec3 lime;',
        'varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vO;',
        'void main(){ vec3 d=texture2D(giorno,vUv).rgb; float l=dot(texture2D(luci,vUv).rgb,vec3(.299,.587,.114));',
        ' float m=smoothstep(.975,.992,dot(vO,hl));',
        ' vec3 col=d*vec3(.045,.06,.12) + vec3(1.,.74,.38)*pow(l,1.35)*2.1*acc*(1.+hlK*m*1.6);',
        ' col += lime*hlK*m*(l*.9+.05);',
        ' float f=pow(1.-max(dot(vN,vV),0.),3.); col+=rim*f*.9*acc; gl_FragColor=vec4(col,1.); }'
      ].join('\n')
    });
    spin.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), mat));
    var atmoMat = new THREE.ShaderMaterial({
      uniforms: { blu: { value: new THREE.Color(0x3d6bff) }, lime: { value: LIME }, k: { value: 1 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 blu; uniform vec3 lime; uniform float k; varying vec3 vN; varying vec3 vV; void main(){ float d=dot(vN,vV); float a=pow(clamp(1.+d,0.,1.),5.); float e=smoothstep(0.,.25,-d); vec3 c=mix(blu,lime,smoothstep(.55,1.,a)*.35); gl_FragColor=vec4(c,a*e*1.2*k); }',
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
    });
    tilt.add(new THREE.Mesh(new THREE.SphereGeometry(1.06, 96, 64), atmoMat));

    /* punto di luce dell'alba orbitale (solo intro) */
    var bagliore = null;
    if (mode === 'intro') {
      var c = document.createElement('canvas'); c.width = c.height = 128;
      var x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.12, 'rgba(255,236,200,.9)'); g.addColorStop(.4, 'rgba(255,190,120,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      bagliore = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      scene.add(bagliore);
    }

    /* marcatori: Stati Uniti, Europa, Cina (solo geo) */
    var marcatori = [], etichette = [];
    if (mode === 'geo') {
      [['Stati Uniti', -98, 39, 2.2], ['Europa', 12, 47, 4.6], ['Cina', 105, 35, 7.0]].forEach(function (m) {
        var p = dir(m[1], m[2]).multiplyScalar(1.005);
        var q = new THREE.Mesh(new THREE.PlaneGeometry(.045, .045), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, depthTest: true }));
        q.position.copy(p); q.lookAt(p.clone().multiplyScalar(2)); spin.add(q);
        var ring = new THREE.Mesh(new THREE.RingGeometry(.06, .068, 48), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
        ring.position.copy(p); ring.lookAt(p.clone().multiplyScalar(2)); spin.add(ring);
        var e = document.createElement('p'); e.className = 'globo-lbl'; e.textContent = m[0]; host.appendChild(e);
        marcatori.push({ q: q, ring: ring, t: m[3], p: p }); etichette.push(e);
      });
    }

    function size() {
      var w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    var v = new THREE.Vector3();
    function draw(t) {
      if (mode === 'intro') {
        /* 0–3 s nero e punto di luce · 3–8 la Terra emerge e ruota · 8–12 l'Italia si accende */
        var emerge = sm(2.4, 7, t);
        mat.uniforms.acc.value = emerge; atmoMat.uniforms.k.value = sm(1.2, 4, t);
        spin.rotation.y = lerp(rotY(-30), rotY(12.5), sm(2.5, 9.5, t));
        tilt.rotation.x = lerp(.15, 42.5 * Math.PI / 180, sm(3, 9.5, t));
        var dist = lerp(4.2, 2.35, sm(2.5, 11.5, t));
        camera.position.set(0, lerp(.95, .1, sm(1, 8, t)), dist);
        camera.lookAt(0, lerp(.98, .15, sm(1, 8, t)), 0);
        mat.uniforms.hlK.value = sm(8, 10.5, t);
        bagliore.position.set(0, 1.0, .12); var s = lerp(.05, .9, sm(.3, 2.4, t)) * (1 - sm(3.2, 5.5, t)) + .001;
        bagliore.scale.set(s, s, 1); bagliore.material.opacity = 1 - sm(3.4, 5.5, t);
        stelle.material.opacity = .75 * sm(.5, 4, t);
      } else {
        spin.rotation.y = lerp(rotY(-98), rotY(105), sm(.5, 8.6, t));
        tilt.rotation.x = .5;
        camera.position.set(0, 0, 4.1); camera.lookAt(0, 0, 0);
        mat.uniforms.hlK.value = 0;
        var w = host.clientWidth, h = host.clientHeight;
        marcatori.forEach(function (m, i) {
          var on = sm(m.t - .3, m.t + .3, t), puls = (t - m.t) > 0 ? ((t - m.t) % 1.6) / 1.6 : 0;
          m.q.material.opacity = on; m.ring.material.opacity = on * (1 - puls);
          m.ring.scale.setScalar(1 + puls * 1.8);
          v.copy(m.p); spin.localToWorld(v);
          var face = v.clone().normalize().dot(camera.position.clone().normalize());
          v.project(camera);
          var e = etichette[i];
          e.style.left = ((v.x + 1) / 2 * w) + 'px'; e.style.top = ((1 - v.y) / 2 * h) + 'px';
          e.style.opacity = (on * cl(face * 3)).toFixed(3);
        });
      }
      renderer.render(scene, camera);
    }
    var playing = false, t0 = 0, raf = 0;
    function loop() { var t = (performance.now() - t0) / 1000; draw(Math.min(t, DUR)); if (playing) raf = requestAnimationFrame(loop); }
    new MutationObserver(function (recs) {
      var on = frame.classList.contains('play');
      var restarted = recs.some(function (r) { return !/(^|\s)play(\s|$)/.test(r.oldValue || ''); });
      if (on && (!playing || restarted)) { playing = true; t0 = performance.now(); cancelAnimationFrame(raf); loop(); }
      if (!on && playing) { playing = false; cancelAnimationFrame(raf); draw(DUR); }
    }).observe(frame, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    new ResizeObserver(function () { size(); if (!playing) draw(DUR); }).observe(host);
    (window.__globi = window.__globi || []).push(function () { if (!playing) draw(DUR); });
    size(); draw(DUR);
    frame.__globo = { draw: draw, DUR: DUR };
  }
  document.querySelectorAll('[data-globo]').forEach(function (host) { Globo(host.closest('.frame'), host); });
})();
