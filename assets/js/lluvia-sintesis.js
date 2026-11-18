// Síntesis de un aguacero sobre dos techos (módulo ES; lo carga eternit.js al pulsar «Reproducir lluvia»).
//
// Modelo: un mismo aguacero —las mismas gotas, en el mismo orden— cae sobre dos cubiertas.
// · Cada gota es un impacto: un clic de ruido brevísimo que excita los modos de vibración de la cubierta.
// · Lámina metálica (delgada, rígida, poco amortiguada): el golpe es seco y brillante («tac»), con modos agudos e
//   inarmónicos entre 0,9 y 8 kHz que se apagan en milésimas; las gotas grandes además hacen retumbar la lámina
//   como un tambor (150–420 Hz). Debajo suena un siseo brillante continuo y un retumbe grave que sube con las
//   ráfagas: el «tamborileo» que no deja hablar.
// · Fibrocemento (más masa y amortiguamiento): el mismo impacto llega sordo y corto, sin agudos; queda un rumor
//   grave y suave.
// Se calculan unos segundos de audio estéreo por techo y la página los repite sin costura (fundido al cerrar).
// Es una simulación ilustrativa, no una medición acústica.

// Generador pseudoaleatorio con semilla (mulberry32): el aguacero suena igual cada vez.
const azarCon = (semilla) => () => {
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Filtro biquad (recetario RBJ) aplicado en el lugar sobre un Float32Array.
function biquad(x, tipo, f0, q, sr, db = 0) {
  const w = (2 * Math.PI * f0) / sr, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q), A = 10 ** (db / 40);
  let b0, b1, b2, a0, a1, a2;
  if (tipo === 'lowpass') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (tipo === 'highpass') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (tipo === 'bandpass') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else { b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; } // peaking
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i], y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}

// Ruido rosa (filtro de Paul Kellet) y ruido café (integrado con fuga).
function ruido(n, azar, color) {
  const x = new Float32Array(n);
  if (color === 'cafe') {
    let y = 0;
    for (let i = 0; i < n; i++) { y = 0.996 * y + (azar() * 2 - 1) * 0.06; x[i] = y; }
    return x;
  }
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = azar() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return x;
}

// Impacto de una gota sobre la cubierta: clic de excitación + modos de vibración amortiguados.
function impacto(sr, techo, clase, azar) {
  const metal = techo === 'metal';
  const dur = metal ? { chica: 0.04, media: 0.09, grande: 0.2 }[clase] : { chica: 0.022, media: 0.04, grande: 0.07 }[clase];
  const n = Math.round(dur * sr), k = new Float32Array(n);
  const tauClic = metal ? 0.0005 : 0.0016;
  for (let i = 0; i < n; i++) k[i] = (azar() * 2 - 1) * Math.exp(-i / sr / tauClic) * (metal ? 1 : 0.8);
  if (!metal) biquad(k, 'lowpass', 900 + azar() * 500, 0.7, sr); // el fibrocemento se traga los agudos
  const modos = [];
  if (metal) {
    const cuantos = clase === 'chica' ? 6 : 11;
    for (let m = 0; m < cuantos; m++) {
      const f = 900 * 9 ** azar(); // 0,9–8,1 kHz, inarmónicos
      const tau = (clase === 'chica' ? 0.0015 : 0.004) + azar() * (clase === 'grande' ? 0.03 : clase === 'media' ? 0.014 : 0.006) * Math.sqrt(2500 / f);
      modos.push({ f, tau, a: (0.2 + 0.8 * azar()) * 0.32 });
    }
    if (clase !== 'chica') modos.push({ f: 150 + azar() * 270, tau: 0.03 + azar() * 0.05, a: clase === 'grande' ? 0.5 : 0.15 }); // la lámina retumba
  } else {
    modos.push({ f: 170 + azar() * 300, tau: 0.004 + azar() * (clase === 'grande' ? 0.01 : 0.005), a: clase === 'chica' ? 0.3 : 0.6 });
  }
  for (const m of modos) {
    const caida = Math.exp(-1 / (sr * m.tau)), w = (2 * Math.PI * m.f) / sr, fase = azar() * 2 * Math.PI;
    let e = m.a;
    for (let i = 0; i < n && e > 1e-4; i++) { k[i] += e * Math.sin(w * i + fase); e *= caida; }
  }
  const borde = Math.min(n, Math.round(0.003 * sr)); // sin chasquido digital al final
  for (let i = 0; i < borde; i++) k[n - 1 - i] *= i / borde;
  return k;
}

// Devuelve { metal: [izq, der], fibro: [izq, der] } (Float32Array de `seg` segundos que se repiten sin costura).
export function fabricarLluvia(sr, { seg = 8, gotasPorSegundo = 600 } = {}) {
  const n = Math.round(seg * sr), cruce = Math.round(0.6 * sr), total = n + cruce;
  // Ráfagas: la intensidad sube y baja; es periódica en el bucle para que no se note la vuelta.
  const rafaga = (t) => 1 + 0.25 * Math.sin((2 * Math.PI * t) / seg + 1.3) + 0.12 * Math.sin((4 * Math.PI * t) / seg + 0.4);
  const azar = azarCon(1942);
  const gotas = [];
  for (let t = 0; t < total / sr;) {
    t += -Math.log(1 - azar()) / (gotasPorSegundo * rafaga(t));
    const u = azar();
    gotas.push({ i: Math.round(t * sr), clase: u < 0.02 ? 'grande' : u < 0.2 ? 'media' : 'chica', v: azar(), a: azar(), p: azar() * 1.8 - 0.9 });
  }
  const salida = {};
  for (const techo of ['metal', 'fibro']) {
    const metal = techo === 'metal';
    const L = new Float32Array(total), R = new Float32Array(total);
    const azarT = azarCon(metal ? 7 : 11);
    const banco = {};
    for (const c of ['chica', 'media', 'grande']) banco[c] = Array.from({ length: 12 }, () => impacto(sr, techo, c, azarT));
    for (const g of gotas) {
      const k = banco[g.clase][Math.floor(g.v * 12)];
      // La mayoría de gotas suenan suaves y unas pocas sobresalen: de ahí el crepitar.
      const base = { chica: 0.42, media: 0.45, grande: 0.45 }[g.clase] * (metal ? 1 : 0.3);
      const amp = base * (0.04 + 0.96 * g.a ** 3.5);
      const ang = ((g.p + 1) * Math.PI) / 4, gl = Math.cos(ang) * amp, gr = Math.sin(ang) * amp;
      const fin = Math.min(k.length, total - g.i);
      for (let j = 0; j < fin; j++) { L[g.i + j] += k[j] * gl; R[g.i + j] += k[j] * gr; }
    }
    // Rumor de fondo: miles de gotas finas y salpicadura (canales decorrelacionados), con las mismas ráfagas.
    const capas = metal
      ? [['rosa', [['highpass', 550, 0.7], ['peaking', 3500, 0.8, 6]], 0.12], // siseo brillante sobre la lámina
        ['rosa', [['highpass', 6000, 0.7]], 0.08], // chisporroteo fino
        ['cafe', [['bandpass', 130, 1.2], ['lowpass', 350, 0.7]], 0.15]] // la lámina retumba como un tambor
      : [['rosa', [['lowpass', 850, 0.7], ['highpass', 140, 0.7]], 0.28], // rumor sordo
        ['cafe', [['bandpass', 110, 1.2]], 0.07]];
    capas.forEach(([color, filtros, nivel], c) => {
      for (const [canal, sem] of [[L, 101 + c * 2], [R, 102 + c * 2]]) {
        const x = ruido(total, azarCon(sem + (metal ? 0 : 50)), color);
        for (const [tipo, f, q, db] of filtros) biquad(x, tipo, f, q, sr, db);
        for (let i = 0; i < total; i++) canal[i] += x[i] * nivel * rafaga(i / sr);
      }
    });
    // Costura del bucle: el final se funde sobre el principio (potencia constante, ruido sin correlación).
    for (let i = 0; i < cruce; i++) {
      const w = Math.sin((Math.PI / 2) * (i / cruce)), c = Math.cos((Math.PI / 2) * (i / cruce));
      L[i] = L[i] * w + L[n + i] * c; R[i] = R[i] * w + R[n + i] * c;
    }
    salida[techo] = [L.subarray(0, n), R.subarray(0, n)];
  }
  // Mismo factor para los dos techos: se conserva la diferencia real de nivel entre ellos.
  let pico = 0;
  for (const canales of Object.values(salida)) for (const x of canales) for (let i = 0; i < x.length; i++) pico = Math.max(pico, Math.abs(x[i]));
  const k = 0.95 / pico;
  for (const canales of Object.values(salida)) for (const x of canales) for (let i = 0; i < x.length; i++) x[i] *= k;
  return salida;
}
