/* Ficha del tanque de agua Eternit.
   · Cabecera: el selector de capacidad cambia la foto, la ficha del tanque elegido y el enlace «Dónde comprar».
   · Medidas: el mismo tanque dibujado a escala junto a una persona de 1,70 m (los dibujos vienen en el HTML).
   · Calculadora: personas × días × litros por persona → tanque (o combinación), cuánto dura, peso lleno, medidas,
     alto con tapa y base mínima. Respeta la forma elegida y el límite de altura.
   · «?capacidad=1000» en el enlace llega con ese tanque elegido (lo usan las tarjetas de la línea de agua). */
(() => {
  const fuente = document.getElementById('tanque-datos');
  if (!fuente) return;
  const D = JSON.parse(fuente.textContent);
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const porId = Object.fromEntries(D.refs.map((r) => [r.id, r]));
  const n = (v, d = 0) => v.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
  const kg = (v) => v.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  const mt = (mm) => n(mm / 1000, 2);
  const ancho = (r) => r.D ?? r.A, alto = (r) => r.H ?? r.B;
  const altoTotal = (r) => alto(r) + r.H1;
  const base = (r) => (r.forma === 'conico' ? r.D2 : r.A); // la ficha: más grande que la tapa (cónicos) o que el fondo (botella)
  const wa = (texto) => `${D.wa}?text=${encodeURIComponent(texto)}`;
  const nombreCorto = (r) => r.titulo.replace(/^Tanque /, '');
  const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Nivel del agua en un dibujo ---------- */
  // Fracción de volumen → alto del agua. En los cónicos se resuelve el volumen del tronco de cono; en los tipo
  // botella se aproxima con el cuerpo cilíndrico (el agua llega a los hombros).
  const altoAgua = (r, f) => {
    if (r.forma !== 'conico') return Math.min(1, f) * r.B * 0.9;
    const R0 = r.D1 / 2, R1 = r.D / 2, H = r.H;
    const v = (h) => { const rh = R0 + ((R1 - R0) * h) / H; return h * (R0 * R0 + R0 * rh + rh * rh); };
    const meta = Math.min(1, f) * v(H);
    let lo = 0, hi = H;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (v(mid) < meta) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };
  const llenar = (svg, r, f) => {
    const agua = $('.tqd__agua', svg);
    if (!agua) return;
    const suelo = +svg.dataset.suelo, h = altoAgua(r, f);
    agua.setAttribute('y', suelo - h);
    agua.setAttribute('height', h);
  };

  /* ---------- Tanque elegido: cabecera y medidas sincronizadas ---------- */
  const hero = $('[data-tq-hero]'), escena = hero && $('.ph__escena', hero), medidas = $('[data-tq-medidas]');
  const poner = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };
  const precargadas = new Set();
  const precargar = (id) => {
    if (precargadas.has(id) || !D.fotos[id]) return;
    precargadas.add(id);
    const i = new Image(); i.sizes = '(min-width: 1000px) 46vw, 100vw'; i.srcset = D.fotos[id].webp;
  };
  const cambiarFoto = (r, animar) => {
    const actual = $$('.img', escena).at(-1);
    if (!actual || actual.dataset.tanque === r.id) return;
    const nueva = actual.cloneNode(true);
    nueva.dataset.tanque = r.id;
    nueva.style.viewTransitionName = 'none';
    nueva.style.opacity = animar ? '0' : '1';
    $('source[type="image/avif"]', nueva).srcset = D.fotos[r.id].avif;
    $('source[type="image/webp"]', nueva).srcset = D.fotos[r.id].webp;
    const img = $('img', nueva);
    img.removeAttribute('fetchpriority');
    img.alt = `${r.titulo} de Eternit`;
    actual.after(nueva);
    const mostrar = () => requestAnimationFrame(() => {
      nueva.style.opacity = '1';
      setTimeout(() => $$('.img', escena).forEach((el) => el !== nueva && el.remove()), animar ? 700 : 0);
    });
    img.decode().then(mostrar, mostrar);
  };
  const elegir = (id, { animar = true, url = true } = {}) => {
    const r = porId[id];
    if (!r) return;
    $$('input[name="capacidad"], input[name="tq-medida"]').forEach((i) => { i.checked = i.value === id; });
    if (escena) cambiarFoto(r, animar && !reducir);
    poner('[data-tq="chapa"]', `${n(r.litros)} L`);
    poner('[data-tq="nombre"]', nombreCorto(r));
    poner('[data-tq="titulo"]', r.titulo);
    poner('[data-tq="medida"]', `Ø ${mt(ancho(r))} m · ${mt(alto(r))} m de alto`);
    poner('[data-tq="peso"]', `${kg(r.peso)} kg vacío · ${kg(r.peso + r.litros)} kg lleno`);
    const nota = $('[data-tq="nota"]');
    if (nota) { nota.textContent = r.nota || ''; nota.hidden = !r.nota; }
    const comprar = $('[data-tq="comprar"]');
    if (comprar) comprar.href = wa(`Hola Eternit, ¿dónde consigo el ${r.titulo.replace(/^Tanque/, 'tanque')} cerca de mí?`);
    if (medidas) {
      $$('[data-tq-dibujo]', medidas).forEach((d) => { d.hidden = d.dataset.tqDibujo !== id; });
      poner('[data-tm="ancho"]', `${mt(ancho(r))}<small>m</small>`);
      poner('[data-tm="alto"]', `${mt(alto(r))}<small>m</small>`);
      poner('[data-tm="peso"]', `${kg(r.peso)}<small>kg</small>`);
      poner('[data-tm="lleno"]', `${kg(r.peso + r.litros)}<small>kg</small>`);
      poner('[data-tm="nota"]', `Tapa Ø ${mt(r.D2)} m × ${mt(r.H1)} m · base de apoyo de al menos Ø ${mt(base(r))} m${r.arrume ? ` · ${r.arrume} tanques por arrume en el camión` : ''}${r.id === '6000' ? ' · lleno pesa más de 6 toneladas: va preferiblemente a nivel del suelo' : ''}`);
    }
    if (url) {
      const u = new URL(location.href);
      u.searchParams.set('capacidad', id);
      history.replaceState(history.state, '', u);
    }
  };
  $$('input[name="capacidad"], input[name="tq-medida"]').forEach((i) => {
    i.parentElement.addEventListener('pointerenter', () => precargar(i.value));
    i.addEventListener('focus', () => precargar(i.value));
    i.addEventListener('change', () => elegir(i.value));
  });
  const pedido = new URLSearchParams(location.search).get('capacidad');
  if (porId[pedido]) elegir(pedido, { animar: false, url: false });

  /* ---------- Calculadora ---------- */
  const form = $('[data-tq-calc]');
  if (!form) return;
  const salida = (k) => $(`[data-tc="${k}"]`);
  let principal = porId[D.porDefecto];
  const calcular = () => {
    const personas = +form.personas.value, dias = +form.dias.value;
    const consumo = Math.min(400, Math.max(30, +form.consumo.value || 100));
    const forma = form.forma.value;
    const altura = parseFloat(String(form.altura.value).replace(',', '.'));
    salida('personasTxt').textContent = personas;
    salida('diasTxt').textContent = dias;
    const necesita = personas * dias * consumo;
    salida('litros').textContent = n(necesita);

    let cands = D.refs.filter((r) => forma === 'todas' || r.forma === forma);
    if (altura > 0) cands = cands.filter((r) => altoTotal(r) <= altura * 1000);
    const detalles = $$('.calc__lista > div, .tq-calc__dibujo, .calc__acciones', form.closest('.tq-calc'));
    if (!cands.length) {
      const bajo = D.refs.filter((r) => forma === 'todas' || r.forma === forma).sort((a, b) => altoTotal(a) - altoTotal(b))[0];
      salida('reco').textContent = `Ningún tanque ${forma === 'botella' ? 'tipo botella ' : ''}cabe en ${n(altura, 2)} m de alto con la tapa. El más bajo es el ${nombreCorto(bajo)}: ${mt(altoTotal(bajo))} m con tapa.`;
      detalles.forEach((el) => { el.hidden = true; });
      return;
    }
    detalles.forEach((el) => { el.hidden = false; });
    // Mismo volumen: primero el 250 normal y no el Mini (el Mini se elige cuando la altura lo pide)
    const orden = [...cands].sort((a, b) => a.litros - b.litros || (a.id === '250-mini') - (b.id === '250-mini'));
    let plan = [orden.find((r) => r.litros >= necesita)].filter(Boolean);
    if (!plan.length) { // Más de lo que cabe en uno: el más grande las veces necesarias y el que cubra lo que falte
      const mayor = orden.at(-1);
      let falta = necesita;
      while (falta > mayor.litros) { plan.push(mayor); falta -= mayor.litros; }
      plan.push(orden.find((r) => r.litros >= falta) || mayor);
    }
    const capacidad = plan.reduce((s, r) => s + r.litros, 0);
    principal = plan.reduce((a, b) => (b.litros > a.litros ? b : a));
    // Map y no objeto: las claves numéricas («6000») se ordenarían de menor a mayor; así va primero el más grande
    const grupos = [...plan.reduce((g, r) => { if (!g.has(r.id)) g.set(r.id, { r, k: 0 }); g.get(r.id).k++; return g; }, new Map()).values()];
    const texto = (g) => (g.k > 1 ? `${g.k} ${g.r.titulo.replace(/^Tanque/, 'tanques')}` : `el ${g.r.titulo.replace(/^Tanque/, 'tanque')}`);
    const reco = plan.length === 1
      ? `Te sirve ${texto(grupos[0])}.`
      : `No cabe en un solo tanque${altura > 0 ? ' con esa altura' : ''}: te sirven ${grupos.map(texto).join(' y ').replace(/^el /, '1 ').replace(/ y el /, ' y 1 ')} (${n(capacidad)} L en total).`;
    salida('reco').textContent = reco;
    const consumoDia = personas * consumo;
    salida('diario').textContent = `${n(consumoDia)} L`;
    salida('dura').textContent = `${n(capacidad / consumoDia, 1)} días`;
    salida('peso').textContent = `${n(plan.reduce((s, r) => s + r.peso + r.litros, 0))} kg${plan.length > 1 ? ' entre todos' : ''}`;
    salida('medidas').textContent = `Ø ${mt(ancho(principal))} × ${mt(alto(principal))} m${plan.length > 1 ? ` (el de ${n(principal.litros)} L)` : ''}`;
    salida('alto').textContent = `${mt(altoTotal(principal))} m`;
    salida('base').textContent = `Ø ${mt(base(principal))} m${principal.id === '6000' ? ' · a nivel del suelo' : ''}`;
    // Dibujo: el tanque principal con el agua que necesitas
    $$('[data-tc-dibujo]').forEach((d) => { d.hidden = d.dataset.tcDibujo !== principal.id; });
    const svg = $(`[data-tc-dibujo="${principal.id}"] svg`);
    if (svg) llenar(svg, principal, plan.length === 1 ? necesita / capacidad : 1);
    const veces = salida('veces');
    veces.hidden = plan.length < 2;
    veces.textContent = `${plan.length} tanques`;
    salida('ver').textContent = `Ver el de ${n(principal.litros)} L a escala`;
    salida('comprar').href = wa(`Hola Eternit, para ${personas} ${personas === 1 ? 'persona' : 'personas'} y ${dias} ${dias === 1 ? 'día' : 'días'} de reserva necesito unos ${n(necesita)} litros. ${reco} ¿Dónde lo consigo cerca de mí?`);
  };
  form.addEventListener('input', calcular);
  form.addEventListener('change', calcular);
  salida('ver').addEventListener('click', () => elegir(principal.id));
  calcular();
})();
