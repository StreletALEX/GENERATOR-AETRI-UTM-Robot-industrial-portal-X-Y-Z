// templates.js — regenerates every OMML math text (flattened) from computed values.
// Each entry: id -> (V) => string. Validated against the variant-20 document.
const TH = '\u2009';   // thin space — thousands separator in the document
const NB = '\u00A0';   // no-break space — separator before units / inside math

// fixed decimals, Romanian comma
const f = (x, d) => Number(x).toFixed(d).replace('.', ',');
// natural: up to d decimals, trailing zeros trimmed ("2" not "2,0"; "0,4"; "13")
const fN = (x, d = 2) => {
  let s = Number(x).toFixed(d).replace('.', ',');
  if (s.includes(',')) s = s.replace(/0+$/, '').replace(/,$/, '');
  return s;
};
// integer with thin-space grouping (only for >= 5 digits, as in the document)
const fi = (x) => {
  let s = Math.round(x).toString();
  if (s.startsWith('-')) return '-' + fi(-x);
  if (s.length >= 5) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, TH);
  return s;
};
// mantissa·10^exp flattened like the document ("2,546·10-3")
const m10 = (x, d, exp) => `${f(x / Math.pow(10, exp), d)}·10${exp}`;
// post-process: unit separator -> NBSP; symbol spaces -> thin space; suffixes kept as in doc
const UNITS = ['m/s2', 'm/s', 'N·m', 'N/m', 'kg·m2', 'rot/min', 'rad/s2', 'cicluri/h', 'kW', 'kVA', 'rotații', 'arcmin', 'mm·rot/min', 'rad/s', 'kg', 'mm', 'Hz', 'W', 'J', 'A', 'V', 'N', 'm', 's', 'h', 'Ω', 'ori'];
const pp = (s) => {
  let suffix = '';
  let m = s.match(/ \(în gol\)$/);
  if (m) { suffix = '\u00A0(în gol)'; s = s.slice(0, -suffix.length); }
  else if ((m = s.match(/ \((X|Y)\)$/))) { suffix = NB + '(' + m[1] + ')'; s = s.slice(0, -m[0].length); }
  for (const u of UNITS) if (s.endsWith(' ' + u)) { s = s.slice(0, -u.length - 1) + NB + u; break; }
  s = s.replace(/ N·m(?=≤)/g, NB + 'N·m');
  return s.replace(/ /g, TH) + suffix;
};

function build(V) {
  const inp = V.inp;
  const D = V.D;
  const Y = V.axY, X = V.axX;
  const kZ = V.kinZ, kY = V.kinY, kX = V.kinX;
  const mZ = V.motZ, mY = V.motY, mX = V.motX;
  const t = {};
  const T = (id, fn) => { t[id] = () => pp(fn()); };

  // ---------- §1.2 ----------
  T(40, () => `Tc=4tZ+2maxtX,tY+2tp=4·${fN(inp.tZ)}+2max${fN(inp.tX)};${fN(inp.tY)}+2·${fN(inp.tp)}=${f(V.Tc,1)} s`);
  T(44, () => `N=3600Tc=3600${f(V.Tc,1)}=${fi(V.N_cicluri)} cicluri/h`);
  T(48, () => `thold,p=maxtX,tY+tp=${fN(inp.tX)}+${fN(inp.tp)}=${f(V.thold_p,1)} s`);
  T(51, () => `thold,g=maxtX,tY+tp=${fN(inp.tX)}+${fN(inp.tp)}=${f(V.thold_g,1)} s`);

  // ---------- §1.4 kinematics ----------
  const kin = (ids, k, S, tA, adm) => {
    T(ids.ta, () => `ta=t3=${fN(tA)}3=${f(k.ta,3)} s`);
    T(ids.v, () => `vmax=3S2t=3·${fN(S)}2·${fN(tA)}=${f(k.vmax,3)} m/s`);
    T(ids.a, () => `a=9S2t2=9·${fN(S)}2·${fN(tA)}2=${f(k.a,3)} m/s2`);
    T(ids.tmin, () => `tmin=9S2aadm=9·${fN(S)}2·${fN(adm)}=${f(k.tmin,2)} s`);
  };
  kin({ ta: 59, v: 62, a: 65, tmin: 68 }, kZ, inp.hZ, inp.tZ, inp.aadm);
  kin({ ta: 72, v: 75, a: 78, tmin: 81 }, kY, inp.SY, inp.tY, inp.aadm);
  kin({ ta: 85, v: 88, a: 91, tmin: 94 }, kX, inp.SX, inp.tX, inp.aadm);
  T(102, () => `a=aX2+aY2=${f(kX.a,2)}2+${f(kY.a,2)}2=${f(V.a_rez,2)} m/s2`);

  // ---------- §2.1 masses ----------
  T(109, () => `mmort=mZ+mg=${fN(inp.mZ)}+${fN(inp.mg)}=${fN(V.mmort)} kg`);
  T(112, () => `mcw=α mmort=${fN(inp.alpha)}·${fN(V.mmort)}=${fN(V.mcw)} kg`);
  T(115, () => `mΣZ=mZ+mg+mcw=${fN(inp.mZ)}+${fN(inp.mg)}+${fN(V.mcw)}=${fN(V.mSZ_gol)} kg`);
  T(118, () => `mΣZ=mZ+mg+mp+mcw=${fN(inp.mZ)}+${fN(inp.mg)}+${fN(inp.mp)}+${fN(V.mcw)}=${fN(V.mSZ_piesa)} kg`);
  T(122, () => `mΣY=mY+mΣZ=${fN(inp.mY)}+${fN(V.mSZ_gol)}=${fN(V.mSY_gol)} kg`);
  T(125, () => `mΣY=mY+mΣZ=${fN(inp.mY)}+${fN(V.mSZ_piesa)}=${fN(V.mSY_piesa)} kg`);
  T(129, () => `mΣX=mX+mΣY=${fN(inp.mX)}+${fN(V.mSY_gol)}=${fN(V.mSX_gol)} kg`);
  T(132, () => `mΣX=mX+mΣY=${fN(inp.mX)}+${fN(V.mSY_piesa)}=${fN(V.mSX_piesa)} kg`);

  // ---------- §2.2 statics ----------
  T(138, () => `FG=mmort+mp-mcw g=${fN(V.mmort)}+${fN(inp.mp)}-${fN(V.mcw)}·9,81=${f(V.FG_piesa,1)} N`);
  T(141, () => `FG=mmort+mp-mcw g=${fN(V.mmort)}+0-${fN(V.mcw)}·9,81=${f(V.FG_gol,1)} N`);
  T(144, () => `FG=mmort+mp-mcw g=${fN(V.mmort)}+${fN(inp.mp)}-0·9,81=${f(V.FG_fara_cw,1)} N`);
  T(148, () => `Ff=μ mΣY g+F0Y=0,01·${fN(V.mSY_gol)}·9,81+${fN(inp.F0Y)}=${f(V.FfY_gol,1)} N`);
  T(151, () => `Ff=μ mΣY g+F0Y=0,01·${fN(V.mSY_piesa)}·9,81+${fN(inp.F0Y)}=${f(V.FfY_piesa,1)} N`);
  T(154, () => `Ff=μ mΣX g+F0X=0,01·${fN(V.mSX_gol)}·9,81+${fN(inp.F0X)}=${f(V.FfX_gol,1)} N`);
  T(157, () => `Ff=μ mΣX g+F0X=0,01·${fN(V.mSX_piesa)}·9,81+${fN(inp.F0X)}=${f(V.FfX_piesa,1)} N`);

  // ---------- §2.3 dynamics ----------
  T(162, () => `Fdin=mΣZ a=${fN(V.mSZ_gol)}·${f(kZ.a,3)}=${f(V.FdinZ_gol,1)} N`);
  T(164, () => `Fdin=mΣZ a=${fN(V.mSZ_piesa)}·${f(kZ.a,3)}=${f(V.FdinZ_piesa,1)} N`);
  T(167, () => `Fdin=mΣY a=${fN(V.mSY_gol)}·${f(kY.a,3)}=${f(V.FdinY_gol,1)} N`);
  T(169, () => `Fdin=mΣY a=${fN(V.mSY_piesa)}·${f(kY.a,3)}=${f(V.FdinY_piesa,1)} N`);
  T(172, () => `Fdin=mΣX a=${fN(V.mSX_gol)}·${f(kX.a,3)}=${f(V.FdinX_gol,1)} N`);
  T(174, () => `Fdin=mΣX a=${fN(V.mSX_piesa)}·${f(kX.a,3)}=${f(V.FdinX_piesa,1)} N`);
  T(178, () => `F=s FG+Ff+Fdin=+1·${f(V.FG_piesa,1)}+${fN(inp.F0Z)}+${f(V.FdinZ_piesa,1)}=${f(V.F_Z.rid_piesa_acc,1)} N`);
  T(181, () => `F=s FG+Ff-Fdin=-1·${f(V.FG_piesa,1)}+${fN(inp.F0Z)}-${f(V.FdinZ_piesa,1)}=${f(V.F_Z.cob_piesa_frn,1)} N`);
  T(184, () => `F=s FG+Ff+Fdin=-1·${f(V.FG_gol,1)}+${fN(inp.F0Z)}+${f(V.FdinZ_gol,1)}=${f(V.F_Z.cob_gol_acc,1)} N`);
  T(192, () => `F=s FG+Ff+Fdin=0+${f(V.FfY_piesa,1)}+${f(V.FdinY_piesa,1)}=${f(V.F_Y.dus_acc,1)} N`);
  T(195, () => `F=s FG+Ff+Fdin=0+${f(V.FfX_piesa,1)}+${f(V.FdinX_piesa,1)}=${f(V.F_X.dus_acc,1)} N`);

  // ---------- §2.4.1 screw ----------
  T(204, () => `0,95 nN=0,95·3000=2850 rot/min`);
  const vmax5 = Number(kZ.vmax.toFixed(5));
  T(207, () => `ns=60 vmaxP=60·${f(vmax5,5)}0,010=${fi(60*vmax5/0.010)} rot/min`);
  T(209, () => `ns=60 vmaxP=60·${f(vmax5,5)}0,016=${fi(V.ns)} rot/min`);
  T(212, () => `rred=P2π=0,0162π=${m10(2.5465e-3,3,-3)} m`);
  T(215, () => `L=S+0,15=${fN(inp.hZ)}+0,15=${fN(V.L_surub)} m`);
  T(217, () => `Lc=S+0,10=${fN(inp.hZ)}+0,10=${fN(V.Lc)} m`);
  T(221, () => `d0 ns=16·${fi(V.ns)}=${fi(V.d0n)} mm·rot/min`);
  T(224, () => `ncr=fn drLc2·107=18,9·12,5${fi(V.Lc_mm)}2·107=${fi(V.ncr)} rot/min`);
  T(227, () => `0,8 ncr=0,8·${fi(V.ncr)}=${fi(V.ncr_adm)} rot/min`);
  T(230, () => `Fk=fk dr4Lc2·104=20,4·12,54${fi(V.Lc_mm)}2·104=${fi(V.Fk)} N`);
  T(232, () => `0,5 Fk=0,5·${fi(V.Fk)}=${fi(V.Fk_adm)} N`);
  T(235, () => `C0a2=10${TH}8002=5400 N`);
  const ns_rampa = V.ns / 2;
  const tiZdisp = () => inp.tZ === 0.9 ? f(V.ti_Z, 1) : f(V.ti_Z, 3); // doc shows "0,3" for v20
  T(239, () => `nm=∑ni tiTc=4·${fi(ns_rampa)}+${fi(V.ns)}+${fi(ns_rampa)}·${tiZdisp()}${f(V.Tc,1)}=${f(V.nm_Z,1)} rot/min`);
  T(242, () => `Fm=∑|Fi|3 ni ti∑ni ti1/3`);
  const Zf = V.F_Z;
  const Zord = [Zf.cob_gol_acc, Zf.cob_gol_mu, Zf.cob_gol_frn, Zf.rid_piesa_acc, Zf.rid_piesa_mu, Zf.rid_piesa_frn, Zf.cob_piesa_acc, Zf.cob_piesa_mu, Zf.cob_piesa_frn, Zf.rid_gol_acc, Zf.rid_gol_mu, Zf.rid_gol_frn];
  T(244, () => `=${Zord.map((Fv, i) => `${f(Math.abs(Fv),1)}3·${fi(i % 3 === 1 ? V.ns : ns_rampa)}`).join('+')}4·${fi(ns_rampa)}+${fi(V.ns)}+${fi(ns_rampa)}1/3=${f(V.Fm_Z,1)} N`);
  
  T(247, () => `L10=CaFm3·106=6400${f(V.Fm_Z,1)}3·106=${m10(V.L10_Z,2,10)} rotații`);
  T(249, () => `L10h=L1060 nm=${m10(V.L10_Z,2,10)}60·${f(V.nm_Z,1)}=${m10(V.L10h_Z,2,5)} h`);
  T(253, () => `Js=J' L=0,5·10-4·${f(V.L_surub,2)}=${m10(V.Js,3,-4)} kg·m2`);
  T(256, () => `mΣZ rred2=${fN(V.mSZ_piesa)}·2,546·10-32=${m10(V.mr2_Z_piesa,2,-4)} kg·m2`);
  T(258, () => `mΣZ rred2=${fN(V.mSZ_gol)}·2,546·10-32=${m10(V.mr2_Z_gol,2,-4)} kg·m2`);

  // ---------- §2.4.2 / §2.4.3 belt axes ----------
  Y.ax = 'ΣY'; Y.m_piesa_ref = V.mSY_piesa; Y.m_gol_ref = V.mSY_gol;
  X.ax = 'ΣX'; X.m_piesa_ref = V.mSX_piesa; X.m_gol_ref = V.mSX_gol;
  const belt = (P, A, S, Fmax) => {
    T(P.nr, () => `nr=60 vmaxπ dp=60·${f(A.vmax4,4)}π·${f(A.dp_m, 5)}=${f(A.nr,1)} rot/min`);
    T(P.nmot12, () => `nmot=nr i=${f(A.nr,1)}·${A.i}=${fi(A.nmot)} rot/min`);
    T(P.nmot16, () => `nmot=nr i=${f(A.nr,1)}·${A.i_next}=${fi(A.nr_full * A.i_next)} rot/min`);
    T(P.rred, () => `rred=dp2i=${f(A.dp_m, 5)}2·${A.i}=${m10(A.rred,3,-3)} m`);
    T(P.Mout, () => `Mout=Fmax dp2 ηc=${f(Fmax,1)}·${f(A.dp_m, 5)}2·0,96=${f(A.Mout_peak,2)} N·m`);
    T(P.Mout12, () => `1,2 Mout=1,2·${f(A.Mout_peak,2)}=${f(A.Mout_peak_12,1)} N·m`);
    T(P.Mech, () => `Mout,ech=∑iMout,i2 tiTc=${f(A.ti,4)}·${A.Mout_faze.map(M => f(Math.abs(M),2)).join('2+')}2${f(V.Tc,1)}=${f(A.Mout_ech,1)} N·m`);
    T(P.Fbelt, () => `1,3 Fmax=1,3·${f(Fmax,1)}=${fi(A.F_belt_min)} N`);
    T(P.cCapat, () => `c=csp1L1+1L2=${f(A.belt[V.belt_ales].csp,2)}·106·10,15+1${f(S+0.15,2)}=${m10(A.c_capat,2,6)} N/m`);
    T(P.feCapat, () => `fe=12πcm=12π${m10(A.c_capat,2,6)}${fN(A.m_piesa_ref)}=${f(A.fe_capat,1)} Hz`);
    T(P.Lmij, () => `L1=L2=S+0,32=${fN(S)}+0,32=${f(A.L_mij,2)} m`);
    T(P.c25, () => `c=csp1L1+1L2=0,62·106·1${f(A.L_mij,2)}+1${f(A.L_mij,2)}=${m10(A.belt['AT10-25'].c_mid,2,6)} N/m`);
    T(P.fe25, () => `fe=12πcm=12π${m10(A.belt['AT10-25'].c_mid,2,6)}${fN(A.m_piesa_ref)}=${f(A.belt['AT10-25'].fe_mid,1)} Hz`);
    T(P.c32, () => `c=csp1L1+1L2=${f(A.belt[V.belt_ales].csp,2)}·106·1${f(A.L_mij,2)}+1${f(A.L_mij,2)}=${m10(A.belt[V.belt_ales].c_mid,2,6)} N/m`);
    T(P.fe32, () => `fe=12πcm=12π${m10(A.belt[V.belt_ales].c_mid,2,6)}${fN(A.m_piesa_ref)}=${f(A.belt[V.belt_ales].fe_mid,1)} Hz`);
    T(P.mcurea, () => `mcurea=2 S+0,3 m'=2·${fN(S)}+0,3·${fN(V.mp_belt)}=${f(A.mcurea,3)} kg`);
    T(P.Jcurea, () => `mcureadp22=${f(A.mcurea,3)}·0,050932=${m10(A.Jcurea,1,-4)} kg·m2`);
    T(P.mr2p, () => `m${A.ax}dp22=${fN(A.m_piesa_ref)}·0,050932=${f(A.mr2_piesa,4)} kg·m2`);
    T(P.mr2g, () => `m${A.ax}dp22=${fN(A.m_gol_ref)}·0,050932=${f(A.mr2_gol,4)} kg·m2`);
    T(P.Jtri2, () => `Jtr+Jci2=${f(A.Jroti/1e-4,1)}+${f(A.Jcurea/1e-4,1)}+0,2·10-4${A.i}2=${m10(A.Jtr_plus_Jc_i2,2,-4)} kg·m2`);
    T(P.mr2i2, () => `m rtr2i2=${f(A.mr2_piesa,4)}${A.i}2=${m10(A.mr2_i2_piesa,2,-4)} kg·m2`);
  };
  belt({ nr: 267, nmot12: 270, nmot16: 272, rred: 275, Mout: 282, Mout12: 285, Mech: 288, Fbelt: 299, cCapat: 302, feCapat: 304, Lmij: 307, c25: 310, fe25: 312, c32: 315, fe32: 317, mcurea: 328, Jcurea: 331, mr2p: 334, mr2g: 336, Jtri2: 339, mr2i2: 342 }, Y, inp.SY, V.Fmax_Y);
  belt({ nr: 348, nmot12: 351, nmot16: 353, rred: 356, Mout: 363, Mout12: 366, Mech: 369, Fbelt: 373, cCapat: 376, feCapat: 378, Lmij: 381, c25: 384, fe25: 386, c32: 389, fe32: 391, mcurea: 396, Jcurea: 399, mr2p: 402, mr2g: 404, Jtri2: 407, mr2i2: 410 }, X, inp.SX, V.Fmax_X);
  T(263, () => `dp=z pπ=${Y.z_ales}·10π=${f(Y.dp, 2)} mm`);
  T(292, () => `Δsjoc=joc60·π180·dp2=1060·π180·50,93=${f(Y.ds_joc_std,3)} mm`);
  T(295, () => `Δsjoc=joc60·π180·dp2=560·π180·50,93=${f(Y.ds_joc_R,3)} mm`);
  T(322, () => `mr=ρ πdp22b=7850·π·0,050932·${f(V.bw,3)}=${f(Y.mr,2)} kg`);
  T(325, () => `Jroți=2·12 mrdp22=2·12·${f(Y.mr,2)}·0,050932=${m10(Y.Jroti,1,-4)} kg·m2`);

  // ---------- §2.5 reduction ----------
  T(416, () => `εmot=arred=${f(kZ.a,3)}2,5465·10-3=${fi(V.eps_Z)} rad/s2`);
  T(418, () => `εmot=arred=${f(kY.a,3)}${m10(Y.rred,4,-3)}=${fi(V.eps_Y)} rad/s2`);
  T(420, () => `εmot=arred=${f(kX.a,3)}${m10(X.rred,4,-3)}=${fi(V.eps_X)} rad/s2`);
  T(423, () => `Ωmot=2π nmot60=2π·${fi(V.ns)}60=${f(V.Omega_Z,1)} rad/s`);
  T(425, () => `Ωmot=2π nmot60=2π·${fi(Y.nmot)}60=${f(V.Omega_Y,1)} rad/s`);
  T(427, () => `Ωmot=2π nmot60=2π·${fi(X.nmot)}60=${f(V.Omega_X,1)} rad/s`);

  const e4c = x => m10(x, 2, -4);
  const JtrZ = V.Js / 1e-4;
  T(431, () => `JΣ=Jr+Jfr+Jred+Jtr+Jci2+m rtr2i2=${f(mZ['Jr_1e-4'],2)}+${f(mZ['Jfr_1e-4'],2)}+0+${f(JtrZ,3)}+0,212+${f(V.mr2_Z_piesa/1e-4,2)}12·10-4=${e4c(D.JS_Z)} kg·m2`);
  T(434, () => `Jext=JΣ-Jr-Jfr=${f(D.JS_Z/1e-4,2)}-${f(mZ['Jr_1e-4'],2)}-${f(mZ['Jfr_1e-4'],2)}·10-4=${e4c(V.Jext_Z)} kg·m2`);
  T(438, () => `JΣ=Jr+Jfr+Jred+Jtr+Jci2+m rtr2i2=${f(mY['Jr_1e-4'],2)}+0+0,08+${f(Y.Jtr_plus_Jc_i2/1e-4,2)}+${f(Y.mr2_i2_piesa/1e-4,2)}·10-4=${e4c(D.JS_Y)} kg·m2`);
  T(440, () => `Jext=JΣ-Jr-Jfr=${f(D.JS_Y/1e-4,2)}-${f(mY['Jr_1e-4'],2)}-0·10-4=${e4c(V.Jext_Y)} kg·m2`);
  T(442, () => `Jext=Jred+Jtr+Jci2+m rtr2i2=0,08+${f(Y.Jtr_plus_Jc_i2/1e-4,2)}+${f(Y.mr2_i2_gol/1e-4,2)}·10-4=${e4c(V.Jext_Y_gol)} kg·m2 (în gol)`);
  T(445, () => `JΣ=Jr+Jfr+Jred+Jtr+Jci2+m rtr2i2=${f(mX['Jr_1e-4'],2)}+0+0,08+${f(X.Jtr_plus_Jc_i2/1e-4,2)}+${f(X.mr2_i2_piesa/1e-4,2)}·10-4=${e4c(D.JS_X)} kg·m2`);
  T(447, () => `Jext=JΣ-Jr-Jfr=${f(D.JS_X/1e-4,2)}-${f(mX['Jr_1e-4'],2)}-0·10-4=${e4c(V.Jext_X)} kg·m2`);
  T(449, () => `Jext=Jred+Jtr+Jci2+m rtr2i2=0,08+${f(X.Jtr_plus_Jc_i2/1e-4,2)}+${f(X.mr2_i2_gol/1e-4,2)}·10-4=${e4c(V.Jext_X_gol)} kg·m2 (în gol)`);

  // ---------- §2.6 load diagrams ----------
  T(459, () => `MJ=Jr+Jfr+Jred+Jtr+Jci2εmot=${f(mZ['Jr_1e-4'],2)}+${f(mZ['Jfr_1e-4'],2)}+0+${f((V.Js+V.Jc)/1e-4,3)}·10-4·${fi(V.eps_Z)}=${f(D.MJ_Z,3)} N·m`);
  T(461, () => `MJ=Jr+Jfr+Jred+Jtr+Jci2εmot=${f(mY['Jr_1e-4'],2)}+0+0,08+${f(Y.Jtr_plus_Jc_i2/1e-4,2)}·10-4·${fi(V.eps_Y)}=${f(D.MJ_Y,3)} N·m`);
  T(463, () => `MJ=Jr+Jfr+Jred+Jtr+Jci2εmot=${f(mX['Jr_1e-4'],2)}+0+0,08+${f(X.Jtr_plus_Jc_i2/1e-4,2)}·10-4·${fi(V.eps_X)}=${f(D.MJ_X,3)} N·m`);
  T(467, () => `MF=F rredη=${f(V.F_Z.rid_piesa_acc,1)}·2,546·10-30,93=${f(D.Z[3].MF,3)} N·m`);
  T(470, () => `MF=F rred η=${f(V.F_Z.cob_piesa_frn,1)}·2,546·10-3·0,93=${f(D.Z[8].MF,3)} N·m`);
  T(473, () => `M=MF+MJ=${f(D.Z[3].MF,3)}+${f(D.MJ_Z,3)}=${f(D.Z[3].M,3)} N·m`);
  T(476, () => `M=MF+MJ=${f(D.Z[8].MF,3)}-${f(D.MJ_Z,3)}=${f(D.Z[8].M,3)} N·m`);
  T(483, () => `Mhold,p=FG rredη=${f(V.FG_piesa,1)}·2,546·10-30,93=${f(D.Mhold_p,3)} N·m`);
  T(485, () => `Mhold,g=FG rredη=${f(V.FG_gol,1)}·2,546·10-30,93=${f(D.Mhold_g,3)} N·m`);
  T(489, () => `Mech=∑Mi2 tiTc`);
  T(491, () => `=${tiZdisp()}·${D.Z.map(r => f(Math.abs(r.M),3)).join('2+')}2+${f(V.thold_p,1)}·${f(D.Mhold_p,3)}2+${f(V.thold_g,1)}·${f(D.Mhold_g,3)}2${f(V.Tc,1)}=${f(D.Mech_Z,2)} N·m`);
  T(495, () => `Mhold=FG rredη=${f(V.FG_fara_cw,1)}·2,546·10-30,93=${f(D.Mhold_fara_cw,2)} N·m`);
  T(499, () => `MF=F rredηc ηred=${f(V.F_Y.dus_acc,1)}·${m10(Y.rred,3,-3)}0,96·0,94=${f(D.Y[0].MF,3)} N·m`);
  T(502, () => `M=MF+MJ=${f(D.Y[0].MF,3)}+${f(D.MJ_Y,3)}=${f(D.Y[0].M,3)} N·m`);
  T(506, () => `MF=F rredηc ηred=${f(V.F_X.dus_acc,1)}·${m10(X.rred,3,-3)}0,96·0,94=${f(D.X[0].MF,3)} N·m`);
  T(509, () => `M=MF+MJ=${f(D.X[0].MF,3)}+${f(D.MJ_X,3)}=${f(D.X[0].M,3)} N·m`);
  T(516, () => `Mech=∑Mi2 tiTc=${f(Y.ti,4)}·${D.Y.map(r => f(Math.abs(r.M),3)).join('2+')}2${f(V.Tc,1)}=${f(D.Mech_Y,2)} N·m`);
  T(519, () => `Mech=∑Mi2 tiTc=${f(X.ti,4)}·${D.X.map(r => f(Math.abs(r.M),3)).join('2+')}2${f(V.Tc,1)}=${f(D.Mech_X,2)} N·m`);
  T(525, () => `P=Fmax vmaxη=${f(V.Fmax_Z,1)}·${f(kZ.vmax,3)}0,93=${fi(V.Fmax_Z*kZ.vmax/V.surub.eta)} W`);
  T(527, () => `P=Fmax vmaxηc ηred=${f(V.Fmax_Y,1)}·${f(kY.vmax,3)}0,96·0,94=${fi(V.Fmax_Y*kY.vmax/V.eta_lant)} W`);
  T(529, () => `P=Fmax vmaxηc ηred=${f(V.Fmax_X,1)}·${f(kX.vmax,3)}0,96·0,94=${fi(V.Fmax_X*kX.vmax/V.eta_lant)} W`);

  // ---------- §3 motors ----------
  const rat = (Jext, Jr) => `JextJr=${f(Jext/1e-4,2)}${fN(Jr)}=${f(Jext/(Jr*1e-4),1)}`;
  // Z: first candidate passing cuplu+turație+frână with rap<=20 (excl. SM-10-150), and the adopted motor
  const candsZ = V.candZ.filter(c => c.brake_ok && D.Mech_Z <= 1.0 * c.m.MN && 1.2 * D.Mmax_Z <= c.m.Mmax && V.ns <= c.m.nN && c.rap <= 20 && c.m.tip !== 'SM-10-150');
  const firstZ = candsZ[0] || { m: { 'Jr_1e-4': 0.28 } };
  T(535, () => `1,5 Mhold=1,5·${f(D.Mhold_p,3)}=${f(1.5*D.Mhold_p,2)} N·m`);
  T(538, () => rat(V.Jext_Z, firstZ.m['Jr_1e-4']));
  T(540, () => rat(V.Jext_Z, mZ['Jr_1e-4']));
  T(545, () => `Mech=${f(D.Mech_Z,2)} N·m≤kamb MN=1,0·${f(mZ.MN,2)}=${f(mZ.MN,2)} N·m`);
  T(548, () => `MechMN=${f(D.Mech_Z,2)}${f(mZ.MN,2)}=${f(D.Mech_Z/mZ.MN,2)}`);
  T(552, () => `1,2 Mmax=1,2·${f(D.Mmax_Z,2)}=${f(1.2*D.Mmax_Z,2)} N·m≤Mmax,mot=${f(mZ.Mmax,2)} N·m`);
  T(557, () => rat(V.Jext_Z_gol, mZ['Jr_1e-4']));
  T(562, () => `Pvârf=Mmax Ωmot=${f(D.Mmax_Z,3)}·${f(V.Omega_Z,1)}=${fi(D.Pvarf_Z)} W`);
  T(567, () => rat(V.Jext_Y, 0.28));
  T(569, () => rat(V.Jext_Y, 1.13));
  T(571, () => rat(V.Jext_Y, mY['Jr_1e-4']));
  T(574, () => rat(V.Jext_Y_gol, mY['Jr_1e-4']));
  T(577, () => `MechMN=${f(D.Mech_Y,2)}${f(mY.MN,2)}=${f(D.Mech_Y/mY.MN,2)}`);
  T(580, () => `1,2 Mmax=1,2·${f(D.Mmax_Y,2)}=${f(1.2*D.Mmax_Y,2)} N·m≤Mmax,mot=${f(mY.Mmax,2)} N·m`);
  T(583, () => `Pvârf=Mmax Ωmot=${f(D.Mmax_Y,3)}·${f(V.Omega_Y,1)}=${fi(D.Pvarf_Y)} W`);
  T(588, () => rat(V.Jext_X, 1.13));
  T(590, () => rat(V.Jext_X, mX.tip === 'SM-10-100' ? mX['Jr_1e-4'] : 2.65));
  T(592, () => rat(V.Jext_X, mX.tip === 'SM-10-100' ? 3.6 : mX['Jr_1e-4']));
  T(595, () => rat(V.Jext_X_gol, mX['Jr_1e-4']));
  T(598, () => `MechMN=${f(D.Mech_X,2)}${f(mX.MN,2)}=${f(D.Mech_X/mX.MN,2)}`);
  T(601, () => `1,2 Mmax=1,2·${f(D.Mmax_X,2)}=${f(1.2*D.Mmax_X,2)} N·m≤Mmax,mot=${f(mX.Mmax,2)} N·m`);
  T(604, () => `Pvârf=Mmax Ωmot=${f(D.Mmax_X,3)}·${f(V.Omega_X,1)}=${fi(D.Pvarf_X)} W`);
  T(608, () => `Mout,echMN=${f(X.Mout_ech,1)}18=${f(X.Mout_ech/18,2)}`);
  T(610, () => `1,2 MoutMmax=${f(X.Mout_peak_12,1)}30=${f(X.Mout_peak_12/30,2)}`);

  // ---------- §3.4 energy ----------
  const Om2Z = V.Omega_Z/2;
  T(616, () => `E=∑Mi Ωi ti=${f(D.Z[3].M,3)}·${f(Om2Z,1)}·${f(V.ti_Z,4)}+${f(D.Z[4].M,3)}·${f(V.Omega_Z,1)}·${f(V.ti_Z,4)}+${f(D.Z[5].M,3)}·${f(Om2Z,1)}·${f(V.ti_Z,4)}=${fi(D.E_rid_piesa)} J`);
  T(618, () => `E=∑Mi Ωi ti=${f(D.Z[9].M,3)}·${f(Om2Z,1)}·${f(V.ti_Z,4)}+${f(D.Z[10].M,3)}·${f(V.Omega_Z,1)}·${f(V.ti_Z,4)}+${f(D.Z[11].M,3)}·${f(Om2Z,1)}·${f(V.ti_Z,4)}=${fi(D.E_rid_gol)} J`);
  T(621, () => `Pmed=∑ETc=${fi(D.E_Z)}${f(V.Tc,1)}=${fi(D.Pmed_Z)} W`);
  T(628, () => `Pinst=∑PN=${f(mZ.PN_kW,2)}+${f(mY.PN_kW,1)}+${f(mX.PN_kW,1)}=${f(V.Pinst,2)} kW`);
  T(631, () => `I=MholdkM=${f(D.Mhold_p,3)}${f(mZ.kM,2)}=${f(V.I_hold_Z,1)} A`);
  T(634, () => `PinstPmed=${fi(V.Pinst_W)}${fi(V.Pmed_tot)}=${fi(V.rap_Pinst_Pmed)}`);
  T(640, () => `nmot600=${fi(X.nmot)}600=${f(X.nmot/600,1)} ori`);

  // ---------- §4 ----------
  const cur = (ids, Mech, Mmax, kM) => {
    T(ids.e, () => `Iech=MechkM=${f(Mech,2)}${f(kM,2)}=${f(Mech/kM,2)} A`);
    T(ids.v, () => `Iv=MmaxkM=${f(Mmax,2)}${f(kM,2)}=${f(Mmax/kM,2)} A`);
    T(ids.b, () => `1,2 Iv=1,2·${f(Mmax/kM,2)}=${f(1.2*Mmax/kM,2)} A`);
  };
  cur({ e: 645, v: 647, b: 649 }, D.Mech_Z, D.Mmax_Z, mZ.kM);
  cur({ e: 652, v: 654, b: 656 }, D.Mech_Y, D.Mmax_Y, mY.kM);
  cur({ e: 659, v: 661, b: 663 }, D.Mech_X, D.Mmax_X, mX.kM);
  T(666, () => `kM Imax=${f(mX.kM,2)}·${fi(V.conv_ales.Imax)}=${f(V.kM_Imax_X,2)} N·m`);
  T(671, () => `Egen=FG hZ+12 m vmax2=${f(V.FG_piesa,1)}·${fN(inp.hZ)}+12·${fN(V.mSZ_piesa)}·${f(kZ.vmax,3)}2=${fi(V.Egen_Z_piesa)} J`);
  T(674, () => `Egen=FG hZ+12 m vmax2=${f(V.FG_gol,1)}·${fN(inp.hZ)}+12·${fN(V.mSZ_gol)}·${f(kZ.vmax,3)}2=${fi(V.Egen_Z_gol)} J`);
  T(677, () => `∑Egen=${fi(V.Egen_Z_piesa)}+${fi(V.Egen_Z_gol)}=${fi(V.Egen_Z_tot)} J`);
  T(680, () => `Pgen,max=FG vmax=${f(V.FG_piesa,1)}·${f(kZ.vmax,3)}=${fi(V.Pgen_max_Z)} W`);
  T(683, () => `R≤Udc2Pgen,max=5602${fi(V.Pgen_guv)}=${fi(V.R_max)} Ω`);
  T(686, () => `E=12 mΣX vmax2=12·${fN(V.mSX_piesa)}·${f(kX.vmax,3)}2=${fi(V.Ekin_X)} J`);
  T(689, () => `E=12 mΣY vmax2=12·${fN(V.mSY_piesa)}·${f(kY.vmax,3)}2=${fi(V.Ekin_Y)} J`);
  T(692, () => `∑E=${fi(V.Egen_Z_tot)}+2·${fi(V.Ekin_X)}+2·${fi(V.Ekin_Y)}=${fi(V.Ebr_tot)} J`);
  T(695, () => `Pbr,med=∑ETc=${fi(V.Ebr_tot)}${f(V.Tc,1)}=${fi(V.Pbr_med)} W`);
  T(698, () => `P=Fdin-Ff vmax=${f(V.FdinX_piesa,1)}-${f(V.FfX_piesa,1)}·${f(kX.vmax,3)}=${fi(V.Pbr_X)} W`);
  T(703, () => `Δs5=${fN(inp.ds)}5=${f(inp.ds/5,2)} mm`);
  T(706, () => `Δsrez=P220=161${TH}048${TH}576=${m10(V.dsr_Z,1,-5)} mm`);
  T(709, () => `Δsrez=π dp/i220=π·${f(Y.dp, 2)}/${Math.min(Y.i, X.i)}1${TH}048${TH}576=${m10(V.dsr_XY,1,-5)} mm`);
  T(713, () => `Fc=${f(V.Fmax_X,1)}${m10(X.belt[V.belt_ales].c_mid,2,6)}=${f(V.alung_X_mm,2)} mm (X)`);
  T(715, () => `Fc=${f(V.Fmax_Y,1)}${m10(Y.belt[V.belt_ales].c_mid,2,6)}=${f(V.alung_Y_mm,2)} mm (Y)`);
  T(720, () => `S=Pinstηcosφ·0,7=${f(V.Pinst,2)}0,85·0,9·0,7=${f(V.S_aparent/1e3,1)} kVA`);
  T(723, () => `I=S3 U=${fi(V.S_aparent)}3·400=${f(V.I_linie,1)} A`);

  // ---------- §5 ----------
  T(732, () => `vmax=3S2t=3·${fN(inp.SY)}2·${fN(inp.tX)}=${f(V.vmax_Y_sync,2)} m/s`);
  T(734, () => `a=9S2t2=9·${fN(inp.SY)}2·${fN(inp.tX)}2=${f(V.a_Y_sync,2)} m/s2`);
  T(747, () => `sfr=vmax22a=${f(kZ.vmax,3)}22·${f(kZ.a,2)}=${f(V.sfr_Z,2)} m`);
  T(749, () => `sfr=vmax22a=${f(kY.vmax,3)}22·${f(kY.a,2)}=${f(V.sfr_Y,2)} m`);
  T(751, () => `sfr=vmax22a=${f(kX.vmax,3)}22·${f(kX.a,2)}=${f(V.sfr_X,2)} m`);
  T(754, () => `kM Imax=${f(mX.kM,2)}·${fi(V.conv_ales.Imax)}=${f(V.kM_Imax_X,2)} N·m`);
  T(756, () => `aqs=kM Imax rredJΣ=${f(V.kM_Imax_X,2)}·${m10(X.rred,3,-3)}${f(D.JS_X/1e-4,2)}·10-4=${f(V.aqs_X,1)} m/s2`);
  T(759, () => `sfr=vmax22 aqs=${f(kX.vmax,3)}22·${f(V.aqs_X,1)}=${f(V.sfr_qs_X,2)} m`);
  T(762, () => `sfr+0,03=${f(V.sfr_qs_X,2)}+0,03=${f(V.marja_X,2)} m`);
  T(768, () => `kM Imax=${f(mX.kM,2)}·${fi(V.conv_ales.Imax)}=${f(V.kM_Imax_X,2)} N·m`);
  T(771, () => `kM ImaxMmax=${f(V.kM_Imax_X,2)}${f(D.Mmax_X,2)}=${f(V.kM_Imax_X/D.Mmax_X,1)}`);
  T(773, () => `kM ImaxMmax=${f(V.kM_Imax_Y,2)}${f(D.Mmax_Y,2)}=${f(V.kM_Imax_Y/D.Mmax_Y,1)}`);
  T(776, () => `1,5 Mmax=1,5·${f(D.Mmax_Z,2)}=${f(V.lim_Z,2)} N·m`);
  T(778, () => `1,5 Mmax=1,5·${f(D.Mmax_Y,2)}=${f(V.lim_Y,2)} N·m`);
  T(780, () => `1,5 Mmax=1,5·${f(D.Mmax_X,2)}=${f(V.lim_X,2)} N·m`);
  T(783, () => `Mout=1,5 Mmax·i ηred=${f(V.lim_X,2)}·${X.i}·0,94=${fi(V.Mout_lim_X)} N·m`);
  T(786, () => `1,3 Mhold=1,3·${f(D.Mhold_p,3)}=${f(V.test_fruna,2)} N·m`);
  T(789, () => `Mhold=FG rredη=${f(V.FG_piesa,1)}·2,546·10-30,93=${f(D.Mhold_p,2)} N·m`);
  T(794, () => `E=12 mΣX vmax2=12·${fN(V.mSX_piesa)}·${f(kX.vmax,3)}2=${fi(V.Ekin_X)} J`);
  T(797, () => `n=60 vP=60·0,250,016=937,5 rot/min`);
  T(800, () => `nr=60 vπ dp=60·0,25π·${f(Y.dp_m, 5)}=${f(60 * 0.25 / (Math.PI * Y.dp_m), 1)} rot/min`);
  T(802, () => `nmot=nr i=46,9·${Y.i}=${fi(60 * 0.25 / (Math.PI * Y.dp / 1000) * Y.i)} rot/min`);
  T(811, () => `a=9S2t2=9·${fN(inp.SX)}2·${f(V.tX_whatif,2)}2=${f(V.a_whatif,1)} m/s2`);
  T(814, () => `a=9S2t2=9·${fN(inp.SX)}2·${f(V.tX_fez,1)}2=${f(V.a_fez,2)} m/s2`);

  return t;
}

module.exports = { build, f, fN, fi, m10, TH, NB, pp };
