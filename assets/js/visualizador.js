/* Visualizador de paredes · portal de distribuidores Eternit.
   Pasos: foto → zona (opcional) → acabado → resultado.
   · Cada foto se normaliza en el navegador, venga del celular que venga: derecha (con la orientación que guardó la
     cámara), con lado largo de 2.048 px, y con bandas de relleno hasta la proporción exacta que acepta la IA (4:3,
     3:4, 16:9…). Al volver, las bandas se quitan: el resultado queda alineado píxel a píxel con la foto, sea
     vertical, horizontal, panorámica o una captura de pantalla.
   · La foto viaja al servidor del portal (/api/visualizador), que llama al servicio de IA con la clave guardada en su
     entorno: la clave nunca llega al navegador.
   · Con zonas marcadas, la IA recibe la foto con la zona resaltada y una máscara; al volver, el resultado se usa solo
     dentro de las zonas: el resto de la foto queda idéntico al original.
   · La imagen que se descarga o se comparte lleva el rótulo «Imagen ilustrativa», el acabado y el logo.
   · Las simulaciones de la visita viven solo en memoria (galería): se borran al cerrar la página. */
(() => {
  const visor = document.querySelector('[data-visor]');
  if (!visor) return;
  const $ = (s, el = visor) => el.querySelector(s);
  const $$ = (s, el = visor) => [...el.querySelectorAll(s)];
  const API = 'https://eternit-visualizador.vercel.app/api/visualizador'; // en la demo en línea, herramientas/publicar.mjs lo cambia por la función en la nube
  const VERSION = 3; // debe coincidir con VERSION_VISOR de herramientas/visualizador_ia.py
  const MAX_ENVIO = 4_200_000; // la función en la nube recibe hasta 4,5 MB por solicitud: si pasa, se baja la calidad JPEG
  const LADO = 2048; // lado largo de la foto de trabajo: cabe en la salida 2K de la IA
  const MIN_LADO = 1000; // por debajo, el resultado se ve borroso
  const MAX_MB = 40; // la foto se reduce en el celular: al servidor solo viajan 1–3 MB
  const PROPORCIONES = [[21, 9], [16, 9], [3, 2], [4, 3], [5, 4], [1, 1], [4, 5], [3, 4], [2, 3], [9, 16], [4, 1], [1, 4]];
  const PASOS = ['foto', 'zona', 'acabado', 'resultado'];
  const FRASES = ['Midiendo la superficie', 'Ubicando la zona marcada', 'Cortando las placas a la medida', 'Alineando las juntas', 'Ajustando la luz y las sombras', 'Últimos detalles del acabado'];
  const reducir = matchMedia('(prefers-reduced-motion: reduce)');
  const e = { foto: null, ancho: 0, alto: 0, marco: null, zonas: [], actual: [] };
  const imagen = (src) => new Promise((ok, mal) => {
    const i = new Image();
    if (/^https?:/.test(src)) i.crossOrigin = 'anonymous'; // imagen que el navegador baja directo: sin esto el lienzo queda bloqueado
    i.onload = () => ok(i); i.onerror = mal; i.src = src;
  });

  // Avisos: «error» (rojo) cuando algo no se pudo hacer; «nota» (ámbar) cuando se puede seguir pero conviene saberlo
  const aviso = $('[data-visor-aviso]');
  const avisar = (texto, tipo = 'error') => {
    aviso.textContent = texto || '';
    aviso.hidden = !texto;
    aviso.classList.toggle('visor__aviso--nota', tipo === 'nota');
    if (texto) {
      const r = aviso.getBoundingClientRect();
      if (r.top < 70 || r.bottom > innerHeight) aviso.scrollIntoView({ block: 'center', behavior: reducir.matches ? 'auto' : 'smooth' });
    }
  };

  // ¿El servidor del portal está listo para simular?
  fetch(`${API}/estado`)
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((d) => {
      if (!d.configurado) avisar('El visualizador no está configurado en este servidor: falta la clave del servicio de IA. Avísale al administrador del portal.');
      else if (!d.restantes) avisar(`Se alcanzó el límite de ${d.limite} simulaciones por ${d.periodo || 'hora'} de esta demo. Intenta de nuevo más tarde.`);
    })
    .catch(() => avisar('No hay conexión con el servicio de simulación. Revisa tu conexión a internet y recarga la página.'));

  /* ---------- Pasos ---------- */
  const lienzo = $('[data-visor-lienzo]'), soltar = $('[data-visor-soltar]'), comparar = $('[data-visor-comparar]');
  const escena = $('.visor__escena'), cuerpo = $('.visor__cuerpo'), svg = $('[data-visor-zonas]');
  const ir = (paso, enfocar = true) => {
    visor.dataset.paso = paso;
    const n = PASOS.indexOf(paso);
    $$('[data-paso-panel]').forEach((p) => { p.hidden = p.dataset.pasoPanel !== paso; });
    $$('[data-paso-ind]').forEach((li) => {
      const i = PASOS.indexOf(li.dataset.pasoInd);
      li.classList.toggle('hecho', i < n);
      li.classList.toggle('actual', i === n);
      if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    soltar.hidden = Boolean(e.foto);
    lienzo.hidden = !e.foto || paso === 'resultado';
    comparar.hidden = paso !== 'resultado';
    pintarZonas();
    if (enfocar) {
      const titulo = $(`[data-paso-panel="${paso}"] h2`);
      titulo?.focus({ preventScroll: true });
      // Lo que se usa en cada paso queda completo a la vista, bajo la cabecera fija. En dos columnas se toma el bloque
      // completo (la foto se queda fija al bajar y no sirve de guía); apiladas (celular y tableta), la foto para marcar
      // y comparar, y los acabados en su paso.
      const apilada = matchMedia('(max-width: 1180px)').matches;
      const destino = paso === 'foto' ? visor : !apilada ? cuerpo : paso === 'acabado' ? titulo : escena;
      const tope = (parseFloat(getComputedStyle(visor).getPropertyValue('--cab-visible')) || 68) + 14;
      const r = destino.getBoundingClientRect();
      if (r.top < tope - 1 || (paso !== 'foto' && r.bottom > innerHeight + 1)) scrollTo({ top: scrollY + r.top - tope, behavior: reducir.matches ? 'auto' : 'smooth' });
    }
  };
  $$('[data-visor-ir]').forEach((b) => b.addEventListener('click', () => ir(b.dataset.visorIr)));

  /* ---------- 1. Foto: normalización ---------- */
  // Marco para la IA: la proporción admitida más cercana a la foto, alcanzada con bandas de relleno (nunca recortando)
  const marcoPara = (w, h) => {
    const r = w / h;
    const [a, b] = PROPORCIONES.reduce((m, p) => (Math.abs(Math.log(p[0] / p[1] / r)) < Math.abs(Math.log(m[0] / m[1] / r)) ? p : m));
    const R = a / b;
    let W = w, H = h;
    if (R > r) W = Math.round(h * R); else if (R < r) H = Math.round(w / R);
    if (Math.abs(W - w) <= 2 && Math.abs(H - h) <= 2) { W = w; H = h; } // ya está en la proporción
    return { W, H, x: Math.floor((W - w) / 2), y: Math.floor((H - h) / 2), proporcion: `${a}:${b}`, relleno: W !== w || H !== h };
  };
  const usarFoto = (foto, ancho, alto, zonas = []) => {
    Object.assign(e, { foto, ancho, alto, marco: marcoPara(ancho, alto), zonas: zonas.map((z) => z.slice()), actual: [] });
    visor.style.setProperty('--ar', (ancho / alto).toFixed(4));
    $('[data-visor-foto]').src = foto;
    svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
  };
  const esHeic = (f) => /\.(heic|heif)$/i.test(f.name || '') || /image\/hei[cf]/i.test(f.type || '');
  // Lee la foto con la orientación que guardó el celular y la deja con lado largo de máximo LADO px. Si es enorme
  // (más de 40 MP), la decodifica ya reducida para no agotar la memoria del celular.
  const leer = async (archivo) => {
    const url = URL.createObjectURL(archivo);
    try {
      const img = await imagen(url);
      const w0 = img.naturalWidth, h0 = img.naturalHeight;
      if (!w0 || !h0) throw new Error('sin medidas');
      const f = Math.min(1, LADO / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * f)), h = Math.max(1, Math.round(h0 * f));
      let fuente = img;
      if (w0 * h0 > 40e6 && 'createImageBitmap' in window) {
        try {
          const b = await createImageBitmap(archivo, { imageOrientation: 'from-image', resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
          if (b.width === w && b.height === h) fuente = b; else b.close();
        } catch { /* este navegador no reduce al decodificar: se usa la imagen completa */ }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(fuente, 0, 0, w, h);
      if (fuente !== img) fuente.close();
      return { c, w0, h0 };
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const cargar = async (archivo) => {
    if (!archivo) return;
    const nombre = archivo.name ? `«${archivo.name}»` : 'Ese archivo';
    const heic = esHeic(archivo);
    if (!/^image\//.test(archivo.type) && !heic) return avisar(`${nombre} no es una foto. Sube una imagen en JPG, PNG, WebP o HEIC.`);
    const mb = archivo.size / 1048576;
    if (mb > MAX_MB) return avisar(`La foto pesa ${mb.toFixed(0)} MB y el máximo es ${MAX_MB} MB. Elige una más liviana o recórtala.`);
    let leida;
    try {
      leida = await leer(archivo);
    } catch {
      return avisar(heic
        ? `Este navegador no abre fotos HEIC del iPhone (${nombre}). Súbela desde el iPhone, donde se convierte sola a JPG, o expórtala como JPG.`
        : `No se pudo abrir ${nombre}: el archivo está dañado o en un formato que este navegador no lee. Prueba con la foto en JPG o PNG.`);
    }
    const { c, w0, h0 } = leida;
    usarFoto(c.toDataURL('image/jpeg', 0.9), c.width, c.height);
    const largo = Math.max(w0, h0), alargada = Math.max(w0 / h0, h0 / w0);
    if (largo < MIN_LADO) avisar(`Tu foto es pequeña (${w0} × ${h0} px): el resultado puede verse borroso. Si puedes, usa la foto original de la cámara y no una reenviada por WhatsApp.`, 'nota');
    else if (alargada > 3) avisar('La foto es muy alargada (panorámica). Para un resultado más fiel, recórtala para que la pared o el techo ocupen la mayor parte.', 'nota');
    else avisar('');
    ir('zona');
  };
  $$('[data-visor-archivo]').forEach((inp) => inp.addEventListener('change', () => { cargar(inp.files[0]); inp.value = ''; }));
  ['dragenter', 'dragover'].forEach((t) => soltar.addEventListener(t, (ev) => { ev.preventDefault(); soltar.classList.add('encima'); }));
  ['dragleave', 'drop'].forEach((t) => soltar.addEventListener(t, () => soltar.classList.remove('encima')));
  soltar.addEventListener('drop', (ev) => { ev.preventDefault(); cargar(ev.dataTransfer.files[0]); });

  /* ---------- 2. Zonas: polígonos sobre la foto (coordenadas en px de la foto) ---------- */
  const escala = () => e.ancho / (svg.getBoundingClientRect().width || e.ancho || 1);
  function pintarZonas() {
    const k = escala(), pts = (z) => z.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const a = e.actual, cierra = a.length >= 3;
    svg.innerHTML = [
      ...e.zonas.map((z) => `<polygon class="zona" points="${pts(z)}"/>`),
      a.length > 1 ? `<polyline class="zona zona--abierta" points="${pts(a)}"/>` : '',
      ...a.map((p, i) => `<circle class="${i === 0 && cierra ? 'zona__cierre' : 'zona__punto'}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${((i === 0 && cierra ? 11 : 6.5) * k).toFixed(1)}"/>`),
    ].join('');
    const n = e.zonas.length;
    $('[data-visor-cuenta]').textContent = a.length ? `Zona ${n + 1}: ${a.length} ${a.length === 1 ? 'punto' : 'puntos'}${cierra ? ' · toca el primero para cerrarla' : ''}` : n ? `${n} ${n === 1 ? 'zona marcada' : 'zonas marcadas'}` : 'Sin zonas marcadas';
    $('[data-visor-deshacer]').disabled = !n && !a.length;
    $('[data-visor-limpiar]').disabled = !n && !a.length;
    $('[data-visor-zonas-listas]').disabled = !n && !cierra;
  }
  // Se escucha en toda la escena: un toque en la esquina redondeada o un poco por fuera de la foto (hasta 32 px)
  // pone el punto justo en el borde, que es donde suele terminar la pared.
  escena.addEventListener('pointerdown', (ev) => {
    if (visor.dataset.paso !== 'zona' || ev.button > 0) return;
    const r = svg.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, m = 32;
    if (x < -m || y < -m || x > r.width + m || y > r.height + m) return;
    ev.preventDefault();
    const p = { x: (Math.min(Math.max(x, 0), r.width) / r.width) * e.ancho, y: (Math.min(Math.max(y, 0), r.height) / r.height) * e.alto };
    const a = e.actual;
    if (a.length >= 3 && Math.hypot(p.x - a[0].x, p.y - a[0].y) < 24 * escala()) { e.zonas.push(a.slice()); e.actual = []; }
    else a.push(p);
    pintarZonas();
  });
  $('[data-visor-deshacer]').addEventListener('click', () => { if (e.actual.length) e.actual.pop(); else if (e.zonas.length) e.actual = e.zonas.pop(); pintarZonas(); });
  $('[data-visor-limpiar]').addEventListener('click', () => { e.zonas = []; e.actual = []; pintarZonas(); });
  $('[data-visor-zonas-listas]').addEventListener('click', () => { if (e.actual.length >= 3) { e.zonas.push(e.actual); e.actual = []; } ir('acabado'); });
  $('[data-visor-toda]').addEventListener('click', () => { e.zonas = []; e.actual = []; ir('acabado'); });
  addEventListener('resize', () => { if (e.foto) pintarZonas(); });

  /* ---------- Lo que recibe la IA: todo en el mismo marco (foto + bandas de relleno) ---------- */
  const lienzoDe = (W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const trazar = (g, z, dx = 0, dy = 0) => { g.beginPath(); z.forEach((p, i) => (i ? g.lineTo(p.x + dx, p.y + dy) : g.moveTo(p.x + dx, p.y + dy))); g.closePath(); };
  // Las zonas en blanco, en coordenadas de la foto. Con fondo transparente sirven para recortar el resultado en el
  // navegador («destination-in» usa la transparencia); con fondo negro, para medir.
  const zonasEn = (fondo) => {
    const c = lienzoDe(e.ancho, e.alto), g = c.getContext('2d');
    if (fondo) { g.fillStyle = fondo; g.fillRect(0, 0, c.width, c.height); }
    g.fillStyle = '#fff';
    for (const z of e.zonas) { trazar(g, z); g.fill(); }
    return c;
  };
  // La foto dentro del marco. Las bandas son la misma foto, ampliada hasta cubrir el marco y muy desenfocada (se
  // reduce a 48 px y se vuelve a ampliar): se ven como continuación difusa, no como franjas de color.
  const enMarco = (foto, encima) => {
    const { W, H, x, y } = e.marco;
    const c = lienzoDe(W, H), g = c.getContext('2d');
    if (e.marco.relleno) {
      const k = Math.max(W / e.ancho, H / e.alto), s = 48 / W;
      const chico = lienzoDe(48, Math.max(1, Math.round(H * s)));
      chico.getContext('2d').drawImage(foto, ((W - e.ancho * k) / 2) * s, ((H - e.alto * k) / 2) * s, e.ancho * k * s, e.alto * k * s);
      g.imageSmoothingQuality = 'high';
      g.drawImage(chico, 0, 0, W, H);
    }
    g.drawImage(foto, x, y, e.ancho, e.alto);
    encima?.(g, x, y);
    return c;
  };
  // Guía: la foto con la zona en magenta (relleno translúcido y contorno). Máscara: blanco = cambiar, negro = no tocar
  // (las bandas de relleno van en negro).
  const guiaEnMarco = (foto) => enMarco(foto, (g, x, y) => {
    g.fillStyle = 'rgba(255, 0, 255, .38)';
    for (const z of e.zonas) { trazar(g, z, x, y); g.fill(); }
    g.strokeStyle = '#ff00ff'; g.lineJoin = 'round'; g.lineWidth = Math.max(3, Math.round(e.ancho / 320));
    for (const z of e.zonas) { trazar(g, z, x, y); g.stroke(); }
  });
  const mascaraEnMarco = () => {
    const { W, H, x, y } = e.marco;
    const c = lienzoDe(W, H), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff';
    for (const z of e.zonas) { trazar(g, z, x, y); g.fill(); }
    return c;
  };
  // La IA devuelve el marco completo: se lleva a la medida del marco y se recorta la parte que corresponde a la foto
  const alinear = async (src) => {
    const gen = await imagen(src);
    const { W, H, x, y } = e.marco, sx = gen.naturalWidth / W, sy = gen.naturalHeight / H;
    const c = lienzoDe(e.ancho, e.alto);
    c.getContext('2d').drawImage(gen, x * sx, y * sy, e.ancho * sx, e.alto * sy, 0, 0, e.ancho, e.alto);
    return c;
  };

  // Revisión del resultado de la IA, antes de mostrarlo:
  // · cambio: fracción de la zona cuyos píxeles cambiaron de forma visible (0 a 1). Casi 0 = «no la coloreó».
  // · desalineo: diferencia media en gris FUERA de la zona (0–255), en miniatura y desenfocada. Si la IA reencuadró
  //   la escena, lo de la zona queda corrido: una imagen alineada da ~7 y una reencuadrada ~46 (calibrado).
  const MIN_CAMBIO = 0.25, MAX_DESALINEO = 20;
  const medir = async (alineada) => {
    const orig = await imagen(e.foto);
    const pixeles = (W, H, dibujar, desenfoque = 0) => {
      const g = lienzoDe(W, H).getContext('2d', { willReadFrequently: true });
      if (desenfoque) g.filter = `blur(${desenfoque}px)`;
      dibujar(g, W, H);
      return g.getImageData(0, 0, W, H).data;
    };
    const tam = (W) => [W, Math.max(1, Math.round((W * e.alto) / e.ancho))];
    const de = (fuente) => (g, W, H) => g.drawImage(fuente, 0, 0, W, H);
    const [W1, H1] = tam(320), [W2, H2] = tam(64), negro = zonasEn('#000');
    const a = pixeles(W1, H1, de(orig)), b = pixeles(W1, H1, de(alineada)), m = pixeles(W1, H1, de(negro));
    let dentro = 0, cambiados = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (m[i] < 128) continue;
      dentro++;
      if ((Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3 > 28) cambiados++;
    }
    const gris = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const a2 = pixeles(W2, H2, de(orig), 1), b2 = pixeles(W2, H2, de(alineada), 1), m2 = pixeles(W2, H2, de(negro));
    let fuera = 0, suma = 0;
    for (let i = 0; i < a2.length; i += 4) { if (m2[i] >= 128) continue; fuera++; suma += Math.abs(gris(a2, i) - gris(b2, i)); }
    return { cambio: dentro ? cambiados / dentro : 1, desalineo: fuera ? suma / fuera : 0 };
  };
  const falla = (x) => (x.desalineo > MAX_DESALINEO ? 'desalineada' : x.cambio < MIN_CAMBIO ? 'sin-cambio' : '');
  const puntaje = (x) => (x.desalineo <= MAX_DESALINEO ? 2 : 0) + x.cambio;
  // Sin zonas se usa toda la imagen de la IA; con zonas, solo dentro de ellas (borde suave): fuera queda la foto
  // original, píxel por píxel, aunque la IA haya cambiado algo ahí.
  const componer = async (alineada, conZonas) => {
    const c = lienzoDe(e.ancho, e.alto), g = c.getContext('2d');
    if (!conZonas) { g.drawImage(alineada, 0, 0); return c.toDataURL('image/jpeg', 0.92); }
    g.drawImage(await imagen(e.foto), 0, 0);
    const capa = lienzoDe(e.ancho, e.alto), k = capa.getContext('2d');
    k.drawImage(alineada, 0, 0);
    k.globalCompositeOperation = 'destination-in';
    k.filter = `blur(${Math.max(1, Math.round(e.ancho / 800))}px)`;
    k.drawImage(zonasEn(null), 0, 0);
    g.drawImage(capa, 0, 0);
    return c.toDataURL('image/jpeg', 0.92);
  };

  /* ---------- 3. Acabado y generación ---------- */
  const desc = $('[data-visor-desc]');
  const strong = (t) => Object.assign(document.createElement('strong'), { textContent: t });
  $$('input[name="acabado"]').forEach((r) => r.addEventListener('change', () => desc.replaceChildren(strong(r.dataset.nombre), ` · ${r.dataset.desc}`)));
  const cargando = $('[data-visor-cargando]');
  let reloj, reforzando = false;
  const esperar = (si) => {
    cargando.hidden = !si;
    $('[data-visor-generar]').disabled = si;
    visor.toggleAttribute('aria-busy', si);
    clearInterval(reloj);
    reforzando = false;
    if (!si) return;
    const t0 = Date.now();
    $('[data-visor-segundos]').textContent = '0';
    $('[data-visor-frase]').textContent = FRASES[0];
    reloj = setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      $('[data-visor-segundos]').textContent = s;
      $('[data-visor-frase]').textContent = reforzando || FRASES[Math.min(FRASES.length - 1, Math.floor(s / 8))];
    }, 500);
  };
  // Versión para descargar y compartir: rótulo «Imagen ilustrativa» con el acabado y el logo de Eternit
  const LOGO = document.querySelector('.cab-portal__logo img')?.src;
  const pastilla = (g, x, y, w, h) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, h / 2); else g.rect(x, y, w, h); g.fill(); };
  const marcar = async (src, nombre) => {
    const [foto, logo] = await Promise.all([imagen(src), LOGO ? imagen(LOGO).catch(() => null) : null]);
    const c = lienzoDe(foto.naturalWidth, foto.naturalHeight), g = c.getContext('2d');
    g.drawImage(foto, 0, 0);
    const u = Math.max(11, Math.round(Math.min(c.width, c.height * 1.4) / 62)), h = Math.round(u * 2.2), y = c.height - u - h;
    g.font = `700 ${u}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
    g.textBaseline = 'middle';
    const texto = `Eterboard Design ${nombre} · Imagen ilustrativa`;
    g.fillStyle = 'rgba(18, 17, 16, .62)';
    pastilla(g, u, y, g.measureText(texto).width + u * 1.8, h);
    g.fillStyle = '#fffdf9';
    g.fillText(texto, u * 1.9, y + h / 2 + 1);
    if (logo) {
      const lh = h * 0.46, lw = lh * (logo.naturalWidth / logo.naturalHeight), pw = lw + u * 1.8;
      g.fillStyle = '#fffdf9';
      pastilla(g, c.width - u - pw, y, pw, h);
      g.drawImage(logo, c.width - u - pw + u * 0.9, y + (h - lh) / 2, lw, lh);
    }
    return c.toDataURL('image/jpeg', 0.92);
  };
  const pedir = async (cuerpo) => {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const d = await r.json().catch(() => ({}));
    d.imagen ||= d.imagen_url; // si la imagen pesa más de lo que deja responder la nube, llega su dirección
    if (!r.ok || !d.imagen) throw new Error(d.error || `El servidor del portal respondió con un error (${r.status}). Intenta de nuevo en un momento.`);
    return d;
  };
  // Foto y guía en JPEG: si juntas pasan del tope de envío, se repiten con menos calidad (la guía solo marca la zona)
  const armar = (foto, conZonas) => {
    const fotoMarco = enMarco(foto), guiaMarco = conZonas ? guiaEnMarco(foto) : null, mascara = conZonas ? mascaraEnMarco().toDataURL('image/png') : null;
    let cuerpo;
    for (const [qf, qg] of [[0.9, 0.88], [0.84, 0.74], [0.76, 0.6], [0.68, 0.5], [0.6, 0.42]]) {
      cuerpo = { version: VERSION, foto: fotoMarco.toDataURL('image/jpeg', qf), relleno: e.marco.relleno, acabado: $('input[name="acabado"]:checked').value, calidad: $('input[name="calidad"]:checked').value, instrucciones: $('[data-visor-notas]').value.trim(), intento: 1 };
      if (conZonas) Object.assign(cuerpo, { guia: guiaMarco.toDataURL('image/jpeg', qg), mascara });
      if (JSON.stringify(cuerpo).length <= MAX_ENVIO) break;
    }
    return cuerpo;
  };
  $('[data-visor-generar]').addEventListener('click', async () => {
    const elegido = $('input[name="acabado"]:checked');
    const conZonas = e.zonas.length > 0;
    avisar('');
    esperar(true);
    try {
      const foto = await imagen(e.foto);
      const cuerpo = armar(foto, conZonas);
      let d = await pedir(cuerpo), segundos = d.segundos, alineada = await alinear(d.imagen);
      // Si la IA dejó la zona casi igual o corrió el encuadre, se repite una vez con la instrucción reforzada
      // para ese motivo y se queda el mejor de los dos intentos.
      if (conZonas) {
        let r = await medir(alineada);
        const motivo = falla(r);
        if (motivo) {
          reforzando = motivo === 'desalineada' ? 'La IA movió el encuadre: lo intenta de nuevo sobre la misma foto' : 'La zona quedó casi igual: la IA lo intenta de nuevo, con más fuerza';
          const d2 = await pedir({ ...cuerpo, intento: 2, motivo });
          segundos += d2.segundos;
          const alineada2 = await alinear(d2.imagen), r2 = await medir(alineada2);
          if (puntaje(r2) > puntaje(r)) { d = d2; alineada = alineada2; r = r2; }
          const sigue = falla(r);
          if (sigue === 'desalineada') avisar('La IA cambió el encuadre de la foto y la simulación puede verse corrida. Intenta de nuevo o prueba la calidad rápida.', 'nota');
          else if (sigue) avisar('La IA casi no cambió la zona marcada. Prueba marcando solo la superficie (pared o techo), con otro acabado o con una indicación como «cubre todo el techo».', 'nota');
        }
      }
      const despues = await componer(alineada, conZonas);
      const marcada = await marcar(despues, elegido.dataset.nombre);
      mostrar({ antes: e.foto, ancho: e.ancho, alto: e.alto, zonas: e.zonas.map((z) => z.slice()), despues, marcada, acabado: elegido.value, nombre: elegido.dataset.nombre, segundos, modelo: d.modelo });
    } catch (err) {
      avisar(err instanceof TypeError ? 'Sin conexión con el servidor del portal. Revisa tu conexión a internet y vuelve a intentarlo.' : err.message);
    } finally {
      esperar(false);
    }
  });

  /* ---------- 4. Resultado: antes y después, descarga, compartir y galería ---------- */
  const rango = $('[data-visor-rango]');
  const cortar = () => comparar.style.setProperty('--n', rango.value / 100);
  rango.addEventListener('input', cortar);
  let vista;
  // Ver una simulación también recupera su foto y sus zonas: «Probar otro acabado» sigue sobre esa misma pared
  const ver = (s) => {
    vista = s;
    usarFoto(s.antes, s.ancho, s.alto, s.zonas);
    $('[data-visor-antes]').src = s.antes;
    $('[data-visor-despues]').src = s.despues;
    $('[data-visor-resumen]').replaceChildren('Eterboard Design ', strong(s.nombre), `${s.segundos ? `, lista en ${s.segundos} s` : ''}${s.modelo ? ` con ${s.modelo}` : ''}. Desliza sobre la foto para comparar el antes y el después.`);
    const d = $('[data-visor-descargar]');
    d.href = s.marcada; d.download = `eternit-${s.acabado}.jpg`;
    rango.value = 50; cortar();
    ir('resultado');
  };
  const mostrar = (s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.append(Object.assign(document.createElement('img'), { src: s.despues, alt: '' }), Object.assign(document.createElement('span'), { textContent: s.nombre }));
    b.addEventListener('click', () => ver(s));
    const li = document.createElement('li');
    li.append(b);
    $('[data-visor-lista]', document).prepend(li);
    $('[data-visor-galeria]', document).hidden = false;
    ver(s);
  };
  // Compartir el archivo (celulares y navegadores que lo permiten); si no, queda la descarga.
  const compartir = $('[data-visor-compartir]');
  const archivoDe = async (s) => new File([await (await fetch(s.marcada)).blob()], `eternit-${s.acabado}.jpg`, { type: 'image/jpeg' });
  try {
    if (navigator.canShare?.({ files: [new File(['x'], 'x.jpg', { type: 'image/jpeg' })] })) {
      compartir.hidden = false;
      compartir.addEventListener('click', async () => {
        try {
          await navigator.share({ files: [await archivoDe(vista)], title: 'Así quedaría tu pared con Eternit', text: `Simulación con Eterboard Design ${vista.nombre}. Imagen ilustrativa.` });
        } catch { /* el usuario cerró el menú de compartir */ }
      });
    }
  } catch { /* sin Web Share */ }
  $('[data-visor-nueva]').addEventListener('click', () => { Object.assign(e, { foto: null, zonas: [], actual: [] }); avisar(''); ir('foto'); });

  ir('foto', false);
})();
