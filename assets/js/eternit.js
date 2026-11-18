/* Eternit · propuesta de rediseño. JavaScript sin dependencias, mejora progresiva:
   todo el contenido existe en el HTML y funciona sin este archivo. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const BASE = document.documentElement.dataset.base || '';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ahorro = navigator.connection?.saveData === true;
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const fmt = (n, d = 2) => n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
  const escapar = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const visible = (el, fn, opciones = { threshold: 0 }) => new IntersectionObserver((es) => es.forEach((e) => fn(e.isIntersecting, e)), opciones).observe(el);
  const enlace = (u) => (/^(https?:|mailto:|tel:)/.test(u) ? u : BASE + u);
  const WA = 'https://wa.me/573213377648';

  /* ---------- Intro: la familia techa su casa (primera página de la sesión y cada recarga con F5) ---------- */
  const intro = $('#intro');
  if (intro && document.documentElement.classList.contains('con-intro')) {
    let cargada = document.readyState === 'complete';
    addEventListener('load', () => { cargada = true; }, { once: true });
    const salir = () => {
      if (intro.dataset.fuera) return;
      intro.dataset.fuera = '1';
      try { sessionStorage.setItem('eternit-intro', '1'); } catch (e) { /* sin almacenamiento */ }
      intro.classList.add('intro--fuera');
      setTimeout(() => { document.documentElement.classList.remove('con-intro'); intro.remove(); }, 1000);
    };
    // Sale cuando la familia termina de celebrar (último corazón) y la página ya cargó.
    let celebro = false;
    intro.addEventListener('animationend', (e) => { if (e.animationName === 'corazon') celebro = true; });
    // Tope de 4,5 s (más la salida, menos de 5 s): nada que se mueva solo dura más sin poder saltarse.
    const vigilar = () => { if ((cargada && celebro) || performance.now() > 4500) setTimeout(salir, 250); else setTimeout(vigilar, 120); };
    vigilar();
    intro.addEventListener('click', salir);
    addEventListener('keydown', salir, { once: true });
  } else intro?.remove();

  /* ---------- Cabecera: se compacta al bajar y vuelve al subir ---------- */
  const cab = $('[data-cab]');
  const megas = $$('[data-mega]');
  // Al cerrar con clic o con Esc, el panel se va de inmediato (la espera de medio segundo es solo para el cursor)
  const cerrarMegas = (excepto) => megas.forEach((m) => {
    if (m === excepto) return;
    if (m.classList.contains('abierto')) { m.classList.add('mega--rapido'); setTimeout(() => m.classList.remove('mega--rapido'), 700); }
    m.classList.remove('abierto');
    $('.mega__abrir', m)?.setAttribute('aria-expanded', 'false');
  });
  if (cab) {
    const movil = matchMedia('(max-width: 1080px)');
    const main = $('.cab__main', cab), cats = $('.cab__cats', cab);
    let ultimo = scrollY, pendiente = false;
    const aplicar = () => {
      pendiente = false;
      const y = scrollY;
      if (y > ultimo + 4 && y > 260 && !cab.contains(document.activeElement)) { cab.classList.add(movil.matches ? 'cab--oculta' : 'cab--compacta'); cerrarMegas(); }
      else if (y < ultimo - 4 || y < 200) cab.classList.remove('cab--oculta', 'cab--compacta');
      ultimo = y;
      const alto = movil.matches
        ? (cab.classList.contains('cab--oculta') ? 0 : main.offsetHeight + cats.offsetHeight)
        : main.offsetHeight + (cab.classList.contains('cab--compacta') ? 0 : cats.offsetHeight);
      document.documentElement.style.setProperty('--cab-visible', `${alto}px`);
    };
    let quieto;
    addEventListener('scroll', () => {
      if (!pendiente) { pendiente = true; requestAnimationFrame(aplicar); }
      cab.classList.add('cab--desplazando'); // no abrir megamenús por pasar bajo el puntero mientras se desplaza
      clearTimeout(quieto);
      quieto = setTimeout(() => cab.classList.remove('cab--desplazando'), 350);
    }, { passive: true });
    movil.addEventListener('change', aplicar);
    aplicar();
  }

  /* ---------- Megamenús: hover en escritorio, botón para teclado y tacto ---------- */
  megas.forEach((m) => {
    const boton = $('.mega__abrir', m);
    boton?.addEventListener('click', () => {
      const abrir = !m.classList.contains('abierto');
      cerrarMegas(m);
      m.classList.toggle('abierto', abrir);
      boton.setAttribute('aria-expanded', abrir);
    });
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('[data-mega]')) cerrarMegas(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const abierto = megas.find((m) => m.classList.contains('abierto')); cerrarMegas(); $('.mega__abrir', abierto || document.body)?.focus(); } });

  /* ---------- Buscador: índice propio, resultados instantáneos ---------- */
  let indice = null, cargando = null;
  const cargarIndice = () => (cargando ||= fetch(`${BASE}assets/datos/buscador.json`).then((r) => r.json()).then((d) => {
    indice = d.map((x) => ({ ...x, _t: norm(x.t), _d: norm(x.d || ''), _k: x.k || '' }));
    return indice;
  }));
  const VACIAS = new Set('de la el los las un una unos unas y o a en para por con que como cual cuales cuanto cuantos cuanta cuantas es son mi mis tu su se me del al lo le hay necesito quiero tengo puedo sirve'.split(' '));
  const SINONIMOS = { drywall: 'eterboard placa', superboard: 'eterboard placa', barro: 'decorativa arcilla', arcilla: 'decorativa', techo: 'teja cubierta', tejado: 'teja cubierta', lamina: 'teja placa', laminas: 'teja placa', eternit: 'teja', tejas: 'teja', tanques: 'tanque', pinturas: 'pintura', numero: 'no', galpon: 'techolit polipropileno', establo: 'techolit polipropileno', traslucida: 'policarbonato', transparente: 'policarbonato traslucido', septico: 'sistemas septicos', pozo: 'septicos' };
  const METAL = /\b(lata|zinc|metal|metalica|metalicas|acero|galvanizada|aluminio)\b/;
  const terminos = (q) => norm(q).replace(/[¿?¡!.,;:()"']/g, ' ').split(/\s+/).filter((t) => t && !VACIAS.has(t))
    .flatMap((t) => [t, ...(SINONIMOS[t] ? SINONIMOS[t].split(' ') : [])]);
  const puntuar = (it, ts) => ts.reduce((p, t) => p + (it._t.startsWith(t) ? 8 : it._t.includes(t) ? 5 : 0) + (it._k.includes(t) ? 3 : 0) + (it._d.includes(t) ? 1 : 0), 0);
  const consultar = (q) => {
    let ts = terminos(q);
    if (METAL.test(norm(q))) ts = [...ts.filter((t) => !METAL.test(t)), 'teja', 'fibrocemento', 'plastica'];
    if (!ts.length) return [];
    return indice.map((it) => [it, puntuar(it, ts)]).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]).map(([it]) => it);
  };
  const resaltar = (texto, q) => {
    let html = escapar(texto);
    for (const t of terminos(q).filter((t) => t.length > 2)) {
      const i = norm(html).indexOf(t);
      if (i >= 0) html = `${html.slice(0, i)}<mark>${html.slice(i, i + t.length)}</mark>${html.slice(i + t.length)}`;
    }
    return html;
  };
  const ORDEN = [['Productos', 5], ['Líneas', 2], ['Herramientas', 2], ['Respuestas', 3], ['Documentos', 2]];
  const esPregunta = (q) => /\?|^(como|cual|cuanto|cuantas|cuantos|que|donde|por que|se puede|puedo)\b/.test(norm(q.trim()));
  const fila = (it, q) => {
    const img = it.i ? `<img src="${escapar(enlace(it.i))}" alt="" width="52" height="52" decoding="async">` : `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/></svg>`;
    return `<li class="res__item"><a href="${escapar(enlace(it.u))}"><span class="res__thumb">${img}</span><span><span class="res__t">${resaltar(it.t, q)}</span><span class="res__d">${escapar(it.c || it.d || '')}</span></span><svg class="flecha" viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></a></li>`;
  };
  const pintarResultados = (q, todos, limite) => {
    const grupos = ORDEN.map(([g, n]) => [g, todos.filter((x) => x.g === g).slice(0, limite ? n : 99)]).filter(([, l]) => l.length);
    const aviso = METAL.test(norm(q)) ? '<p class="res__aviso">Eternit no fabrica tejas metálicas. Estas son las opciones en fibrocemento y plásticas, que no se oxidan.</p>' : '';
    const ia = esPregunta(q) ? `<ul class="res__grupo"><li class="res__item res__ia"><a href="?pregunta=${encodeURIComponent(q)}" data-preguntar="${escapar(q)}"><span class="res__thumb"><span class="chispa"></span></span><span><span class="res__t">Preguntarle al asistente</span><span class="res__d">«${escapar(q)}»</span></span><svg class="flecha" viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></a></li></ul>` : '';
    if (!grupos.length) return `${aviso}${ia}<p class="res__vacio">No encontramos «${escapar(q)}». Pregúntanos por <a href="${WA}?text=${encodeURIComponent(`Hola Eternit, busco: ${q}`)}" rel="noopener">WhatsApp</a>.</p>`;
    return aviso + ia + grupos.map(([g, l]) => `<section class="res__grupo"><h2 class="res__titulo">${g}</h2><ul>${l.map((x) => fila(x, q)).join('')}</ul></section>`).join('');
  };

  $$('[data-buscador]').forEach((form) => {
    const campo = $('input', form), panel = $('[data-buscador-panel]', form);
    let temporizador;
    const cerrar = () => { panel.hidden = true; campo.setAttribute('aria-expanded', 'false'); };
    const actualizar = async () => {
      const q = campo.value.trim();
      if (q.length < 2) return cerrar();
      await cargarIndice();
      const todos = consultar(q);
      panel.innerHTML = pintarResultados(q, todos, true) + (todos.length > 8 ? `<a class="res__todos" href="${BASE}buscar/?q=${encodeURIComponent(q)}">Ver los ${todos.length} resultados <svg class="flecha" viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></a>` : '');
      panel.hidden = false;
      campo.setAttribute('aria-expanded', 'true');
    };
    campo.addEventListener('focus', cargarIndice, { once: true });
    campo.addEventListener('input', () => { clearTimeout(temporizador); temporizador = setTimeout(actualizar, 90); });
    campo.addEventListener('focus', () => { if (campo.value.trim().length > 1) actualizar(); });
    form.addEventListener('focusout', (e) => { if (!form.contains(e.relatedTarget)) setTimeout(cerrar, 120); });
    form.addEventListener('keydown', (e) => {
      const enlaces = $$('a', panel);
      const i = enlaces.indexOf(document.activeElement);
      if (e.key === 'Escape') { cerrar(); campo.focus(); }
      if (e.key === 'ArrowDown' && enlaces.length) { e.preventDefault(); enlaces[Math.min(i + 1, enlaces.length - 1)].focus(); }
      if (e.key === 'ArrowUp' && i >= 0) { e.preventDefault(); (i === 0 ? campo : enlaces[i - 1]).focus(); }
    });
  });

  const paginaResultados = $('[data-resultados-pagina]');
  if (paginaResultados) {
    const q = new URLSearchParams(location.search).get('q')?.trim() || '';
    const campo = $('input', paginaResultados), lista = $('[data-resultados]', paginaResultados);
    campo.value = q;
    if (q) cargarIndice().then(() => {
      const todos = consultar(q);
      $('[data-resultados-titulo]').textContent = todos.length ? `${todos.length} resultados para «${q}»` : `Sin resultados para «${q}»`;
      document.title = `${q} · Buscar | Eternit Colombia`;
      lista.innerHTML = pintarResultados(q, todos, false);
    });
  }

  /* ---------- Dock móvil: la lupa abre el buscador de la cabecera ---------- */
  $('[data-dock-buscar]')?.addEventListener('click', () => {
    cab?.classList.remove('cab--oculta');
    $('#buscar-cab')?.focus();
  });

  /* ---------- Avisos breves (los usa el portal de distribuidores) ---------- */
  const ICO = { check: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4L19 7"/></svg>' };
  const aviso = $('[data-cot-aviso]');
  let tAviso;
  const avisar = (texto) => {
    if (!aviso) return;
    aviso.innerHTML = `<span class="aviso-coti__txt">${ICO.check}${escapar(texto)}</span>`;
    aviso.classList.add('visible');
    clearTimeout(tAviso);
    tAviso = setTimeout(() => aviso.classList.remove('visible'), 4500);
  };

  /* ---------- Home: banner de productos (carrusel accesible sobre scroll-snap) ----------
     Sin avance automático (manual, secciones 12 y 22): solo se mueve con las flechas, los puntos, el teclado o
     deslizando con el dedo. */
  $$('[data-carrusel]').forEach((car) => {
    const pista = $('[data-pista]', car), slides = $$('.banner', car), puntos = $$('[data-carrusel-ir]', car);
    let i = 0;
    const marcar = () => puntos.forEach((p, k) => p.setAttribute('aria-current', String(k === i)));
    const ir = (n) => { i = (n + slides.length) % slides.length; pista.scrollTo({ left: i * pista.clientWidth, behavior: reduce ? 'auto' : 'smooth' }); marcar(); };
    let cuadro;
    pista.addEventListener('scroll', () => { cancelAnimationFrame(cuadro); cuadro = requestAnimationFrame(() => { i = Math.round(pista.scrollLeft / pista.clientWidth); marcar(); }); }, { passive: true });
    $('[data-carrusel-prev]', car).addEventListener('click', () => ir(i - 1));
    $('[data-carrusel-sig]', car).addEventListener('click', () => ir(i + 1));
    puntos.forEach((p, k) => p.addEventListener('click', () => ir(k)));
    pista.addEventListener('keydown', (e) => {
      if (e.target !== pista) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); ir(i + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1); }
    });
  });

  /* ---------- Rieles y galerías: flechas sobre el carrusel ----------
     Avanzan de a las tarjetas que caben (o de a una con data-riel-uno). La flecha sin destino se oculta
     y, si tenía el foco, se lo pasa a la otra para no perderlo. */
  $$('[data-riel]').forEach((riel) => {
    const lista = $('[data-riel-lista]', riel);
    const prev = $('[data-riel-prev]', riel);
    const sig = $('[data-riel-sig]', riel);
    const paso = () => {
      const li = lista.firstElementChild;
      if (!li) return lista.clientWidth * 0.8;
      const ancho = li.getBoundingClientRect().width + (parseFloat(getComputedStyle(lista).columnGap) || 0);
      return riel.hasAttribute('data-riel-uno') ? ancho : Math.max(1, Math.floor((lista.clientWidth * 0.8) / ancho)) * ancho;
    };
    const mover = (s) => lista.scrollBy({ left: s * paso(), behavior: reduce ? 'auto' : 'smooth' });
    const apagar = (b, otro, si) => {
      if (!b || b.disabled === si) return;
      if (si && document.activeElement === b) otro?.focus({ preventScroll: true });
      b.disabled = si;
    };
    const estado = () => {
      const x = Math.abs(lista.scrollLeft);
      apagar(prev, sig, x <= 4);
      apagar(sig, prev, x >= lista.scrollWidth - lista.clientWidth - 4);
      riel.style.setProperty('--avance', (x / Math.max(1, lista.scrollWidth - lista.clientWidth)).toFixed(3));
    };
    prev?.addEventListener('click', () => mover(-1));
    sig?.addEventListener('click', () => mover(1));
    lista.addEventListener('scroll', estado, { passive: true });
    new ResizeObserver(estado).observe(lista);
  });

  /* ---------- Evolución: cifras que ruedan, receta que se arma y datos que se dibujan ----------
     Cada cifra se vuelve columnas de dígitos (contador mecánico); la que baja a cero gira hacia abajo.
     El lector de pantalla oye solo el valor final. */
  $$('[data-evolucion]').forEach((sec) => {
    if (reduce) return;
    sec.classList.add('anima');
    $$('[data-contar]', sec).forEach((el) => {
      const n = $$('[data-contar]', el.closest('h2, li') || sec).indexOf(el);
      const fin = el.textContent.trim();
      const baja = Number(el.dataset.de) > Number(fin);
      const columnas = [...fin].map((c, j) => {
        if (!/\d/.test(c)) return escapar(c);
        const d = Number(c);
        const vueltas = baja ? 2 : j;
        const largo = vueltas * 10 + d;
        const [desde, hasta] = baja ? [largo, d] : [0, largo];
        const tira = Array.from({ length: largo + 1 }, (_, k) => `<span>${k % 10}</span>`).join('');
        return `<span class="odo__col"><span class="odo__tira" style="--desde:${-desde};--hasta:${-hasta}">${tira}</span></span>`;
      }).join('');
      el.innerHTML = `<span class="sr-only">${escapar(fin)}</span><span class="odo" aria-hidden="true" style="--retraso:${(0.1 + n * 0.25).toFixed(2)}s">${columnas}</span>`;
    });
    const titulo = $('h2', sec);
    if (titulo) visible(titulo, (si) => si && titulo.classList.add('en-vista'), { threshold: 0.6 });
    $$('.receta', sec).forEach((r) => visible(r, (si) => si && r.classList.add('en-vista'), { threshold: 0.3 }));
    $$('.hechos li', sec).forEach((li) => visible(li, (si) => si && li.classList.add('en-vista'), { threshold: 0.6 }));
  });

  /* ---------- Manifiesto palabra por palabra (lo anima el CSS con scroll) ---------- */
  $$('[data-palabras]').forEach((el) => {
    const texto = el.textContent.trim();
    const palabras = texto.split(/\s+/);
    el.setAttribute('aria-label', texto);
    el.innerHTML = palabras.map((p, i) => `<span class="w" aria-hidden="true" style="--p:${(i / palabras.length).toFixed(3)}">${escapar(p)}</span>`).join(' ');
  });

  /* ---------- Cierre: la familia vuelve a techar cuando la ves ---------- */
  $$('[data-ilu]').forEach((caja) => {
    if (reduce) return;
    const svg = $('svg', caja);
    let hecho = false;
    visible(caja, (si) => { if (si && !hecho) { hecho = true; svg.classList.remove('anima'); void svg.getBoundingClientRect(); svg.classList.add('anima'); } }, { threshold: 0.45 });
  });

  /* ---------- Pregúntale a Eternit: chat flotante (prototipo) ---------- */
  const formIA = $('[data-asistente]');
  const panelIA = $('#asistente');
  if (formIA && panelIA) {
    const datos = JSON.parse($('#asistente-datos').textContent);
    const mensajes = $('[data-respuesta]');
    const campo = $('input', formIA);
    const chips = $$('[data-pregunta]');
    let escribiendo;
    const buscarRespuesta = (q) => {
      const n = norm(q);
      let mejor = null, puntos = 0;
      for (const d of datos) {
        const p = d.claves.reduce((s, k) => s + (n.includes(norm(k)) ? 1 : 0), 0) + (norm(d.q) === n ? 10 : 0);
        if (p > puntos) { puntos = p; mejor = d; }
      }
      return mejor;
    };
    const bajar = () => { mensajes.scrollTop = mensajes.scrollHeight; };
    const responder = (q) => {
      const d = buscarRespuesta(q);
      clearInterval(escribiendo);
      chips.forEach((c) => c.setAttribute('aria-pressed', String(Boolean(d) && datos[c.dataset.pregunta] === d)));
      mensajes.insertAdjacentHTML('beforeend', `<div class="burbuja burbuja--yo"><p>${escapar(q)}</p></div>`);
      const html = d ? d.a : 'Todavía no tengo esa respuesta en este prototipo. En la versión final, un modelo de IA la redacta a partir de las fichas técnicas, los manuales y el catálogo, y cita sus fuentes. Mientras tanto, un asesor te responde por <strong>WhatsApp</strong>.';
      const fuentes = d ? d.fuentes : [['Escribir por WhatsApp', `${WA}?text=${encodeURIComponent(`Hola Eternit, tengo una pregunta: ${q}`)}`]];
      const burbuja = document.createElement('div');
      burbuja.className = 'burbuja burbuja--eternit';
      burbuja.innerHTML = '<p></p>';
      mensajes.append(burbuja);
      const p = $('p', burbuja);
      const fichas = html.split(/(<[^>]+>|\s+)/).filter(Boolean);
      let i = 0;
      const terminar = () => {
        clearInterval(escribiendo);
        p.innerHTML = html;
        burbuja.insertAdjacentHTML('beforeend', `<div class="burbuja__fuentes">${fuentes.map(([t, u], n) => `<a href="${escapar(enlace(u))}"${/^https?:/.test(u) ? ' rel="noopener"' : ''}><b>${n + 1}</b>${escapar(t)}</a>`).join('')}</div>`);
        bajar();
      };
      bajar();
      if (reduce) return terminar();
      escribiendo = setInterval(() => {
        i += 2;
        if (i >= fichas.length) return terminar();
        p.innerHTML = `${fichas.slice(0, i).join('')}<span class="cursor-ia" aria-hidden="true"></span>`;
        bajar();
      }, 34);
    };
    formIA.addEventListener('submit', (e) => { e.preventDefault(); const q = campo.value.trim(); if (q) { responder(q); campo.value = ''; } });
    chips.forEach((c) => c.addEventListener('click', () => responder(datos[c.dataset.pregunta].q)));
    const abrir = () => { if (!panelIA.matches(':popover-open')) panelIA.showPopover(); };
    // En escritorio el cursor queda listo para escribir; en celular no se abre el teclado solo.
    panelIA.addEventListener('toggle', (e) => {
      if (e.newState === 'open' && matchMedia('(hover: hover) and (pointer: fine)').matches) campo.focus({ preventScroll: true });
      if (e.newState === 'open') bajar();
    });
    // Enlaces que abren el chat: «Preguntarle al asistente» del buscador y cualquier enlace a #asistente.
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-preguntar], a[href$="#asistente"]');
      if (!a) return;
      e.preventDefault();
      document.activeElement?.blur();
      const menu = $('#menu-movil');  // desde el menú del celular: el menú se cierra y queda solo el chat
      if (menu?.matches(':popover-open')) menu.hidePopover();
      abrir();
      if (a.dataset.preguntar) responder(a.dataset.preguntar.slice(0, 200));
    });
    const inicial = new URLSearchParams(location.search).get('pregunta');
    if (inicial) { abrir(); responder(inicial.slice(0, 200)); }
    else if (location.hash === '#asistente') abrir();
    // En la home el botón flotante espera mientras se ve la barra de accesos rápidos (en escritorio la taparía).
    const barraCaminos = $('.portada__barra'), botonIA = $('.chat-boton');
    if (barraCaminos && botonIA) visible(barraCaminos, (si) => botonIA.classList.toggle('chat-boton--espera', si), { threshold: 0.05 });
  }

  /* ---------- Home: tu clima, tu techo (pestañas accesibles) ---------- */
  const clima = $('[data-clima]');
  if (clima) {
    const tabs = $$('[data-clima-tab]', clima);
    const fotos = $$('.clima__foto', clima);
    const region = $('[data-clima-region]', clima);
    const elegir = (tab, foco) => {
      tabs.forEach((t, i) => {
        const si = t === tab;
        t.setAttribute('aria-selected', si);
        t.tabIndex = si ? 0 : -1;
        $(`#${t.getAttribute('aria-controls')}`).hidden = !si;
        fotos[i].classList.toggle('activa', si);
      });
      clima.dataset.clima = tab.dataset.climaTab;
      region.textContent = tab.dataset.region;
      if (foco) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => elegir(t));
      t.addEventListener('keydown', (e) => {
        const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); elegir(e.key === 'Home' ? tabs[0] : tabs.at(-1), true); }
        if (paso) { e.preventDefault(); elegir(tabs[(i + paso + tabs.length) % tabs.length], true); }
      });
    });
  }

  /* ---------- Home: puntos técnicos sobre la Perfil 7 ---------- */
  const puntos = $$('.punto');
  puntos.forEach((p) => p.addEventListener('click', () => {
    const abrir = p.getAttribute('aria-expanded') !== 'true';
    puntos.forEach((x) => x.setAttribute('aria-expanded', 'false'));
    p.setAttribute('aria-expanded', abrir);
  }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') puntos.forEach((x) => x.setAttribute('aria-expanded', 'false')); });

  /* ---------- Producto: color de la teja sobre la casa ---------- */
  const config = $('[data-color-config]');
  if (config) {
    const fuentes = JSON.parse(config.dataset.colorConfig);
    const escena = $('.ph__escena', config);
    const nombre = $('[data-color-nombre]', config);
    const precargadas = new Set();
    const precargar = (id) => {
      if (precargadas.has(id)) return;
      precargadas.add(id);
      const i = new Image(); i.sizes = '(min-width: 1000px) 58vw, 100vw'; i.srcset = fuentes[id].webp;
    };
    $$('input[name="color"]', config).forEach((inp) => {
      inp.parentElement.addEventListener('pointerenter', () => precargar(inp.value));
      inp.addEventListener('focus', () => precargar(inp.value));
      inp.addEventListener('change', () => {
        const actual = $$('.img', escena).at(-1);
        const nueva = actual.cloneNode(true);
        nueva.style.viewTransitionName = 'none';
        nueva.style.opacity = '0';
        $('source[type="image/avif"]', nueva).srcset = fuentes[inp.value].avif;
        $('source[type="image/webp"]', nueva).srcset = fuentes[inp.value].webp;
        const img = $('img', nueva);
        img.removeAttribute('fetchpriority');
        img.alt = `Casa campestre con cubierta de Teja Ondulada Perfil 7 en color ${inp.dataset.nombre.toLowerCase()}`;
        escena.append(nueva);
        nombre.textContent = inp.dataset.nombre;
        const mostrar = () => requestAnimationFrame(() => {
          nueva.style.opacity = '1';
          setTimeout(() => $$('.img', escena).forEach((n) => n !== nueva && n.remove()), 700);
        });
        img.decode().then(mostrar, mostrar);
      });
    });
  }

  /* ---------- Home: la teja de «El ícono» cambia al color elegido ---------- */
  const visualTeja = $('[data-teja]');
  if (visualTeja) {
    const fuentes = JSON.parse(visualTeja.dataset.teja);
    const baseTeja = $('.img', visualTeja), nombreTeja = $('[data-teja-nombre]');
    const precargadas = new Set();
    const precargar = (id) => {
      if (id === 'gris' || precargadas.has(id)) return;
      precargadas.add(id);
      const i = new Image(); i.sizes = $('img', baseTeja).sizes; i.srcset = fuentes[id].webp;
    };
    $$('input[name="teja-color"]').forEach((inp) => {
      inp.parentElement.addEventListener('pointerenter', () => precargar(inp.value));
      inp.addEventListener('focus', () => precargar(inp.value));
      inp.addEventListener('change', () => {
        if (nombreTeja) nombreTeja.textContent = inp.dataset.nombre;
        const capas = $$('.icono__capa', visualTeja);
        if (inp.value === 'gris') { // vuelve la foto original: se desvanecen las capas de color
          capas.forEach((c) => { c.style.opacity = '0'; setTimeout(() => c.remove(), 550); });
          return;
        }
        const nueva = baseTeja.cloneNode(true);
        nueva.classList.add('icono__capa');
        nueva.style.viewTransitionName = 'none';
        nueva.style.opacity = '0';
        $('source[type="image/avif"]', nueva).srcset = fuentes[inp.value].avif;
        $('source[type="image/webp"]', nueva).srcset = fuentes[inp.value].webp;
        const img = $('img', nueva);
        img.removeAttribute('fetchpriority'); img.loading = 'eager';
        img.alt = `Teja Ondulada Perfil 7 de fibrocemento en color ${inp.dataset.nombre.toLowerCase()}`;
        (capas.at(-1) || baseTeja).after(nueva);
        const mostrar = () => requestAnimationFrame(() => {
          nueva.style.opacity = '1';
          setTimeout(() => capas.forEach((c) => c.remove()), 550);
        });
        img.decode().then(mostrar, mostrar);
      });
    });
  }

  /* ---------- Producto: esquema de referencias ---------- */
  const app = $('[data-refs]');
  const refs = app ? JSON.parse(app.dataset.refs) : [];
  const dec = (n) => ((String(n).split('.')[1] || '').length > 2 ? 3 : 2);
  if (app) {
    const esquema = $('.esquema', app);
    const correas = $('[data-e="correas"]', app);
    const poner = (k, html) => { const el = $(`[data-e="${k}"]`, app); if (el) el.innerHTML = html; };
    const pintar = (no) => {
      const r = refs.find((x) => x.no === +no);
      esquema.style.setProperty('--l', r.largo);
      esquema.style.setProperty('--luz', r.luces[0]);
      let pos = 0.07;
      const xs = [pos, ...r.luces.map((l) => (pos += l))];
      correas.innerHTML = xs.map((x) => `<i style="--x:${x}"></i>`).join('');
      poner('largo', `${fmt(r.largo)} m`);
      poner('luces', r.luces.length > 1 ? `Luces ${r.luces.map((l) => fmt(l, dec(l))).join(' + ')} m` : `Luz ${fmt(r.luces[0])} m`);
      poner('largo2', `${fmt(r.largo)}<small>m</small>`);
      poner('util', `${fmt(r.util)}<small>m</small>`);
      poner('area', `${fmt(r.areaUtil)}<small>m²</small>`);
      poner('peso', `${fmt(r.peso)}<small>kg</small>`);
    };
    $$('input[name="ref"]', app).forEach((i) => i.addEventListener('change', () => pintar(i.value)));
    pintar($('input[name="ref"]:checked', app).value);
  }

  /* ---------- Producto: calculadora de techo ---------- */
  const calc = $('[data-calc]');
  if (calc && refs.length) {
    const ANCHO = 0.92, ANCHO_UTIL = 0.873, DESPERDICIO = 1.05;
    const salida = (k) => $(`[data-c="${k}"]`);
    const disponibles = refs.filter((r) => !r.pedido);
    const calcular = () => {
      const f = new FormData(calc);
      const aguas = +f.get('aguas'), frente = +f.get('frente'), fondo = +f.get('fondo'), alero = Math.max(0, +f.get('alero') || 0), pend = +f.get('pendiente');
      const rad = (pend * Math.PI) / 180;
      salida('pend').textContent = `${pend}° · ${Math.round(Math.tan(rad) * 100)} %`;
      if (!(frente > 0 && fondo > 0)) return;
      const largoFrente = frente + 2 * alero;
      const caida = (aguas === 2 ? fondo / 2 + alero : fondo + 2 * alero) / Math.cos(rad);
      const porHilada = Math.max(1, Math.ceil((largoFrente - ANCHO) / ANCHO_UTIL - 1e-9) + 1);
      const evaluar = (r) => {
        const hiladas = caida <= r.largo ? 1 : Math.ceil((caida - r.largo) / r.util - 1e-9) + 1;
        return { r, hiladas, sobra: r.largo + (hiladas - 1) * r.util - caida, tejas: hiladas * porHilada * aguas };
      };
      // Referencia elegida por el cliente (por defecto la No. 8)
      const o = evaluar(disponibles.find((r) => r.no === +f.get('ref')) || disponibles.find((r) => r.no === 8) || disponibles[0]);
      const tejas = Math.ceil(o.tejas * DESPERDICIO);
      salida('tejas').textContent = tejas.toLocaleString('es-CO');
      salida('refTxt').textContent = `Perfil 7 No. ${o.r.no} · ${fmt(o.r.largo)} m`;
      salida('area').textContent = `${fmt(largoFrente * caida * aguas, 1)} m²`;
      salida('matriz').textContent = `${o.hiladas} × ${porHilada}${aguas === 2 ? ' × 2 aguas' : ''}`;
      salida('tornillos').textContent = (tejas * 2).toLocaleString('es-CO');
      salida('caballetes').textContent = aguas === 2 ? `${porHilada}` : 'No aplica';
      salida('correas').textContent = `${o.hiladas * o.r.luces.length + 1} · luz ${fmt(o.r.luces[0], dec(o.r.luces[0]))} m`;
      salida('peso').textContent = `${Math.round(tejas * o.r.peso).toLocaleString('es-CO')} kg`;
    };
    calc.addEventListener('input', calcular);
    calcular();
  }

  /* ---------- Producto: «Escucha el aguacero» (Web Audio) ----------
     Las gotas se sintetizan en lluvia-sintesis.js (se carga al pulsar): cada gota es un impacto que hace vibrar
     la cubierta. El mismo aguacero suena a la vez sobre los dos techos y el selector funde uno con otro, así la
     comparación es justa: solo cambia el techo. */
  const lluvia = $('[data-lluvia]');
  if (lluvia) {
    const boton = $('[data-lluvia-play]', lluvia), texto = $('[data-lluvia-txt]', lluvia);
    const barras = $$('.vumetro i', lluvia);
    const material = () => $('input[name="techo"]:checked', lluvia).value;
    let ctx, maestro, analizador, techos, listo, cuadro, pausa, sonando = false;
    const preparar = async () => {
      const { fabricarLluvia } = await import('./lluvia-sintesis.js');
      await new Promise((r) => setTimeout(r, 30)); // deja pintar «Preparando lluvia…»
      const audio = fabricarLluvia(ctx.sampleRate);
      maestro = ctx.createGain(); maestro.gain.value = 0;
      const limitador = ctx.createDynamicsCompressor();
      limitador.threshold.value = -4; limitador.knee.value = 2; limitador.ratio.value = 12; limitador.attack.value = 0.002; limitador.release.value = 0.15;
      analizador = ctx.createAnalyser(); analizador.fftSize = 64; analizador.smoothingTimeConstant = 0.7;
      maestro.connect(limitador); limitador.connect(analizador); analizador.connect(ctx.destination);
      techos = {};
      const inicio = ctx.currentTime + 0.05;
      for (const [techo, [izq, der]] of Object.entries(audio)) {
        const buf = ctx.createBuffer(2, izq.length, ctx.sampleRate);
        buf.copyToChannel(izq, 0); buf.copyToChannel(der, 1);
        const fuente = ctx.createBufferSource(); fuente.buffer = buf; fuente.loop = true;
        const g = ctx.createGain(); g.gain.value = techo === material() ? 1 : 0;
        fuente.connect(g); g.connect(maestro); fuente.start(inicio);
        techos[techo] = g;
      }
    };
    const ajustar = () => {
      const m = material();
      lluvia.dataset.techo = m;
      lluvia.style.setProperty('--intensidad', m === 'metal' ? 1 : 0.65);
      if (!techos) return;
      const t = ctx.currentTime;
      for (const [techo, g] of Object.entries(techos)) g.gain.setTargetAtTime(techo === m ? 1 : 0, t, 0.12);
      maestro.gain.setTargetAtTime(sonando ? 1.4 : 0, t, sonando ? 0.15 : 0.06);
    };
    const medir = () => {
      const datos = new Uint8Array(analizador.frequencyBinCount);
      analizador.getByteFrequencyData(datos);
      barras.forEach((b, i) => b.style.setProperty('--v', (datos[i + 1] || 0) / 255));
      cuadro = requestAnimationFrame(medir);
    };
    const alternar = async (encender) => {
      if (encender && !ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)(); // dentro del clic: el navegador permite sonar
        boton.disabled = true; texto.textContent = 'Preparando lluvia…';
        try { listo = listo || preparar(); await listo; } catch (e) { listo = null; ctx = null; boton.disabled = false; texto.textContent = 'Reproducir lluvia'; return; }
        boton.disabled = false;
      }
      sonando = encender;
      lluvia.classList.toggle('sonando', sonando);
      boton.setAttribute('aria-pressed', sonando);
      texto.textContent = sonando ? 'Pausar lluvia' : 'Reproducir lluvia';
      cancelAnimationFrame(cuadro); clearTimeout(pausa);
      if (sonando) { ctx.resume(); medir(); }
      else {
        barras.forEach((b) => b.style.setProperty('--v', 0));
        if (ctx) pausa = setTimeout(() => { if (!sonando) ctx.suspend(); }, 500); // ahorra batería en pausa
      }
      ajustar();
    };
    boton.addEventListener('click', () => alternar(!sonando));
    $$('input[name="techo"]', lluvia).forEach((i) => i.addEventListener('change', ajustar));
    visible(lluvia, (si) => { if (!si && sonando) alternar(false); });
    ajustar();
  }

  /* ---------- Producto: subnavegación activa ---------- */
  const subnav = $('[data-subnav]');
  if (subnav) {
    const enlaces = $$('a', subnav), lista = $('ul', subnav);
    // Solo se desplaza la lista del menú. scrollIntoView movía también la página (el menú es
    // sticky y queda dentro del scroll-padding superior) y la devolvía mientras el usuario bajaba.
    const centrar = (a) => {
      if (!a || lista.scrollWidth <= lista.clientWidth) return;
      const caja = lista.getBoundingClientRect(), r = a.getBoundingClientRect();
      lista.scrollBy({ left: r.left + r.width / 2 - (caja.left + caja.width / 2), behavior: reduce ? 'auto' : 'smooth' });
    };
    const obs = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      enlaces.forEach((a) => a.setAttribute('aria-current', a.hash === `#${e.target.id}`));
      centrar($(`a[href="#${e.target.id}"]`, subnav));
    }), { rootMargin: '-45% 0px -50% 0px' });
    enlaces.forEach((a) => { const s = $(a.hash); if (s) obs.observe(s); });
  }

  /* ---------- Campos numéricos: la rueda del mouse mueve la página, no el valor ---------- */
  document.addEventListener('wheel', (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type === 'number' && t === document.activeElement) t.blur();
  }, { passive: true });

  /* ---------- Categoría: filtros y búsqueda con View Transitions ---------- */
  const barra = $('[data-filtro-barra]');
  if (barra) {
    const botones = $$('[data-filtro]', barra), campo = $('[data-buscar]', barra);
    const grupos = $$('[data-grupo]'), vacio = $('[data-vacio]');
    let filtro = 'todos';
    const aplicar = () => {
      const q = norm(campo.value.trim());
      let total = 0;
      grupos.forEach((g) => {
        let n = 0;
        $$('.tarjeta', g).forEach((t) => {
          const ok = (filtro === 'todos' || t.dataset.sub === filtro) && (!q || norm(t.dataset.nombre).includes(q));
          t.hidden = !ok; if (ok) n++;
        });
        g.hidden = n === 0; total += n;
      });
      vacio.hidden = total > 0;
      const conteo = $('[data-conteo]');
      if (conteo) conteo.textContent = $$('.tarjeta:not([data-extra])').filter((t) => !t.hidden).length;
    };
    const transicion = (fn) => {
      if (!document.startViewTransition || reduce) return fn();
      const tarjetas = $$('.tarjeta');
      tarjetas.forEach((t, i) => { t.style.viewTransitionName = `t${i}`; });
      const vt = document.startViewTransition(fn);
      vt.ready.catch(() => {});
      vt.finished.catch(() => {}).finally(() => tarjetas.forEach((t) => { t.style.viewTransitionName = ''; }));
    };
    botones.forEach((b) => b.addEventListener('click', () => {
      filtro = b.dataset.filtro;
      botones.forEach((x) => x.setAttribute('aria-pressed', x === b));
      transicion(aplicar);
      const cat = $('[data-catalogo]');
      if (cat.getBoundingClientRect().top < 0) cat.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    }));
    campo.addEventListener('input', aplicar);
    const orden = $('[data-orden]', barra);
    orden?.addEventListener('change', () => transicion(() => {
      const v = orden.value;
      $$('.grilla', $('[data-catalogo]')).forEach((g) => {
        const items = $$(':scope > .tarjeta', g).sort((a, b) => {
          if (a.hasAttribute('data-extra')) return 1;
          if (b.hasAttribute('data-extra')) return -1;
          if (v === 'destacados') return a.dataset.orden - b.dataset.orden;
          const r = a.dataset.nombre.localeCompare(b.dataset.nombre, 'es');
          return v === 'za' ? -r : r;
        });
        g.append(...items);
      });
    }));
  }

  /* ---------- Agua: litros de reserva ---------- */
  const litros = $('[data-litros]');
  if (litros) {
    const TANQUES = [[250, 'el tanque de 250 litros (o el Mini, si falta altura)'], [500, 'el tanque de 500 litros'], [750, 'el tanque tipo botella de 750 litros'], [1000, 'el tanque de 1.000 litros'], [1100, 'el tanque tipo botella de 1.100 litros'], [2000, 'el tanque de 2.000 litros'], [6000, 'el tanque de 6.000 litros']];
    const val = (n) => +$(`[name="${n}"]`, litros).value;
    const poner = (k, v) => { $(`[data-l="${k}"]`, litros).textContent = v; };
    const calcular = () => {
      const personas = val('personas'), dias = val('dias'), consumo = val('consumo') || 100;
      const necesita = personas * dias * consumo;
      const t = TANQUES.find(([c]) => c >= necesita);
      poner('personasTxt', personas); poner('diasTxt', dias);
      poner('litros', `${necesita.toLocaleString('es-CO')} L`);
      poner('reco', t ? `Te sirve ${t[1]}.` : 'Necesitas más de 6.000 litros: combina tanques o habla con un asesor.');
      $('[data-l="nivel"]', litros).style.setProperty('--nivel', `${Math.min(100, (necesita / (t ? t[0] : 6000)) * 100)}%`);
    };
    litros.addEventListener('input', calcular);
    calcular();
  }

  /* ---------- Producto: el color elegido se ve junto a las referencias ---------- */
  $$('input[name="color"]').forEach((inp) => inp.addEventListener('change', () => { const o = $('[data-compra-color]'); if (o) o.textContent = inp.dataset.nombre; }));

  /* ---------- Portal de distribuidores (prototipo: no lee ni envía credenciales) ---------- */
  const CLAVE_PORTAL = 'eternit-portal';
  const accesoForm = $('[data-acceso]');
  accesoForm?.addEventListener('submit', (e) => {
    e.preventDefault(); // los campos no tienen «name»: no viajan a ningún lado y aquí no se leen
    try { sessionStorage.setItem(CLAVE_PORTAL, 'demo'); } catch (er) { /* sin almacenamiento */ }
    location.href = accesoForm.action;
  });
  // Ver u ocultar la contraseña: el botón dice qué va a hacer y anuncia su estado
  $$('[data-ver-clave]').forEach((b) => b.addEventListener('click', () => {
    const campo = document.getElementById(b.getAttribute('aria-controls'));
    const ver = campo.type === 'password';
    campo.type = ver ? 'text' : 'password';
    b.setAttribute('aria-pressed', String(ver));
    b.textContent = ver ? 'Ocultar' : 'Mostrar';
  }));
  const portalEl = $('[data-portal]');
  if (portalEl) {
    const puerta = $('[data-portal-puerta]');
    let dentro = true;
    try { dentro = sessionStorage.getItem(CLAVE_PORTAL) === 'demo'; } catch (e) { /* sin almacenamiento: se muestra */ }
    const entrar = () => { try { sessionStorage.setItem(CLAVE_PORTAL, 'demo'); } catch (e) { /* sin almacenamiento */ } puerta.hidden = true; };
    if (!dentro && puerta) {
      puerta.hidden = false;
      $('[data-portal-demo]', puerta)?.focus();
      puerta.addEventListener('keydown', (e) => { if (e.key === 'Escape') entrar(); });
    }
    $('[data-portal-demo]')?.addEventListener('click', entrar);
    $$('[data-portal-salir]').forEach((a) => a.addEventListener('click', () => { try { sessionStorage.removeItem(CLAVE_PORTAL); } catch (e) { /* sin almacenamiento */ } }));
    // Menú de la cuenta (cabecera del portal): se cierra al tocar fuera o con Escape
    const cuenta = $('[data-portal-cuenta]');
    if (cuenta) {
      document.addEventListener('click', (e) => { if (cuenta.open && !cuenta.contains(e.target)) cuenta.open = false; });
      cuenta.addEventListener('keydown', (e) => { if (e.key === 'Escape') { cuenta.open = false; $('summary', cuenta).focus(); } });
      $$('a', cuenta).forEach((a) => a.addEventListener('click', () => { cuenta.open = false; }));
    }
    const enlaces = $$('[data-portal-nav] a');
    const obs = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) enlaces.forEach((a) => a.setAttribute('aria-current', String(a.hash === `#${e.target.id}`)));
    }), { rootMargin: '-30% 0px -65% 0px' });
    // Solo las anclas de esta misma página: el enlace al visualizador no tiene ancla (querySelector('') fallaría)
    const anclas = enlaces.filter((a) => a.hash && a.pathname === location.pathname && $(a.hash));
    anclas.forEach((a) => obs.observe($(a.hash)));
    // La última sección es corta y nunca llega a la franja que se observa: al final de la página, se resalta ella
    if (anclas.length) addEventListener('scroll', () => {
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) enlaces.forEach((a) => a.setAttribute('aria-current', String(a === anclas.at(-1))));
    }, { passive: true });
    $$('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copiar);
        b.classList.add('copiado'); b.textContent = 'Copiado';
        setTimeout(() => { b.classList.remove('copiado'); b.textContent = b.dataset.copiar; }, 1400);
      } catch (e) { /* sin portapapeles */ }
    }));
    $$('[data-demo-archivo]').forEach((b) => b.addEventListener('click', () => avisar('Archivo de ejemplo: en producción se descarga del gestor de documentos.')));
    const buscarDocs = $('[data-docs-buscar]');
    if (buscarDocs) {
      const filas = $$('[data-docs-filas] tr'), vacio = $('[data-docs-vacio]');
      buscarDocs.addEventListener('input', () => {
        const q = norm(buscarDocs.value.trim());
        let n = 0;
        filas.forEach((f) => { const ok = !q || norm(f.dataset.texto).includes(q); f.hidden = !ok; if (ok) n++; });
        vacio.hidden = n > 0;
      });
      // El buscador de la cabecera del portal filtra los documentos y lleva a «Fichas y certificados»
      // (desde otras páginas del portal llega como ?q=…)
      const buscarEnDocs = (q) => {
        buscarDocs.value = q;
        buscarDocs.dispatchEvent(new Event('input'));
        $('#documentos')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
      };
      $('[data-portal-buscar]')?.addEventListener('submit', (e) => { e.preventDefault(); buscarEnDocs($('input', e.currentTarget).value); });
      const qDocs = new URLSearchParams(location.search).get('q');
      if (qDocs) { const campoCab = $('#portal-buscar'); if (campoCab) campoCab.value = qDocs; buscarEnDocs(qDocs.slice(0, 80)); }
    }
  }

  /* ---------- WebMCP: la ficha P7 como herramienta para agentes de IA del navegador ----------
     Requiere el origin trial de WebMCP (Chrome 149+). Sin soporte, no hace nada. */
  if (refs.length && document.modelContext?.registerTool) {
    const ficha = (no) => refs.find((r) => r.no === +no);
    document.modelContext.registerTool({
      name: 'consultar_referencia_teja_p7',
      description: 'Devuelve medidas, área útil, peso y luz entre correas de una referencia de la Teja Ondulada Perfil 7 de Eternit (No. 3, 4, 5, 6, 8 o 10; el número es el largo en pies).',
      inputSchema: { type: 'object', properties: { numero: { type: 'integer', enum: refs.map((r) => r.no) } }, required: ['numero'] },
      annotations: { readOnlyHint: true },
      execute: async ({ numero }) => {
        const r = ficha(numero);
        return `Teja Perfil 7 No. ${r.no}: largo ${fmt(r.largo)} m, largo útil ${fmt(r.util)} m, ancho 0,92 m (útil 0,873 m), área útil ${fmt(r.areaUtil)} m², peso ${fmt(r.peso)} kg, luz entre correas ${r.luces.join(' + ')} m. Fuente: ficha técnica Eternit, oct. 2023.`;
      },
    });
    if (calc) document.modelContext.registerTool({
      name: 'calcular_tejas_p7',
      description: 'Calcula cuántas tejas Perfil 7 de Eternit, tornillos y caballetes necesita un techo a una o dos aguas, con 5 % de desperdicio. Cálculo orientativo.',
      inputSchema: {
        type: 'object',
        properties: {
          aguas: { type: 'integer', enum: [1, 2] },
          frente: { type: 'number', description: 'Largo del alero en metros' },
          fondo: { type: 'number', description: 'Profundidad en planta en metros' },
          pendiente: { type: 'integer', minimum: 15, maximum: 35, description: 'Grados' },
          alero: { type: 'number', description: 'Voladizo por lado en metros' },
        },
        required: ['frente', 'fondo'],
      },
      annotations: { readOnlyHint: true },
      execute: async ({ aguas = 2, frente, fondo, pendiente = 20, alero = 0.3 }) => {
        Object.entries({ aguas, frente, fondo, pendiente, alero, ref: 'auto' }).forEach(([k, v]) => {
          const el = calc.elements[k];
          if (el instanceof RadioNodeList) el.value = String(v); else if (el) el.value = v;
        });
        calc.dispatchEvent(new Event('input'));
        const t = (k) => $(`[data-c="${k}"]`).textContent;
        return `${t('tejas')} tejas (${t('refTxt')}), ${t('tornillos')} tornillos, caballetes: ${t('caballetes')}, área ${t('area')}, peso ${t('peso')}. Incluye 5 % de desperdicio; confirmar con un asesor.`;
      },
    });
  }
})();
