// compute.js — full calculation chain for the portal robot project (X-Y-Z)
// Mirrors the Îndrumar formulas exactly as used in the variant-20 model document.
// Usage: node compute.js 20   (validation against the document)
//        node compute.js 13   (the user's variant)

const CAT = require('./catalog.json');
const g = CAT.constant.g;

// ---------- helpers ----------
const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;
const r3 = x => Math.round(x * 1000) / 1000;
const r0 = x => Math.round(x);
// Romanian formatting: decimal comma
const fmt = (x, dec) => x.toFixed(dec).replace('.', ',');

function getInputs(v) {
  if (v == 20) return {
    varianta: 20, mp: 12, mg: 4,
    SX: 2.0, tX: 2.6, mX: 80, F0X: 70,
    SY: 1.2, tY: 1.7, mY: 28, F0Y: 35,
    hZ: 0.4, tZ: 0.9, mZ: 22, F0Z: 40,
    alpha: 0.5, mu: 0.01, tp: 0.5, aadm: 3, ds: 0.2, Lh: 20000, Tamb: 25,
    U_retea: 400, // 3×400 V
    trans_X: 'CD', trans_Y: 'CD', trans_Z: 'SB', // curea dințată + reductor; șurub cu bile
  };
  if (v == 13) return {
    varianta: 13, mp: 10, mg: 3,
    SX: 1.8, tX: 2.2, mX: 70, F0X: 60,
    SY: 0.9, tY: 1.3, mY: 22, F0Y: 30,
    hZ: 0.35, tZ: 0.8, mZ: 18, F0Z: 35,
    alpha: 0.5, mu: 0.01, tp: 0.5, aadm: 4, ds: 0.15, Lh: 20000, Tamb: 25,
    U_retea: 400,
    trans_X: 'CD', trans_Y: 'CD', trans_Z: 'SB',
  };
  if (v == 12) return {
    varianta: 12, mp: 30, mg: 8,
    SX: 2.5, tX: 3.5, mX: 120, F0X: 100,
    SY: 1, tY: 1.8, mY: 45, F0Y: 50,
    hZ: 0.6, tZ: 1.4, mZ: 40, F0Z: 70,
    alpha: 1, mu: 0.01, tp: 0.8, aadm: 2, ds: 0.5, Lh: 25000, Tamb: 25,
    U_retea: 400,
    trans_X: 'CD', trans_Y: 'CD', trans_Z: 'SB',
  };
  // fallback: data-driven variants stored in variants.json
  try {
    const store = require('fs').readFileSync(require('path').join(__dirname, 'variants.json'), 'utf8');
    const data = JSON.parse(store);
    if (data && data[v]) return data[v];
  } catch (e) {}
  if (v == 14) return {"varianta":14,"mp":15,"mg":5,"SX":2,"tX":2.4,"mX":90,"F0X":80,"SY":1,"tY":1.6,"mY":30,"F0Y":40,"hZ":0.5,"tZ":1.1,"mZ":28,"F0Z":55,"alpha":0.5,"mu":0.01,"tp":0.6,"aadm":3,"ds":0.2,"Lh":22000,"Tamb":25,"U_retea":400,"trans_X":"CD","trans_Y":"CD","trans_Z":"SB"};
  throw new Error('unknown variant');
}

function compute(inp) {
  const V = {}; // all computed values, named after the document
  V.inp = inp;

  // ---------- §1.2 cycle ----------
  V.Tc = 4 * inp.tZ + 2 * Math.max(inp.tX, inp.tY) + 2 * inp.tp;         // 9,8 / 8,9
  V.N_cicluri = 3600 / V.Tc;                                              // 367 / ~404
  V.thold_p = Math.max(inp.tX, inp.tY) + inp.tp;
  V.thold_g = V.thold_p;
  V.sum_check = 4 * inp.tZ + 2 * V.thold_p;                               // == Tc

  // ---------- §1.4 kinematics per axis (trapezoid, equal thirds) ----------
  const kin = (S, t) => ({
    ta: t / 3,
    vmax: 3 * S / (2 * t),
    a: 9 * S / (2 * t * t),
    tmin: Math.sqrt(9 * S / (2 * inp.aadm)),
  });
  V.kinZ = kin(inp.hZ, inp.tZ);
  V.kinY = kin(inp.SY, inp.tY);
  V.kinX = kin(inp.SX, inp.tX);
  V.a_rez = Math.sqrt(V.kinX.a ** 2 + V.kinY.a ** 2);                     // resultant X-Y

  // ---------- §2.1 masses ----------
  V.mmort = inp.mZ + inp.mg;                        // dead mass on Z
  V.mcw = inp.alpha * V.mmort;                      // counterweight
  V.mSZ_gol = inp.mZ + inp.mg + V.mcw;
  V.mSZ_piesa = inp.mZ + inp.mg + inp.mp + V.mcw;
  V.mSY_gol = inp.mY + V.mSZ_gol;
  V.mSY_piesa = inp.mY + V.mSZ_piesa;
  V.mSX_gol = inp.mX + V.mSY_gol;
  V.mSX_piesa = inp.mX + V.mSY_piesa;
  V.pct_cw_X = 100 * V.mcw / V.mSX_piesa;           // counterweight share of X mass
  V.pct_cw_Y = 100 * V.mcw / V.mSY_piesa;

  // ---------- §2.2 statics ----------
  V.FG_piesa = (V.mmort + inp.mp - V.mcw) * g;
  V.FG_gol = (V.mmort + 0 - V.mcw) * g;
  V.FG_fara_cw = (V.mmort + inp.mp - 0) * g;
  V.FfY_gol = inp.mu * V.mSY_gol * g + inp.F0Y;
  V.FfY_piesa = inp.mu * V.mSY_piesa * g + inp.F0Y;
  V.FfX_gol = inp.mu * V.mSX_gol * g + inp.F0X;
  V.FfX_piesa = inp.mu * V.mSX_piesa * g + inp.F0X;
  V.Ff_ghidaj_Y_gol = inp.mu * V.mSY_gol * g;   // guide friction component (for prose 6–16 N)
  V.Ff_ghidaj_Y_piesa = inp.mu * V.mSY_piesa * g;
  V.Ff_ghidaj_X_gol = inp.mu * V.mSX_gol * g;
  V.Ff_ghidaj_X_piesa = inp.mu * V.mSX_piesa * g;

  // ---------- §2.3 dynamics ----------
  V.FdinZ_gol = V.mSZ_gol * V.kinZ.a;
  V.FdinZ_piesa = V.mSZ_piesa * V.kinZ.a;
  V.FdinY_gol = V.mSY_gol * V.kinY.a;
  V.FdinY_piesa = V.mSY_piesa * V.kinY.a;
  V.FdinX_gol = V.mSX_gol * V.kinX.a;
  V.FdinX_piesa = V.mSX_piesa * V.kinX.a;

  // phases Z (s=+1 up, -1 down): F = s·FG + Ff ± Fdin
  const phZ = (s, FG, Fdin, acc) => s * FG + inp.F0Z + (acc ? Fdin : -Fdin);
  V.F_Z = {
    cob_gol_acc: phZ(-1, V.FG_gol, V.FdinZ_gol, true),
    cob_gol_mu: -V.FG_gol + inp.F0Z,
    cob_gol_frn: phZ(-1, V.FG_gol, V.FdinZ_gol, false),
    rid_piesa_acc: phZ(+1, V.FG_piesa, V.FdinZ_piesa, true),
    rid_piesa_mu: V.FG_piesa + inp.F0Z,
    rid_piesa_frn: phZ(+1, V.FG_piesa, V.FdinZ_piesa, false),
    cob_piesa_acc: phZ(-1, V.FG_piesa, V.FdinZ_piesa, true),
    cob_piesa_mu: -V.FG_piesa + inp.F0Z,
    cob_piesa_frn: phZ(-1, V.FG_piesa, V.FdinZ_piesa, false),
    rid_gol_acc: phZ(+1, V.FG_gol, V.FdinZ_gol, true),
    rid_gol_mu: V.FG_gol + inp.F0Z,
    rid_gol_frn: phZ(+1, V.FG_gol, V.FdinZ_gol, false),
  };
  V.Fmax_Z = V.F_Z.rid_piesa_acc;
  const phH = (Ff, Fdin, acc, back) => back ? -Ff - (acc ? Fdin : -Fdin) : Ff + (acc ? Fdin : -Fdin);
  V.F_Y = {
    dus_acc: phH(V.FfY_piesa, V.FdinY_piesa, true),
    dus_mu: V.FfY_piesa,
    dus_frn: phH(V.FfY_piesa, V.FdinY_piesa, false),
    int_acc: phH(V.FfY_gol, V.FdinY_gol, true),
    int_mu: V.FfY_gol,
    int_frn: phH(V.FfY_gol, V.FdinY_gol, false),
  };
  V.Fmax_Y = V.F_Y.dus_acc;
  V.F_X = {
    dus_acc: phH(V.FfX_piesa, V.FdinX_piesa, true),
    dus_mu: V.FfX_piesa,
    dus_frn: phH(V.FfX_piesa, V.FdinX_piesa, false),
    int_acc: phH(V.FfX_gol, V.FdinX_gol, true),
    int_mu: V.FfX_gol,
    int_frn: phH(V.FfX_gol, V.FdinX_gol, false),
  };
  V.Fmax_X = V.F_X.dus_acc;

  // ---------- §2.4.1 axis Z: ball screw ----------
  const nN_familie = 3000;                    // SM family rated speed (A.1)
  V.n_lim = 0.95 * nN_familie;                // 2850 rot/min
  // pitch candidates from catalog (unique pitches, smallest first)
  const pitches = [...new Set(CAT.suruburi_SB.map(s => s.P))].sort((a, b) => a - b);
  V.ns_candidates = pitches.map(P => ({ P, ns: 60 * V.kinZ.vmax / (P / 1000) }));
  // choose smallest pitch whose ns <= limit; screw = catalog entry with that pitch (unique per pitch at d0=16)
  const P_ales = pitches.find(P => 60 * V.kinZ.vmax / (P / 1000) <= V.n_lim);
  V.surub = CAT.suruburi_SB.find(s => s.P === P_ales && s.d0 === 16) || CAT.suruburi_SB.find(s => s.P === P_ales);
  V.ns = 60 * V.kinZ.vmax / (V.surub.P / 1000);
  V.rred_Z = (V.surub.P / 1000) / (2 * Math.PI);           // m
  V.L_surub = inp.hZ + 0.15;                                // m
  V.Lc = inp.hZ + 0.10;                                     // m
  V.Lc_mm = V.Lc * 1000;
  V.d0n = V.surub.d0 * V.ns;                                // mm·rot/min <= 70000
  const fn = 18.9, fk = 20.4;                               // încastrat–rezemat (A.7 doc)
  V.ncr = fn * V.surub.dr / (V.Lc_mm ** 2) * 1e7;
  V.ncr_adm = 0.8 * V.ncr;
  V.Fk = fk * (V.surub.dr ** 4) / (V.Lc_mm ** 2) * 1e4;
  V.Fk_adm = 0.5 * V.Fk;
  V.C0a_adm = V.surub.C0a / 2;
  // average speed on cycle (12 portions of tZ/3, 4 moves; holds contribute 0)
  V.ti_Z = inp.tZ / 3;
  const n_rampa = V.ns / 2;
  V.nm_Z = (4 * (n_rampa + V.ns + n_rampa) * V.ti_Z) / V.Tc;
  // cubic mean load from the 12 Z-portions (|F|, same n per portion type)
  const Zrows = [
    V.F_Z.cob_gol_acc, V.F_Z.cob_gol_mu, V.F_Z.cob_gol_frn,
    V.F_Z.rid_piesa_acc, V.F_Z.rid_piesa_mu, V.F_Z.rid_piesa_frn,
    V.F_Z.cob_piesa_acc, V.F_Z.cob_piesa_mu, V.F_Z.cob_piesa_frn,
    V.F_Z.rid_gol_acc, V.F_Z.rid_gol_mu, V.F_Z.rid_gol_frn,
  ];
  const ns_portiuni = [n_rampa, V.ns, n_rampa]; // per move: acc, uniform, dec
  let sumF3 = 0, sumnt = 0;
  Zrows.forEach((F, i) => {
    const n_i = ns_portiuni[i % 3];
    sumF3 += Math.abs(F) ** 3 * n_i * V.ti_Z;
    sumnt += n_i * V.ti_Z;
  });
  V.Fm_Z = Math.cbrt(sumF3 / sumnt);
  V.L10_Z = (V.surub.Ca / V.Fm_Z) ** 3 * 1e6;              // rotations
  V.L10h_Z = V.L10_Z / (60 * V.nm_Z);                       // hours
  V.Js = V.surub['Jp_1e-4'] * 1e-4 * V.L_surub;             // kg·m²
  V.Jc = 0.2e-4;                                            // coupling (Îndrumar §2.6.1)
  V.mr2_Z_piesa = V.mSZ_piesa * V.rred_Z ** 2;
  V.mr2_Z_gol = V.mSZ_gol * V.rred_Z ** 2;

  // ---------- §2.4.2 / §2.4.3 axes Y, X: belt + planetary gearbox ----------
  const eta_c = CAT.constant.eta_curea;                     // 0.96
  const eta_red2 = 0.94;                                    // 2-stage RP
  V.eta_lant = eta_c * eta_red2;                            // 0.902
  const ratios2 = CAT.RP_rapoarte['2_trepte'];              // [12,16,20,...]
  const beltAxis = (kin, S, m_piesa, m_gol, Fmax, Ff_piesa, Ff_gol, F) => {
    const A = {};
    A.vmax4 = Number(kin.vmax.toFixed(4));                  // doc uses 4-dec vmax here
    A.S = S; A.m_piesa = m_piesa;
    // adopted wheel = z with the largest nmot (all catalog ratios)
    let _bestZ = 20, _bestN = 0;
    const _allRatios = [...CAT.RP_rapoarte['1_treapta'], ...CAT.RP_rapoarte['2_trepte']];
    for (const _z of [20, 25, 32, 40]) {
      const _dp = _z * 10 / Math.PI;
      const _nr = 60 * A.vmax4 / (Math.PI * _dp / 1000);
      let _i = _allRatios[0];
      for (const _r of _allRatios) { if (_nr * _r <= V.n_lim) _i = _r; else break; }
      const _nmot = _nr * _i;
      if (_nmot >= _bestN) { _bestN = _nmot; _bestZ = _z; }
    }
    A.z_ales = _bestZ;
    A.dp = A.z_ales * 10 / Math.PI;                         // mm
    A.dp_m = A.dp / 1000;
    A.wheels = CAT.roti_AT10_z.map(z => {
      const dp = z * 10 / Math.PI;                          // mm
      const nr = 60 * A.vmax4 / (Math.PI * dp / 1000);
      // largest ratio keeping nmot <= limit
      const i_ales = [...ratios2].reverse().find(i => nr * i <= V.n_lim) || ratios2[0];
      return { z, dp, nr, i: i_ales, nmot: nr * i_ales, rred: dp / 2 / i_ales };
    });
    A.nr = 60 * A.vmax4 / (Math.PI * A.dp_m);
    A.nr_full = 60 * kin.vmax / (Math.PI * A.dp_m);
    // adopted reductor ratio: largest catalog ratio with nr·i <= n_lim (RP-060 2-stage)
    const allRatiosAdopt = [...CAT.RP_rapoarte['1_treapta'], ...CAT.RP_rapoarte['2_trepte']];
    A.i = allRatiosAdopt[0];
    for (const _r of allRatiosAdopt) { if (A.nr * _r <= V.n_lim) A.i = _r; else break; }
    A.i_next = allRatiosAdopt[allRatiosAdopt.indexOf(A.i) + 1] ?? null;   // next larger ratio (for the limit check)
    A.nmot = A.nr * A.i;
    A.nmot_i16 = A.nr * 16;
    A.rred = A.dp_m / 2 / A.i;                              // m
    A.i_adoptat_ok = A.nmot <= V.n_lim && (A.i_next === null || A.nr * A.i_next > V.n_lim);
    // gearbox checks
    A.Mout_peak = Fmax * (A.dp_m / 2) / eta_c;
    A.Mout_peak_12 = 1.2 * A.Mout_peak;
    const Mout_of = (Fv) => Fv > 0 ? Fv * (A.dp_m / 2) / eta_c : Fv * (A.dp_m / 2) * eta_c;
    A.Mout_faze = [F.dus_acc, F.dus_mu, F.dus_frn, F.int_acc, F.int_mu, F.int_frn].map(Mout_of);
    const ti = { Y: inp.tY / 3, X: inp.tX / 3 }[axisName];
    A.ti = ti;
    A.Mout_ech = Math.sqrt(A.Mout_faze.reduce((s, M) => s + M * M, 0) * ti / V.Tc);
    // backlash at carriage (10' standard, 5' -R)
    A.ds_joc_std = 10 / 60 * Math.PI / 180 * (A.dp / 2);
    A.ds_joc_R = 5 / 60 * Math.PI / 180 * (A.dp / 2);
    // belt: force condition then rigidity at mid-course
    A.F_belt_min = 1.3 * Fmax;
    A.L_mij = (S + 0.3) / 2;
    const beltCalc = (csp_1e6, m) => {
      const c_mid = csp_1e6 * 1e6 * (1 / A.L_mij + 1 / A.L_mij);
      const fe_mid = Math.sqrt(c_mid / m) / (2 * Math.PI);
      return { c_mid, fe_mid };
    };
    A.belt = {};
    for (const b of CAT.curele_AT10) A.belt[b.tip] = { ...beltCalc(b.csp_1e6, m_piesa), Fadm: b.Fadm, csp: b.csp_1e6, mp: b.mp_kg_m, b: b.b_mm };
    // end-of-course (32 mm belt) for the stiffest check
    const csp32 = 0.80e6;
    A.c_capat = csp32 * (1 / 0.15 + 1 / (S + 0.15));
    A.fe_capat = Math.sqrt(A.c_capat / m_piesa) / (2 * Math.PI);
    // inertia at wheel shaft
    A.mr = CAT.constant.rho_otel * Math.PI * (A.dp_m / 2) ** 2 * 0.032;   // steel wheel, b=32
    A.Jroti = A.mr * (A.dp_m / 2) ** 2;                                    // 2 × ½ m r² = m r²
    A.mcurea = 2 * (S + 0.3) * 0.14;
    A.Jcurea = A.mcurea * (A.dp_m / 2) ** 2;
    A.mr2_piesa = m_piesa * (A.dp_m / 2) ** 2;
    A.mr2_gol = m_gol * (A.dp_m / 2) ** 2;
    A.Jtr_plus_Jc_i2 = (A.Jroti + A.Jcurea + V.Jc) / (A.i ** 2);
    A.mr2_i2_piesa = A.mr2_piesa / (A.i ** 2);
    A.mr2_i2_gol = A.mr2_gol / (A.i ** 2);
    return A;
  };
  var axisName = 'Y';
  V.axY = beltAxis(V.kinY, inp.SY, V.mSY_piesa, V.mSY_gol, V.Fmax_Y, V.FfY_piesa, V.FfY_gol, V.F_Y);
  axisName = 'X';
  V.axX = beltAxis(V.kinX, inp.SX, V.mSX_piesa, V.mSX_gol, V.Fmax_X, V.FfX_piesa, V.FfX_gol, V.F_X);

  // unified belt — select the belt with the biggest csp among those with
  // 15 < fe_mid < 30 (and Fadm >= 1.3·Fmax) on X; Y adopts the same belt.
  const acceptableBelts = CAT.curele_AT10.filter(b => {
    const fe = V.axX.belt[b.tip].fe_mid;
    return fe > 15 && fe < 30 && V.axX.belt[b.tip].Fadm >= V.axX.F_belt_min;
  });
  let beltAles;
  if (acceptableBelts.length > 0) {
    beltAles = acceptableBelts.reduce((best, b) =>
      V.axX.belt[b.tip].csp > V.axX.belt[best.tip].csp ? b : best
    ).tip;
  } else {
    // fallback: narrowest belt with fe_mid >= 15 and Fadm >= F_belt_min
    beltAles = (CAT.curele_AT10.find(b => V.axX.belt[b.tip].fe_mid >= 15 && V.axX.belt[b.tip].Fadm >= V.axX.F_belt_min)
       || CAT.curele_AT10[CAT.curele_AT10.length - 1]).tip;
  }
  V.belt_ales = beltAles;
  const beltEntry = CAT.curele_AT10.find(b => b.tip === beltAles);
  for (const A of [V.axY, V.axX]) {
    const b = A.belt[beltAles];
    A.belt_ales = beltAles;
    A.mcurea = 2 * (A.S + 0.3) * b.mp;                      // linear mass of the chosen belt
    A.Jcurea = A.mcurea * (A.dp_m / 2) ** 2;
    A.Jtr_plus_Jc_i2 = (A.Jroti + A.Jcurea + V.Jc) / (A.i ** 2);
    A.c_capat = b.csp * 1e6 * (1 / 0.15 + 1 / (A.S + 0.15)); // end-of-course stiffness with chosen belt
    A.fe_capat = Math.sqrt(A.c_capat / A.m_piesa) / (2 * Math.PI);
  }
  V.mp_belt = beltEntry.mp_kg_m;                            // kg/m of the chosen belt (z=40 what-if)
  V.bw = beltEntry.b_mm / 1000;                             // wheel/belt width, m
  for (const A of [V.axY, V.axX]) {
    // steel wheel width follows the belt width (b = 32 mm for AT10-32, 75 mm for AT10-75)
    A.mr = CAT.constant.rho_otel * Math.PI * (A.dp_m / 2) ** 2 * V.bw;
    A.Jroti = A.mr * (A.dp_m / 2) ** 2;
    A.Jtr_plus_Jc_i2 = (A.Jroti + A.Jcurea + V.Jc) / (A.i ** 2);
  }

  // ---------- §2.5 reduction to motor shaft ----------
  V.eps_Z = V.kinZ.a / V.rred_Z;
  V.eps_Y = V.kinY.a / V.axY.rred;
  V.eps_X = V.kinX.a / V.axX.rred;
  V.Omega_Z = 2 * Math.PI * V.ns / 60;
  V.Omega_Y = 2 * Math.PI * V.axY.nmot / 60;
  V.Omega_X = 2 * Math.PI * V.axX.nmot / 60;

  // Jext per axis (motor-independent part) — used for motor preselection
  V.Jext_Z = V.Js + V.Jc + V.mr2_Z_piesa;                    // i=1 on Z
  V.Jext_Z_gol = V.Js + V.Jc + V.mr2_Z_gol;
  V.Jext_Y = 0.08e-4 + V.axY.Jtr_plus_Jc_i2 + V.axY.mr2_i2_piesa;   // Jred at input (not /i²)
  V.Jext_Y_gol = 0.08e-4 + V.axY.Jtr_plus_Jc_i2 + V.axY.mr2_i2_gol;
  V.Jext_X = 0.08e-4 + V.axX.Jtr_plus_Jc_i2 + V.axX.mr2_i2_piesa;
  V.Jext_X_gol = 0.08e-4 + V.axX.Jtr_plus_Jc_i2 + V.axX.mr2_i2_gol;

  // ---------- §2.6 load diagrams depend on chosen motors → iterate like the document ----------
  // Z axis: phases (12 portions + 2 holds); MF = F·rred/η (motor drives, F>0) or F·rred·η (load drives, F<0)
  const eta_SB = V.surub.eta;
  const MF_Z = F => F > 0 ? F * V.rred_Z / eta_SB : F * V.rred_Z * eta_SB;
  const MF_H = (F, ax) => F > 0 ? F * ax.rred / V.eta_lant : F * ax.rred * V.eta_lant;

  function loadDiagrams(motZ, motY, motX) {
    const D = {};
    // --- Z ---
    const JrotZ = (motZ['Jr_1e-4'] + motZ['Jfr_1e-4']) * 1e-4;   // with brake disc
    const JtransZ = (V.Js + V.Jc);                              // i=1
    D.MJ_Z = (JrotZ + JtransZ) * V.eps_Z;
    const Zfaze = ['cob_gol_acc','cob_gol_mu','cob_gol_frn','rid_piesa_acc','rid_piesa_mu','rid_piesa_frn','cob_piesa_acc','cob_piesa_mu','cob_piesa_frn','rid_gol_acc','rid_gol_mu','rid_gol_frn'];
    D.Z = Zfaze.map(k => { const F = V.F_Z[k]; return { F, MF: MF_Z(F), MJ: k.endsWith('acc') ? +D.MJ_Z : (k.endsWith('frn') ? -D.MJ_Z : 0) }; });
    D.Z.forEach(r => r.M = r.MF + r.MJ);
    D.Mhold_p = MF_Z(V.FG_piesa);          // hold with piece (F>0 → /η)
    D.Mhold_g = MF_Z(V.FG_gol);
    D.Mhold_fara_cw = MF_Z(V.FG_fara_cw);
    // Mech over 14 phases
    const tZ = V.ti_Z;
    D.Mech_Z = Math.sqrt((D.Z.reduce((s, r) => s + r.M ** 2, 0) * tZ + V.thold_p * D.Mhold_p ** 2 + V.thold_g * D.Mhold_g ** 2) / V.Tc);
    D.Mmax_Z = Math.max(...D.Z.map(r => Math.abs(r.M)));
    D.Pvarf_Z = D.Mmax_Z * V.Omega_Z;
    // energies: motor phases M>0 (up with piece, up empty, positive portions of down)
    const Om2 = V.Omega_Z / 2;
    const E_rid = (m1, m2, m3) => m1 * Om2 * tZ + m2 * V.Omega_Z * tZ + m3 * Om2 * tZ;
    D.E_rid_piesa = E_rid(D.Z[3].M, D.Z[4].M, D.Z[5].M);
    D.E_rid_gol = E_rid(D.Z[9].M, D.Z[10].M, D.Z[11].M);
    D.E_cob_poz = D.Z.filter((r, i) => [0, 1, 2, 6, 7, 8].includes(i)).filter(r => r.M > 0)
      .reduce((s2, r) => s2 + r.M * (r.MJ !== 0 ? Om2 : V.Omega_Z) * tZ, 0);
    D.E_Z = D.E_rid_piesa + D.E_rid_gol + D.E_cob_poz;
    D.Pmed_Z = D.E_Z / V.Tc;

    // --- Y ---
    const JrotY = motY['Jr_1e-4'] * 1e-4;
    D.MJ_Y = (JrotY + 0.08e-4 + V.axY.Jtr_plus_Jc_i2) * V.eps_Y;
    const Yfaze = ['dus_acc', 'dus_mu', 'dus_frn', 'int_acc', 'int_mu', 'int_frn'];
    D.Y = Yfaze.map(k => { const F = V.F_Y[k]; return { F, MF: MF_H(F, V.axY), MJ: k.endsWith('acc') ? +D.MJ_Y : (k.endsWith('frn') ? -D.MJ_Y : 0) }; });
    D.Y.forEach(r => r.M = r.MF + r.MJ);
    D.Mech_Y = Math.sqrt(D.Y.reduce((s2, r) => s2 + r.M ** 2, 0) * V.axY.ti / V.Tc);
    D.Mmax_Y = Math.max(...D.Y.map(r => Math.abs(r.M)));
    D.Pvarf_Y = D.Mmax_Y * V.Omega_Y;
    const E_port_Y = D.Y.filter(r => r.M > 0).reduce((s2, r) => s2 + r.M * (r.MJ !== 0 ? V.Omega_Y / 2 : V.Omega_Y) * V.axY.ti, 0);
    D.E_Y = E_port_Y;   // the 6 portions cover dus + întoarcere
    D.Pmed_Y = D.E_Y / V.Tc;

    // --- X ---
    const JrotX = motX['Jr_1e-4'] * 1e-4;
    D.MJ_X = (JrotX + 0.08e-4 + V.axX.Jtr_plus_Jc_i2) * V.eps_X;
    D.X = Yfaze.map(k => { const F = V.F_X[k]; return { F, MF: MF_H(F, V.axX), MJ: k.endsWith('acc') ? +D.MJ_X : (k.endsWith('frn') ? -D.MJ_X : 0) }; });
    D.X.forEach(r => r.M = r.MF + r.MJ);
    D.Mech_X = Math.sqrt(D.X.reduce((s2, r) => s2 + r.M ** 2, 0) * V.axX.ti / V.Tc);
    D.Mmax_X = Math.max(...D.X.map(r => Math.abs(r.M)));
    D.Pvarf_X = D.Mmax_X * V.Omega_X;
    const E_port_X = D.X.filter(r => r.M > 0).reduce((s2, r) => s2 + r.M * (r.MJ !== 0 ? V.Omega_X / 2 : V.Omega_X) * V.axX.ti, 0);
    D.E_X = E_port_X;   // the 6 portions cover dus + întoarcere
    D.Pmed_X = D.E_X / V.Tc;

    // JS with the final motors (tabel 2.5)
    D.JS_Z = JrotZ + JtransZ + V.mr2_Z_piesa;
    D.JS_Z_gol = JrotZ + JtransZ + V.mr2_Z_gol;
    D.JS_Y = JrotY + 0.08e-4 + V.axY.Jtr_plus_Jc_i2 + V.axY.mr2_i2_piesa;
    D.JS_Y_gol = JrotY + 0.08e-4 + V.axY.Jtr_plus_Jc_i2 + V.axY.mr2_i2_gol;
    D.JS_X = JrotX + 0.08e-4 + V.axX.Jtr_plus_Jc_i2 + V.axX.mr2_i2_piesa;
    D.JS_X_gol = JrotX + 0.08e-4 + V.axX.Jtr_plus_Jc_i2 + V.axX.mr2_i2_gol;
    return D;
  }

  // motor selection: document rule — smallest motor passing all 5 checks; inertia ratio <=10 preferred
  const bySize = CAT.motoare_SM;
  const kamb = 1.0; // Tamb <= 40 C
  const selectMotor = (Jext, Mech, Mmax, nmot, needsBrake, Mhold_req) => {
    const cands = [];
    for (const m of bySize) {
      const Jr = m['Jr_1e-4'] * 1e-4;
      const rap = Jext / Jr;
      const brake_ok = !needsBrake || (m.Mfr >= Mhold_req);
      const ok = Mech <= kamb * m.MN && 1.2 * Mmax <= m.Mmax && nmot <= m.nN && rap <= 10 && brake_ok;
      cands.push({ m, rap, ok, brake_ok });
    }
    return cands;
  };
  // full adopt rule — document logic:
  // eligible = passes heating/overload/speed (+brake) and inertia ratio <= 20, excluding SM-10-150 (incomplete data)
  // pick smallest eligible; if its ratio is 10–20, try exactly ONE size up in the full motor list —
  // adopt it only if it is eligible with ratio <= 10; otherwise stay.
  const passAll = (c, Mech, Mmax, nmot) =>
    Mech <= kamb * c.m.MN && 1.2 * Mmax <= c.m.Mmax && nmot <= c.m.nN && c.brake_ok;
  const eligible = (cands, Mech, Mmax, nmot) =>
    cands.map((c, i) => ({ ...c, idx: i })).filter(c => c.m.tip !== 'SM-10-150' && passAll(c, Mech, Mmax, nmot) && c.rap <= 20);
  const pickMotor = (cands, Mech, Mmax, nmot) => {
    const ok = eligible(cands, Mech, Mmax, nmot);
    const first = ok[0];
    if (!first) return null;
    // step up through the FULL list while ratio > 10, adopting the first with rap <= 10
    let cur = first;
    while (cur.rap > 10) {
      const nextIdx = cur.idx + 1;
      const next = cands[nextIdx];
      if (!next || next.m.tip === 'SM-10-150' || !passAll(next, Mech, Mmax, nmot)) break;
      cur = { ...next, idx: nextIdx };
    }
    return cur;
  };

  let motZ = bySize[3];
  for (let it = 0; it < 4; it++) {
    const Dz = loadDiagrams(motZ, bySize[4], bySize[4]);
    const c = selectMotor(V.Jext_Z, Dz.Mech_Z, Dz.Mmax_Z, V.ns, true, 1.5 * Dz.Mhold_p);
    const pick = pickMotor(c, Dz.Mech_Z, Dz.Mmax_Z, V.ns);
    if (!pick) break;
    if (pick.m.tip === motZ.tip) break;
    motZ = pick.m;
  }
  let motY = bySize[4], motX = bySize[4];
  for (let it = 0; it < 4; it++) {
    const Dy = loadDiagrams(motZ, motY, motX);
    const cy = selectMotor(V.Jext_Y, Dy.Mech_Y, Dy.Mmax_Y, V.axY.nmot, false, 0);
    const pickY = pickMotor(cy, Dy.Mech_Y, Dy.Mmax_Y, V.axY.nmot);
    if (pickY) motY = pickY.m;
    const Dx = loadDiagrams(motZ, motY, motX);
    const cx = selectMotor(V.Jext_X, Dx.Mech_X, Dx.Mmax_X, V.axX.nmot, false, 0);
    const pickX = pickMotor(cx, Dx.Mech_X, Dx.Mmax_X, V.axX.nmot);
    if (pickX) motX = pickX.m;
  }
  V.motZ = motZ; V.motY = motY; V.motX = motX;
  V.D = loadDiagrams(motZ, motY, motX);
  V.candZ = selectMotor(V.Jext_Z, V.D.Mech_Z, V.D.Mmax_Z, V.ns, true, 1.5 * V.D.Mhold_p);
  V.candY = selectMotor(V.Jext_Y, V.D.Mech_Y, V.D.Mmax_Y, V.axY.nmot, false, 0);
  V.candX = selectMotor(V.Jext_X, V.D.Mech_X, V.D.Mmax_X, V.axX.nmot, false, 0);

  // ---------- §3.4 power balance ----------
  V.Pinst = V.motZ.PN_kW + V.motY.PN_kW + V.motX.PN_kW;
  V.modul_retea_kW = Math.ceil(V.Pinst);                    // smallest integer-kW network module ≥ Pinst
  V.Pinst_W = V.Pinst * 1000;
  V.E_tot = V.D.E_Z + V.D.E_Y + V.D.E_X;
  V.Pmed_tot = V.E_tot / V.Tc;
  V.I_hold_Z = V.D.Mhold_p / V.motZ.kM;
  V.pct_I_hold = 100 * V.I_hold_Z / V.motZ.IN;
  V.rap_Pinst_Pmed = V.Pinst_W / V.Pmed_tot;
  V.pct_Mech_Z = 100 * V.D.Mech_Z / V.motZ.MN;
  V.pct_Mech_Y = 100 * V.D.Mech_Y / V.motY.MN;
  V.pct_Mech_X = 100 * V.D.Mech_X / V.motX.MN;

  // ---------- §4.2 servoconverters ----------
  const conv = (Mech, Mmax, kM) => ({ Iech: Mech / kM, Iv: Mmax / kM, Iv12: 1.2 * Mmax / kM });
  V.convZ = conv(V.D.Mech_Z, V.D.Mmax_Z, V.motZ.kM);
  V.convY = conv(V.D.Mech_Y, V.D.Mmax_Y, V.motY.kM);
  V.convX = conv(V.D.Mech_X, V.D.Mmax_X, V.motX.kM);
  // pick smallest SC-400 with Iech <= IN and 1.2Iv <= Imax and Pmotor >= PN
  V.conv_ales = CAT.servoconvertoare_SC.find(c => c.alim === '3×400 V' &&
    Math.max(V.convZ.Iech, V.convY.Iech, V.convX.Iech) <= c.IN &&
    Math.max(V.convZ.Iv12, V.convY.Iv12, V.convX.Iv12) <= c.Imax &&
    Math.max(V.motZ.PN_kW, V.motY.PN_kW, V.motX.PN_kW) <= c.Pmotor_max_kW);
  V.kM_Imax_Y = V.motY.kM * V.conv_ales.Imax;
  V.kM_Imax_X = V.motX.kM * V.conv_ales.Imax;
  V.kM_Imax_Z = V.motZ.kM * V.conv_ales.Imax;
  V.pct_conv_X = 100 * V.convX.Iech / V.conv_ales.IN;

  // ---------- §4.3 braking resistor ----------
  V.Egen_Z_piesa = V.FG_piesa * inp.hZ + 0.5 * V.mSZ_piesa * V.kinZ.vmax ** 2;
  V.Egen_Z_gol = V.FG_gol * inp.hZ + 0.5 * V.mSZ_gol * V.kinZ.vmax ** 2;
  V.Egen_Z_tot = V.Egen_Z_piesa + V.Egen_Z_gol;
  V.Pgen_max_Z = V.FG_piesa * V.kinZ.vmax;
  V.Ekin_X = 0.5 * V.mSX_piesa * V.kinX.vmax ** 2;
  V.Ekin_Y = 0.5 * V.mSY_piesa * V.kinY.vmax ** 2;
  V.Ebr_tot = V.Egen_Z_tot + 2 * V.Ekin_X + 2 * V.Ekin_Y;
  V.Pbr_med = V.Ebr_tot / V.Tc;
  V.Pbr_X = (V.FdinX_piesa - V.FfX_piesa) * V.kinX.vmax;   // X braking peak
  // governing resistor limit: the largest braking power
  V.Pgen_guv = Math.max(V.Pgen_max_Z, V.Pbr_X);
  V.R_max = V.conv_ales.Udc ** 2 / V.Pgen_guv;
  V.ax_guv = V.Pbr_X > V.Pgen_max_Z ? 'X' : 'Z';

  // ---------- §4.4 encoders ----------
  V.ds_rez_cerut = inp.ds / 5;                               // mm
  V.dsr_Z = V.surub.P / 1048576;                             // mm
  V.dsr_XY = Math.PI * V.axY.dp / Math.min(V.axY.i, V.axX.i) / 1048576;  // mm — worst case (smaller i ⇒ larger travel per rev)
  V.depl_rot_XY = Math.PI * V.axY.dp / V.axY.i;              // mm/rot
  V.alung_X = V.Fmax_X / (V.axX.belt[V.belt_ales].c_mid);    // m, with the chosen belt
  V.alung_Y = V.Fmax_Y / (V.axY.belt[V.belt_ales].c_mid);
  V.alung_X_mm = V.alung_X * 1000;
  V.alung_Y_mm = V.alung_Y * 1000;

  // ---------- §4.5 supply ----------
  V.S_aparent = V.Pinst_W / (0.85 * 0.9) * 0.7;
  V.I_linie = V.S_aparent / (Math.sqrt(3) * inp.U_retea);

  // ---------- §5.1 synchronized Y ----------
  V.vmax_Y_sync = 3 * inp.SY / (2 * inp.tX);
  V.a_Y_sync = 9 * inp.SY / (2 * inp.tX ** 2);
  V.rap_Fdin_Y = V.kinY.a / V.a_Y_sync;

  // ---------- §5.4 braking distances ----------
  V.sfr_Z = V.kinZ.vmax ** 2 / (2 * V.kinZ.a);
  V.sfr_Y = V.kinY.vmax ** 2 / (2 * V.kinY.a);
  V.sfr_X = V.kinX.vmax ** 2 / (2 * V.kinX.a);
  V.aqs_X = (V.motX.kM * V.conv_ales.Imax) * V.axX.rred / V.D.JS_X;
  V.sfr_qs_X = V.kinX.vmax ** 2 / (2 * V.aqs_X);
  V.marja_X = V.sfr_qs_X + 0.03;
  V.rap_aqs_a_X = V.aqs_X / V.kinX.a;
  V.aqs_Y = (V.motY.kM * V.conv_ales.Imax) * V.axY.rred / V.D.JS_Y;
  V.sfr_qs_Y = V.kinY.vmax ** 2 / (2 * V.aqs_Y);
  V.SLS_n_Z = 60 * 0.25 / (V.surub.P / 1000);
  V.SLS_nr = 60 * 0.25 / (Math.PI * V.axY.dp_m);
  V.SLS_nmot = V.SLS_nr * V.axY.i;
  V.SLS_nmot_X = V.SLS_nr * V.axX.i;

  // ---------- §6 protections ----------
  V.lim_Z = 1.5 * V.D.Mmax_Z;
  V.lim_Y = 1.5 * V.D.Mmax_Y;
  V.lim_X = 1.5 * V.D.Mmax_X;
  V.Mout_lim_X = V.lim_X * V.axX.i * 0.94;
  V.Mout_lim_Y = V.lim_Y * V.axY.i * 0.94;
  V.test_fruna = 1.3 * V.D.Mhold_p;
  V.rezerva_fruna = V.motZ.Mfr / V.D.Mhold_p;
  V.rap_kMImax_Mmax_X = V.kM_Imax_X / V.D.Mmax_X;
  V.rap_kMImax_Mmax_Y = V.kM_Imax_Y / V.D.Mmax_Y;

  // ---------- hypothetical: no counterweight (§2.2, §2.6, §3.1, concluzii) ----------
  // mΣZ without cw: gol = mmort, piesa = mmort + mp
  V.mSZ_gol_fara = V.mmort;
  V.mSZ_piesa_fara = V.mmort + inp.mp;
  V.FdinZ_gol_fara = V.mSZ_gol_fara * V.kinZ.a;
  V.FdinZ_piesa_fara = V.mSZ_piesa_fara * V.kinZ.a;
  const phZf = (s, FG, Fdin, acc) => s * FG + inp.F0Z + (acc ? Fdin : -Fdin);
  // without cw: FG_gol_fara = mmort·g (empty), FG_piesa_fara = (mmort+mp)·g = FG_fara_cw (loaded)
  V.FG_gol_fara = V.mmort * g;
  const FGg = V.FG_gol_fara, FGp = V.FG_fara_cw;
  const F_fara = {
    cob_gol_acc: phZf(-1, FGg, V.FdinZ_gol_fara, true), cob_gol_mu: -FGg + inp.F0Z, cob_gol_frn: phZf(-1, FGg, V.FdinZ_gol_fara, false),
    rid_piesa_acc: phZf(+1, FGp, V.FdinZ_piesa_fara, true), rid_piesa_mu: FGp + inp.F0Z, rid_piesa_frn: phZf(+1, FGp, V.FdinZ_piesa_fara, false),
    cob_piesa_acc: phZf(-1, FGp, V.FdinZ_piesa_fara, true), cob_piesa_mu: -FGp + inp.F0Z, cob_piesa_frn: phZf(-1, FGp, V.FdinZ_piesa_fara, false),
    rid_gol_acc: phZf(+1, FGg, V.FdinZ_gol_fara, true), rid_gol_mu: FGg + inp.F0Z, rid_gol_frn: phZf(+1, FGg, V.FdinZ_gol_fara, false),
  };
  const MfZ = F => F > 0 ? F * V.rred_Z / eta_SB : F * V.rred_Z * eta_SB;
  const JrotZ_f = (V.motZ['Jr_1e-4'] + V.motZ['Jfr_1e-4']) * 1e-4;
  const MJ_f = (JrotZ_f + V.Js + V.Jc) * V.eps_Z;
  const Zkeys = ['cob_gol_acc','cob_gol_mu','cob_gol_frn','rid_piesa_acc','rid_piesa_mu','rid_piesa_frn','cob_piesa_acc','cob_piesa_mu','cob_piesa_frn','rid_gol_acc','rid_gol_mu','rid_gol_frn'];
  const M_fara = Zkeys.map(k => {
    const F = F_fara[k];
    const MF = MfZ(F);
    const MJ = k.endsWith('acc') ? MJ_f : (k.endsWith('frn') ? -MJ_f : 0);
    return MF + MJ;
  });
  const Mhold_fara_p = MfZ(FGp);          // hold loaded (motor holds → /η)
  const Mhold_fara_g = MfZ(FGg);
  V.Mhold_fara = Mhold_fara_p;
  V.Mech_fara = Math.sqrt((M_fara.reduce((s, m) => s + m * m, 0) * V.ti_Z + V.thold_p * Mhold_fara_p ** 2 + V.thold_g * Mhold_fara_g ** 2) / V.Tc);
  V.Mmax_fara = Math.max(...M_fara.map(Math.abs));
  V.red_Mhold_pct = 100 * (Mhold_fara_p - V.D.Mhold_p) / Mhold_fara_p;
  V.red_Mech_pct = 100 * (V.Mech_fara - V.D.Mech_Z) / V.Mech_fara;
  // Jext without cw (loaded), for the "would SM-06-040 pass?" argument
  V.Jext_Z_fara = V.Js + V.Jc + V.mSZ_piesa_fara * V.rred_Z ** 2;
  V.rap_Z_fara_040 = V.Jext_Z_fara / 0.28e-4;
  V.E_cin_X_62 = V.Ekin_X; // §6.2 uses the same kinetic energy

  // ---------- misc ratios for prose ----------
  // §2.6 terms under the Mech radical (movements vs holds)
  V.Mch_terms = {
    misc: V.ti_Z * V.D.Z.reduce((s, r) => s + r.M ** 2, 0),
    hold_p: V.thold_p * V.D.Mhold_p ** 2,
    hold_g: V.thold_g * V.D.Mhold_g ** 2,
  };
  V.Mch_terms.pct_holds = 100 * (V.Mch_terms.hold_p + V.Mch_terms.hold_g) /
    (V.Mch_terms.misc + V.Mch_terms.hold_p + V.Mch_terms.hold_g);
  // §2.5 inertia share and ratios
  V.pct_mr2_Jext_X = 100 * V.axX.mr2_i2_piesa / V.Jext_X;
  V.rap_JX_JZ = V.Jext_X / V.Jext_Z;
  V.rap_mX_mZ = V.mSX_piesa / V.mSZ_piesa;
  // §4.1 stepper argument
  V.rap_red_pas = V.axX.nmot / 600;
  V.Jref_pas_e4 = V.Jext_X * (V.axX.nmot / 600) ** 2 / 1e-4;
  // §3.3 alternative z=40, i=16 (X and Y)
  const dp40 = 40 * 10 / Math.PI / 1000;
  const mr40 = CAT.constant.rho_otel * Math.PI * (dp40 / 2) ** 2 * V.bw;
  const Jroti40 = mr40 * (dp40 / 2) ** 2;
  const belt40 = (vmax, S, mPiesa, mGol) => {
    const Jcurea40 = (2 * (S + 0.3) * V.mp_belt) * (dp40 / 2) ** 2;
    const Jtri2 = (Jroti40 + Jcurea40 + V.Jc) / 256;
    return {
      nr: 60 * Number(vmax.toFixed(4)) / (Math.PI * dp40),
      Jext: 0.08e-4 + Jtri2 + mPiesa * (dp40 / 2) ** 2 / 256,
      Jext_gol: 0.08e-4 + Jtri2 + mGol * (dp40 / 2) ** 2 / 256,
      Mout_peak: V.Fmax_X * (dp40 / 2) / CAT.constant.eta_curea,
    };
  };
  const bX40 = belt40(V.kinX.vmax, inp.SX, V.mSX_piesa, V.mSX_gol);
  const bY40 = belt40(V.kinY.vmax, inp.SY, V.mSY_piesa, V.mSY_gol);
  V.alt_z40 = {
    dp_mm: dp40 * 1000,
    rred_mm: dp40 / 2 / 16 * 1000,
    X: { nr: bX40.nr, nmot16: bX40.nr * 16, ok: bX40.nr * 16 <= V.n_lim, Jext_e4: bX40.Jext / 1e-4, rap: bX40.Jext / (V.motX['Jr_1e-4'] * 1e-4), Mout_peak: bX40.Mout_peak, Mout12: 1.2 * bX40.Mout_peak },
    Y: { nr: bY40.nr, nmot16: bY40.nr * 16, ok: bY40.nr * 16 <= V.n_lim },
  };

  // conclusions: what-if productivity (+30 %)
  V.Tc_whatif = V.Tc / 1.3;
  // X time needed for that cycle: 4tZ + 2tX + 2tp = Tc_whatif
  V.tX_whatif = (V.Tc_whatif - 4 * inp.tZ - 2 * inp.tp) / 2;
  V.a_whatif = 9 * inp.SX / (2 * V.tX_whatif ** 2);
  // feasible: smallest tX with a <= aadm (with margin), e.g. round up from tmin
  V.tX_fez = Math.ceil(V.kinX.tmin * 2) / 2;   // round up to a "nice" half-second
  V.a_fez = 9 * inp.SX / (2 * V.tX_fez ** 2);
  V.Tc_fez = 4 * inp.tZ + 2 * V.tX_fez + 2 * inp.tp;
  V.N_fez = 3600 / V.Tc_fez;
  V.pct_N_fez = 100 * (V.N_fez - V.N_cicluri) / V.N_cicluri;
  V.F_fez = V.mSX_piesa * V.a_fez + V.FfX_piesa;
  V.M_fez = V.F_fez * V.axX.rred / V.eta_lant + V.D.MJ_X * (V.a_fez / V.kinX.a);
  return V;
}

module.exports = { compute, getInputs, fmt, r0, r1, r2, r3 };

if (require.main === module) {
  const v = parseInt(process.argv[2] || '20');
  const V = compute(getInputs(v));
  console.log(`===== VARIANTA ${v} =====`);
  console.log('Tc =', fmt(V.Tc, 1), 's;  N =', fmt(V.N_cicluri, 0), 'cicluri/h;  thold =', fmt(V.thold_p, 1), 's');
  for (const [k, S, t] of [['Z', V.inp.hZ, V.inp.tZ], ['Y', V.inp.SY, V.inp.tY], ['X', V.inp.SX, V.inp.tX]]) {
    const q = V['kin' + k];
    console.log(`axa ${k}: S=${S} t=${t} ta=${fmt(q.ta, 3)} vmax=${fmt(q.vmax, 3)} a=${fmt(q.a, 3)} tmin=${fmt(q.tmin, 2)}`);
  }
  console.log('a_rez X-Y =', fmt(V.a_rez, 2));
  console.log('mmort =', fmt(V.mmort, 0), '; mcw =', fmt(V.mcw, 1));
  console.log('mΣ Z gol/piesa =', fmt(V.mSZ_gol, 1), '/', fmt(V.mSZ_piesa, 1));
  console.log('mΣ Y gol/piesa =', fmt(V.mSY_gol, 1), '/', fmt(V.mSY_piesa, 1));
  console.log('mΣ X gol/piesa =', fmt(V.mSX_gol, 1), '/', fmt(V.mSX_piesa, 1));
  console.log('FG piesa/gol/fără cw =', fmt(V.FG_piesa, 1), '/', fmt(V.FG_gol, 1), '/', fmt(V.FG_fara_cw, 1));
  console.log('Ff Y gol/piesa =', fmt(V.FfY_gol, 1), '/', fmt(V.FfY_piesa, 1));
  console.log('Ff X gol/piesa =', fmt(V.FfX_gol, 1), '/', fmt(V.FfX_piesa, 1));
  console.log('Fdin Z g/p =', fmt(V.FdinZ_gol, 1), '/', fmt(V.FdinZ_piesa, 1),
    '; Y g/p =', fmt(V.FdinY_gol, 1), '/', fmt(V.FdinY_piesa, 1),
    '; X g/p =', fmt(V.FdinX_gol, 1), '/', fmt(V.FdinX_piesa, 1));
  console.log('Fmax Z/Y/X =', fmt(V.Fmax_Z, 1), '/', fmt(V.Fmax_Y, 1), '/', fmt(V.Fmax_X, 1));
}
