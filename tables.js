// tables.js — generators for all 13 docx tables; buildTables(V) -> { id: string[][] }
const { f, fN, fi } = require('./templates');
const MIN = '\u2212';
const sg = (x, d) => {                       // signed: "+1,2" / "−1,2" / "0"
  if (Math.round(Math.abs(x) * 10 ** d) === 0) return '0';
  return (x < 0 ? MIN : '+') + f(Math.abs(x), d);
};
const fm = (x, d) => f(x, d).replace('-', MIN);   // unsigned with real minus
const fiG = x => {                           // integer, regular-space grouping ≥5 digits
  let s = Math.round(Math.abs(x)).toString();
  if (s.length >= 5) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (x < 0 ? MIN : '') + s;
};
const hu2 = x => Math.round(x * 100 + 1e-6) / 100;   // half-up at the 2nd decimal

const CAT = require('./catalog.json');
const rp = CAT.reductoare_RP.find(r => r.tip === 'RP-060');
const sb = CAT.suruburi_SB.find(s => s.tip === 'ȘB 16×16');
const curea32 = CAT.curele_AT10.find(c => c.tip === 'AT10-32');

function buildTables(V) {
  const inp = V.inp, D = V.D, Y = V.axY, X = V.axX;
  const kZ = V.kinZ, kY = V.kinY, kX = V.kinX;
  const mZ = V.motZ, mY = V.motY, mX = V.motX;
  const T = {};
  const M4 = '\u207B\u2074', SUP2 = '\u00B2', SUP6 = '\u2076';

  // ---------- T21 fișa individuală (id 21) ----------
  T[21] = [
    ['Mărimea', 'Simbol', 'Valoarea'],
    ['masa piesei', 'mp', `${fN(inp.mp)} kg`],
    ['masa prehensorului', 'mg', `${fN(inp.mg)} kg`],
    ['Axa X — cursa / timpul mișcării', 'SX / tX', `${fN(inp.SX)} m / ${fN(inp.tX)} s`],
    ['masa căruciorului X (cu grinda Y)', 'mX', `${fN(inp.mX)} kg`],
    ['transmisia axei X', '—', 'curea dințată (CD) cu reductor'],
    ['rezistența constantă pe axa X', 'F0X', `${fN(inp.F0X)} N`],
    ['Axa Y — cursa / timpul mișcării', 'SY / tY', `${fN(inp.SY)} m / ${fN(inp.tY)} s`],
    ['masa căruciorului Y', 'mY', `${fN(inp.mY)} kg`],
    ['transmisia axei Y', '—', 'curea dințată (CD) cu reductor'],
    ['rezistența constantă pe axa Y', 'F0Y', `${fN(inp.F0Y)} N`],
    ['Axa Z — cursa / timpul mișcării', 'hZ / tZ', `${fN(inp.hZ)} m / ${fN(inp.tZ)} s`],
    ['masa saniei verticale', 'mZ', `${fN(inp.mZ)} kg`],
    ['gradul de echilibrare', 'α', `${fN(inp.alpha)} (${inp.alpha === 1 ? 'echilibrare completă' : 'contragreutate parțială'})`],
    ['transmisia axei Z', '—', 'șurub cu bile (ȘB)'],
    ['rezistența constantă pe axa Z', 'F0Z', `${fN(inp.F0Z)} N`],
    ['coeficientul de frecare al ghidajelor', 'μ', fN(inp.mu)],
    ['pauza de prindere / eliberare', 'tp', `${fN(inp.tp)} s`],
    ['accelerația admisă la prehensor', 'aadm', `${fN(inp.aadm)} m/s${SUP2}`],
    ['repetabilitatea de poziționare la prehensor', '±Δs', `±${fN(inp.ds)} mm`],
    ['durata de viață cerută transmisiilor', 'Lh', `${fiG(inp.Lh)} h`],
    ['temperatura maximă a mediului', 'Tamb', `${fN(inp.Tamb)} °C`],
    ['alimentarea', '—', '3 × 400 V, 50 Hz'],
    ['tipul acționării', '—', 'servomotoare MSMP cu servoconvertoare'],
  ];

  // ---------- T33 stivuirea axelor (id 33) ----------
  T[33] = [
    ['Axa', 'Mișcarea', 'Cursa', 'Transmisia', 'Masele în mișcare'],
    ['Z', 'translație verticală', `${fN(inp.hZ)} m`, `șurub cu bile + contragreutate (α = ${fN(inp.alpha)})`,
      `sanie (${fN(inp.mZ)} kg) + prehensor (${fN(inp.mg)} kg) + piesă (${fN(inp.mp)} kg) + contragreutate`],
    ['Y', 'translație transversală', `${fN(inp.SY)} m`, 'curea dințată + reductor planetar', `căruciorul Y (${fN(inp.mY)} kg) + axa Z completă`],
    ['X', 'translație longitudinală', `${fN(inp.SX)} m`, 'curea dințată + reductor planetar', `căruciorul X cu grinda (${fN(inp.mX)} kg) + axele Y și Z`],
  ];

  // ---------- T99 cinematica (id 99) ----------
  const kinRow = (ax, S, t, k) => [ax, f(S, 1), fN(t), f(t / 3, 3), f(k.vmax, 3), f(k.a, 2), f(k.tmin, 2), '✓'];
  T[99] = [['Axa', 'S [m]', 't [s]', 'ta [s]', 'vmax [m/s]', 'a [m/s²]', 'tmin [s]', 'a ≤ aadm'],
    kinRow('Z', inp.hZ, inp.tZ, kZ), kinRow('Y', inp.SY, inp.tY, kY), kinRow('X', inp.SX, inp.tX, kX)];

  // ---------- T188 forțele axei Z (id 188) ----------
  const FZrows = [];
  const movZ = [['coborâre gol', 'cob_gol'], ['ridicare cu piesă', 'rid_piesa'], ['coborâre cu piesă', 'cob_piesa'], ['ridicare gol', 'rid_gol']];
  const sFGZ = { cob_gol: -V.FG_gol, rid_piesa: +V.FG_piesa, cob_piesa: -V.FG_piesa, rid_gol: +V.FG_gol };
  for (const [name, key] of movZ) {
    const Fdin = key === 'cob_gol' || key === 'rid_gol' ? V.FdinZ_gol : V.FdinZ_piesa;
    [['accelerare', 'acc'], ['mers uniform', 'mu'], ['frânare', 'frn']].forEach(([por, suf], j) => {
      const F = V.F_Z[`${key}_${suf}`];
      FZrows.push([j === 0 ? name : '', por, sg(sFGZ[key], 1), fN(inp.F0Z),
        j === 1 ? '0' : sg(j === 0 ? +Fdin : -Fdin, 1), sg(F, 1)]);
    });
  }
  T[188] = [['Mișcarea', 'Porțiunea', 'sFG [N]', 'Ff [N]', '±Fdin [N]', 'F [N]'], ...FZrows];

  // ---------- T199 forțele axelor Y și X (id 199) ----------
  const FHrows = [];
  for (const [ax, F, Ff_p, Ff_g, Fd_p, Fd_g] of [
    ['Y', V.F_Y, V.FfY_piesa, V.FfY_gol, V.FdinY_piesa, V.FdinY_gol],
    ['X', V.F_X, V.FfX_piesa, V.FfX_gol, V.FdinX_piesa, V.FdinX_gol]]) {
    [['deplasare cu piesă', 'dus', Ff_p, Fd_p], ['întoarcere gol', 'int', Ff_g, Fd_g]].forEach(([mv, suf, Ff, Fdin], j) => {
      [['accelerare', 'acc'], ['mers uniform', 'mu'], ['frânare', 'frn']].forEach(([por, s2], q) => {
        const Fv = F[`${suf}_${s2}`];
        const g0 = j === 0 && q === 0;            // start of the axis block
        FHrows.push([g0 ? ax : '', q === 0 ? mv : '', por, f(Math.abs(Ff), 1),
          q === 1 ? '0' : sg(q === 0 ? +Fdin : -Fdin, 1), sg(Fv, 1)]);
      });
    });
  }
  T[199] = [['Axa', 'Mișcarea', 'Porțiunea', 'Ff [N]', '±Fdin [N]', 'F [N]'], ...FHrows];

  // ---------- T279 / T360 roțile dințate (ids 279, 360) ----------
  const wheelRows = (vmax, useVmax4, A) => {
    const rows = [];
    for (const z of [20, 25, 32, 40]) {
      const dp = z * 10 / Math.PI;                 // mm
      if (A && z === A.z_ales) {                   // adopted wheel: the adopted reductor ratio
        rows.push([String(z), f(dp, 1), f(A.nr, 1), String(A.i), fi(A.nmot), f(A.rred * 1000, 3)]);
        continue;
      }
      const vmaxv = useVmax4 ? Number(vmax.toFixed(4)) : vmax;
      const nr = 60 * vmaxv / (Math.PI * dp / 1000);
      const i = nr * 12 <= 2850 ? 12 : 7;          // (Indrumar tabel A.3: i = 7, 12)
      const nmot = Math.round(nr * i);
      const rred = dp / 2 / i;
      rows.push([String(z), f(dp, 1), f(nr, 1), String(i), fi(nmot), z === 20 ? f(rred, 2) : f(rred, 3)]);
    }
    return rows;
  };
  const wheelHdr = ['z', 'dp [mm]', 'nr [rot/min]', 'i', 'nmot [rot/min]', 'rred [mm]'];
  T[279] = [wheelHdr, ...wheelRows(kY.vmax, true, Y)];
  T[360] = [wheelHdr, ...wheelRows(kX.vmax, false, X)];

  // ---------- T453 inerțiile (id 453) ----------
  const fmtJsum = x => { const s = f(x, 2); return /,00$/.test(s) ? s.replace(/,00$/, '') : s; };
  T[453] = [
    ['Axa', 'rred [mm]', 'Jr (+ Jfr)', 'Jred', '(Jtr + Jc)/i²', `m rtr${SUP2}/i${SUP2}  (cu piesă)`, 'Jext', 'JΣ', 'εmot  [rad/s²]', 'Ωmot  [rad/s]'],
    ['Z', f(V.rred_Z * 1000, 3), `${f(mZ['Jr_1e-4'], 2)} + ${f(mZ['Jfr_1e-4'], 2)} = ${f(mZ['Jr_1e-4'] + mZ['Jfr_1e-4'], 2)}`, '—',
      f(hu2((V.Js + V.Jc) / 1e-4), 2), f(V.mr2_Z_piesa / 1e-4, 2), f(V.Jext_Z / 1e-4, 2), fmtJsum(D.JS_Z / 1e-4), fi(V.eps_Z), `${f(V.Omega_Z, 0)}  (${fi(V.ns)} rot/min)`],
    ['Y', f(Y.rred * 1000, 3), f(mY['Jr_1e-4'], 2), fN(rp['J2_1e-4']),
      f(hu2(Y.Jtr_plus_Jc_i2 / 1e-4), 2), f(Y.mr2_i2_piesa / 1e-4, 2), f(V.Jext_Y / 1e-4, 2), fmtJsum(D.JS_Y / 1e-4), fi(V.eps_Y), `${f(V.Omega_Y, 0)}  (${fi(Y.nmot)} rot/min)`],
    ['X', f(X.rred * 1000, 3), f(mX['Jr_1e-4'], 2), fN(rp['J2_1e-4']),
      f(hu2(X.Jtr_plus_Jc_i2 / 1e-4), 2), f(X.mr2_i2_piesa / 1e-4, 2), f(V.Jext_X / 1e-4, 2), fmtJsum(D.JS_X / 1e-4), fi(V.eps_X), `${f(V.Omega_X, 0)}  (${fi(X.nmot)} rot/min)`],
  ];

  // ---------- T480 diagrama de sarcină Z (id 480) ----------
  const rows480 = [];
  const namesZ = ['coborâre gol', 'ridicare cu piesă', 'coborâre cu piesă', 'ridicare gol'];
  D.Z.forEach((r, i) => {
    const first = i % 3 === 0 ? namesZ[i / 3 | 0] : '';
    const por = ['accelerare', 'mers uniform', 'frânare'][i % 3];
    rows480.push([first, por, sg(r.F, 1), sg(r.MF, 3), sg(r.MJ, 3), sg(r.M, 3)]);
  });
  rows480.push([`menținere cu piesă (${fN(V.thold_p)} s)`, '—', sg(V.FG_piesa, 1), sg(D.Mhold_p, 3), '0', sg(D.Mhold_p, 3)]);
  rows480.push([`menținere gol (${fN(V.thold_g)} s)`, '—', sg(V.FG_gol, 1), sg(D.Mhold_g, 3), '0', sg(D.Mhold_g, 3)]);
  T[480] = [['Mișcarea', 'Porțiunea', 'F [N]', 'MF [N·m]', 'MJ [N·m]', 'M [N·m]'], ...rows480];

  // ---------- T513 diagramele Y și X (id 513) ----------
  const rows513 = [];
  for (const [ax, arr] of [['Y', D.Y], ['X', D.X]]) {
    arr.forEach((r, i) => {
      const por = ['accelerare', 'mers uniform', 'frânare'][i % 3];
      const mv = i < 3 ? 'deplasare cu piesă' : 'întoarcere gol';
      rows513.push([i === 0 ? ax : '', i % 3 === 0 ? mv : '', por, sg(r.F, 1), sg(r.MF, 3), sg(r.MJ, 3), sg(r.M, 3)]);
    });
  }
  T[513] = [['Axa', 'Mișcarea', 'Porțiunea', 'F [N]', 'MF [N·m]', 'MJ [N·m]', 'M [N·m]'], ...rows513];

  // ---------- T625 bilanțul puterilor (id 625) ----------
  const bilRow = (ax, m, pv, e, pm, pct) => [ax, m.tip + (ax === 'Z' ? ' + frână' : ''),
    m.PN_kW < 1 ? f(m.PN_kW, 2) : f(m.PN_kW, 1), fi(pv), fi(e), fi(pm), `${fi(pct)} %`];
  T[625] = [
    ['Axa', 'Motor', 'PN [kW]', 'Pvârf la motor [W]', 'energia motoare pe ciclu [J]', 'Pmed [W]', 'Mech/MN'],
    bilRow('Z', mZ, D.Pvarf_Z, D.E_Z, D.Pmed_Z, V.pct_Mech_Z),
    bilRow('Y', mY, D.Pvarf_Y, D.E_Y, D.Pmed_Y, V.pct_Mech_Y),
    bilRow('X', mX, D.Pvarf_X, D.E_X, D.Pmed_X, V.pct_Mech_X),
    ['total', '', f(V.Pinst, 2), '', fi(V.E_tot), fi(V.Pmed_tot), ''],
  ];

  // ---------- T727 lista de aparate (id 727) ----------
  const LX = 2 * (inp.SX + 0.3) + Math.PI * Y.dp / 1000, LY = 2 * (inp.SY + 0.3) + Math.PI * Y.dp / 1000;
  const beltAles = CAT.curele_AT10.find(c => c.tip === V.belt_ales);
  T[727] = [
    ['Poz.', 'Denumire', 'Tip', 'Parametri', 'Buc.'],
    ['1', 'servomotor axa Z, cu frână și encoder absolut', `${mZ.tip} + frână`, `${f(mZ.PN_kW, 2)} kW, ${f(mZ.MN, 2)} N·m, Mfr ${f(mZ.Mfr, 1)} N·m`, '1'],
    ['2', 'servomotor axa Y, cu encoder absolut', mY.tip, `${f(mY.PN_kW, 1)} kW, ${f(mY.MN, 2)} N·m`, '1'],
    ['3', 'servomotor axa X, cu encoder absolut', mX.tip, `${f(mX.PN_kW, 1)} kW, ${f(mX.MN, 2)} N·m`, '1'],
    ['4', 'reductor planetar axele X și Y, joc redus', Y.i === X.i ? `RP-060-R, i = ${Y.i}` : `RP-060-R, i = ${Y.i} (Y), ${X.i} (X)`, `${fi(rp.MN)} / ${fi(rp.Mmax)} N·m, 5 arcmin`, '2'],
    ['5', `roți dințate AT10 z = ${Y.z_ales}, b = ${fi(V.bw * 1000)} mm`, '—', `dp ${f(Y.dp, 1)} mm`, '4'],
    ['6', `curea dințată ${V.belt_ales}, axa X, L ≈ ${f(LX, 1)} m (2 · ${fN(inp.SX + 0.3)} m + π dp)`, V.belt_ales, `Fadm ${fi(beltAles.Fadm)} N`, '1'],
    ['7', `curea dințată ${V.belt_ales}, axa Y, L ≈ ${f(LY, 1)} m (2 · ${fN(inp.SY + 0.3)} m + π dp)`, V.belt_ales, `Fadm ${fi(beltAles.Fadm)} N`, '1'],
    ['8', 'șurub cu bile axa Z, cu piuliță și lagăre', `ȘB 16×16, L = ${fi(V.L_surub * 1000)} mm`, `Ca ${fi(sb.Ca)} N`, '1'],
    ['9', `contragreutate ${fN(V.mcw)} kg cu rolă și cablu`, '—', '—', '1'],
    ['10', 'cuplă elastică cu burduf', '—', '—', '3'],
    ['11', 'modul de rețea cu filtru EMC și chopper de frânare', '3 × 400 V', `${V.modul_retea_kW} kW, rezistor intern ${fi(V.conv_ales.Pbr_W)} W`, '1'],
    ['12', 'modul de axă (servoconvertor)', V.conv_ales.tip, `${fi(V.conv_ales.IN)} / ${fi(V.conv_ales.Imax)} A, EtherCAT, STO`, '3'],
    ['13', 'riglă liniară magnetică axa X (opțiune recomandată)', '5 µm', `${fN(inp.SX)} m`, '1'],
    ['14', 'PLC cu funcții de mișcare, master EtherCAT', '—', '3 axe, ciclu 1 ms', '1'],
    ['15', 'module I/O digitale', '24 V', '16 DI + 16 DO', '1'],
    ['16', 'panou operator HMI', '7″', '—', '1'],
    ['17', 'releu de siguranță', 'PL d, cat. 3', '2 canale', '1'],
    ['18', 'buton de oprire de urgență', '2 NC', '—', '2'],
    ['19', 'scanner laser de siguranță (zona conveiorului) + gard cu ușă interblocată (restul)', '2 câmpuri', '—', '1 + 1'],
    ['20', 'limitator de cursă de siguranță', 'NC', '—', '6'],
    ['21', 'senzor inductiv de referință', 'PNP', '—', '3'],
    ['22', 'prehensor cu vacuum, ejector, senzor de vacuum', '—', `${fN(inp.mp)} kg`, '1'],
    ['23', 'senzor optic „cutie în A”', 'PNP', '—', '1'],
    ['24', 'sursă 24 V c.c.', '5 A', '—', '1'],
    ['25', 'întreruptor automat 3P + diferențial tip B', '16 A, 30 mA', '—', '1 + 1'],
    ['26', 'coloană de semnalizare', '24 V', '—', '1'],
    ['27', 'contactor principal (treapta a doua a opririi de urgență), cu contact auxiliar de diagnoză', '3P, AC-3', '12 A, bobină 24 V c.c.', '1'],
    ['28', 'panou mobil de reglaj cu butoane cu acționare menținută (hold-to-run) și dispozitiv de validare (enabling switch); butoane START/STOP/RESET, comutator de mod cu cheie', '—', '24 V c.c.', '1'],
  ];

  // ---------- T826 anexa — date de catalog (id 826) ----------
  const conv = V.conv_ales;
  T[826] = [
    ['Componenta', 'Date de catalog'],
    [mZ.tip, `${f(mZ.PN_kW, 2)} kW; 3000 rot/min; MN ${f(mZ.MN, 2)} N·m; Mmax ${f(mZ.Mmax, 2)} N·m; IN ${f(mZ.IN, 1)} A; Imax ${f(mZ.Imax, 1)} A; kM ${f(mZ.kM, 2)} N·m/A; Jr ${fN(mZ['Jr_1e-4'])}·10${M4} kg·m${SUP2}; frână ${f(mZ.Mfr, 1)} N·m (Jfr ${fN(mZ['Jfr_1e-4'])}·10${M4})`],
    ...(mX.tip !== mY.tip
      ? [[mX.tip, `${fN(mX.PN_kW)} kW; 3000 rot/min; nmax 4000; MN ${f(mX.MN, 2)} N·m; Mmax ${f(mX.Mmax, 2)} N·m; IN ${f(mX.IN, 1)} A; Imax ${f(mX.Imax, 1)} A; kM ${f(mX.kM, 2)} N·m/A; Jr ${fN(mX['Jr_1e-4'])}·10${M4} kg·m${SUP2}`]]
      : [['SM-06-040', `0,4 kW; MN 1,27 N·m; Jr 0,28·10${M4} kg·m${SUP2}; frână 1,3 N·m (candidat neadoptat)`]]),
    [mY.tip, `1,0 kW; 3000 rot/min; nmax 4500; MN ${f(mY.MN, 2)} N·m; Mmax ${f(mY.Mmax, 2)} N·m; IN ${f(mY.IN, 1)} A; Imax ${f(mY.Imax, 1)} A; kM ${f(mY.kM, 2)} N·m/A; Jr ${fN(mY['Jr_1e-4'])}·10${M4} kg·m${SUP2}; 4,3 kg; flanșă 100 mm`],

    ['RP-060-R', `${Y.i === X.i ? `i = ${Y.i} (2 trepte)` : `i = ${Y.i} (Y), ${X.i} (X) (2 trepte)`}; MN ${fi(rp.MN)} N·m; Mmax ${fi(rp.Mmax)} N·m; J1 ${fN(rp['J1_1e-4'])}·10${M4}; J2 ${fN(rp['J2_1e-4'])}·10${M4} kg·m${SUP2}; η 0,94; joc 10 arcmin (2 trepte, standard), 5 arcmin (varianta cu joc redus); nin,max ${fi(rp.nin_max)}; 1,0 kg`],
    ['ȘB 16×16', `dr ${f(sb.dr, 1)} mm; Ca ${fi(sb.Ca)} N; C0a ${fiG(sb.C0a)} N; J′ ${fN(sb['Jp_1e-4'])}·10${M4} kg·m${SUP2}/m; η 0,93`],
    [V.belt_ales, `b = ${fi(V.bw * 1000)} mm; Fadm ${fi(beltAles.Fadm)} N; csp ${f(beltAles.csp_1e6, 2)}·10${SUP6} N; ${fN(beltAles.mp_kg_m)} kg/m; roți z = ${Y.z_ales}, dp = ${f(Y.dp, 1)} mm (AT10-25: 900 N, 0,62·10${SUP6} N${V.belt_ales === 'AT10-32' ? '; AT10-75: csp 1,9·10' + SUP6 + ' N' : '; AT10-32: 1200 N, 0,80·10' + SUP6 + ' N'})`],
    [conv.tip, `${conv.alim.replace('×', ' × ')}; ${fi(conv.IN)} / ${fi(conv.Imax)} A; ≤ ${fN(conv.Pmotor_max_kW)} kW; chopper intern ${fi(conv.Pbr_W)} W; Rmin ${fi(conv.Rmin_ohm)} Ω; Udc ${fi(conv.Udc)} V; STO; EtherCAT`],
  ];

  return T;
}

module.exports = { buildTables, sg, fm, fiG };
