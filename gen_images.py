import json, math, sys
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

# Read variant data from JSON file
data_file = sys.argv[1]
out_dir = sys.argv[2]
with open(data_file) as f:
    d = json.load(f)

# ---- UNPACK ----
mp, mg = d['mp'], d['mg']
SX, tX, mX, F0X = d['SX'], d['tX'], d['mX'], d['F0X']
SY, tY, mY, F0Y = d['SY'], d['tY'], d['mY'], d['F0Y']
SZ, tZ, mZ, F0Z = d['hZ'], d['tZ'], d['mZ'], d['F0Z']
alpha, mu, tp = d['alpha'], d['mu'], d['tp']
g = 9.81

# ---- KINEMATICS ----
def kin(S, t): return 3*S/(2*t), 9*S/(2*t**2)
vZ, aZ = kin(SZ, tZ); vY, aY = kin(SY, tY); vX, aX = kin(SX, tX)
tD = max(tX, tY); Tc = 4*tZ + 2*tD + 2*tp

# ---- MASSES ----
m_mort = mZ + mg; m_cw = alpha*m_mort
mSZ = {'g': mZ+mg+m_cw, 'p': mZ+mg+mp+m_cw}
mSY = {k: mY+v for k, v in mSZ.items()}
mSX = {k: mX+v for k, v in mSY.items()}

# ---- CATALOG (variant 16 defaults; override from data if present) ----
P_Z = d.get('P_Z', 0.016); eta_Z = d.get('eta_Z', 0.93)
Jp_Z = d.get('Jp_Z', 0.5e-4); Jc_Z = d.get('Jc_Z', 0.2e-4)
Jr_Z = d.get('Jr_Z', 0.28e-4); Jfr_Z = d.get('Jfr_Z', 0.03e-4); MN_Z = d.get('MN_Z', 1.27)
P_Y = d.get('P_Y', 0.025); eta_Y = d.get('eta_Y', 0.93)
Jp_Y = d.get('Jp_Y', 3.0e-4); Jc_Y = d.get('Jc_Y', 0.6e-4)
Jr_Y = d.get('Jr_Y', 1.13e-4); MN_Y = d.get('MN_Y', 2.39)
z = d.get('z', 32); p_belt = d.get('p_belt', 0.010); i_red = d.get('i_red', 12)
eta_c = d.get('eta_c', 0.96); eta_red = d.get('eta_red', 0.94)
Jred = d.get('Jred', 0.08e-4); Jc_X = d.get('Jc_X', 0.2e-4)
b_belt = d.get('b_belt', 0.032); m_belt_pm = d.get('m_belt_pm', 0.14); rho = 7850
Jr_X = d.get('Jr_X', 2.65e-4); MN_X = d.get('MN_X', 3.18)

# ---- RAZE DE RAPORTARE ȘI INERȚII ----
rZ = P_Z/(2*math.pi); rY = P_Y/(2*math.pi)
dp = z*p_belt/math.pi; rX = dp/(2*i_red)
etaX = eta_c*eta_red
Js_Z = Jp_Z*(SZ+0.15); Js_Y = Jp_Y*(SY+0.15)
mr = rho*math.pi*(dp/2)**2*b_belt
Jroti = 2*0.5*mr*(dp/2)**2
mbelt = 2*(SX+0.3)*m_belt_pm
Jtr_X = Jroti + mbelt*(dp/2)**2
MJ_Z = (Jr_Z+Jfr_Z+(Js_Z+Jc_Z))*(aZ/rZ)
MJ_Y = (Jr_Y+(Js_Y+Jc_Y))*(aY/rY)
MJ_X = (Jr_X+Jred+(Jtr_X+Jc_X)/i_red**2)*(aX/rX)

def Mf(F, r, eta):
    return F*r/eta if F > 0 else F*r*eta

def horiz(mS, F0, a, r, eta, MJ):
    out = {}
    for k in ('p', 'g'):
        Ff = mu*mS[k]*g + F0; Fd = mS[k]*a
        out[k] = [Mf(Ff+Fd, r, eta)+MJ, Mf(Ff, r, eta), Mf(Ff-Fd, r, eta)-MJ]
    return out
Y = horiz(mSY, F0Y, aY, rY, eta_Y, MJ_Y)
X = horiz(mSX, F0X, aX, rX, etaX, MJ_X)

FG = {'p': (m_mort+mp-m_cw)*g, 'g': (m_mort-m_cw)*g}
def z_move(piece, s):
    k = 'p' if piece else 'g'
    Fd = mSZ[k]*aZ; Ff = F0Z
    Fs = [s*FG[k]+Ff+Fd, s*FG[k]+Ff, s*FG[k]+Ff-Fd]
    Ms = [Mf(F, rZ, eta_Z) for F in Fs]
    return [Ms[0]+MJ_Z, Ms[1], Ms[2]-MJ_Z]
Mh_p = FG['p']*rZ/eta_Z; Mh_g = FG['g']*rZ/eta_Z

segZ = []
segZ += [(tZ/3, m) for m in z_move(False, -1)]
segZ += [(tp, Mh_g)]
segZ += [(tZ/3, m) for m in z_move(True, +1)]
segZ += [(tD, Mh_p)]
segZ += [(tZ/3, m) for m in z_move(True, -1)]
segZ += [(tp, Mh_p)]
segZ += [(tZ/3, m) for m in z_move(False, +1)]
segZ += [(tD, Mh_g)]

def build_h(tmove, M):
    s = [(tZ + tp + tZ, 0)]
    s += [(tmove/3, M['p'][j]) for j in range(3)]
    s += [(tD-tmove, 0)] if tD > tmove else []
    s += [(tZ+tp+tZ, 0)]
    s += [(tmove/3, M['g'][j]) for j in range(3)]
    s += [(tD-tmove, 0)] if tD > tmove else []
    return s
segY = build_h(tY, Y); segX = build_h(tX, X)

def mech(seg):
    return math.sqrt(sum(d*m*m for d, m in seg)/Tc)

# ============ CICLOGRAMA ==========================================
fig, ax = plt.subplots(figsize=(8.3, 3.6))
blue, green, orange = '#dfe5f7', '#e2efd9', '#f8e5c8'
rows = ['axa Z', 'axa Y', 'axa X', 'prehensor']
ypos = {r: len(rows)-1-i for i, r in enumerate(rows)}
blocks = [
 ('axa Z', 0, tZ, 'coborâre\n(gol)', blue),
 ('axa Z', tZ+tp, tZ, 'ridicare\n(cu piesă)', blue),
 ('axa Z', tZ+tp+tZ+tD, tZ, 'coborâre\n(cu piesă)', blue),
 ('axa Z', tZ+tp+tZ+tD+tZ+tp, tZ, 'ridicare\n(gol)', blue),
 ('axa Y', tZ+tp+tZ, tY, 'deplasare Y (cu piesă)', green),
 ('axa Y', tZ+tp+tZ+tD+tZ+tp+tZ, tY, 'întoarcere Y (gol)', green),
 ('axa X', tZ+tp+tZ, tX, 'deplasare X (cu piesă)', green),
 ('axa X', tZ+tp+tZ+tD+tZ+tp+tZ, tX, 'întoarcere X (gol)', green),
 ('prehensor', tZ, tp, 'prindere', orange),
 ('prehensor', tZ+tp+tZ+tD+tZ, tp, 'eliberare', orange),
]
for r, s, dd, txt, c in blocks:
    y = ypos[r]
    ax.add_patch(Rectangle((s, y-0.3), dd, 0.6, fc=c, ec='black', lw=0.8))
    ax.text(s+dd/2, y, txt, ha='center', va='center', fontsize=7)
ax.set_xlim(0, Tc); ax.set_ylim(-0.6, 3.6)
ax.set_yticks(list(ypos.values())); ax.set_yticklabels(list(ypos.keys()), fontsize=10)
ax.set_xlabel('timp [s]')
ax.grid(axis='x', alpha=0.3)
ax.set_title(f'T$_c$ = 4t$_Z$ + 2 max(t$_X$, t$_Y$) + 2t$_p$ = {Tc:.1f} s  →  N = 3600/T$_c$ = {3600/Tc:.0f} cicluri/h',
             color='#b5541c', fontsize=10)
plt.tight_layout()
plt.savefig(f'{out_dir}/ciclograma.png', dpi=200)
plt.close()

# ============ DIAGRAME SARCINĂ =================================
res = {'Z': (segZ, MN_Z), 'Y': (segY, MN_Y), 'X': (segX, MN_X)}
for k, (s, MN) in res.items():
    tot = sum(d for d, _ in s)
    print(f'{k}: Mech={mech(s):.2f} N·m, Mmax={max(abs(m) for _, m in s):.2f} N·m, sum t={tot:.2f}/{Tc:.2f}')

fig, axs = plt.subplots(3, 1, figsize=(7.8, 7.8), sharex=True)
titles = {'Z': 'axa Z (vertical)', 'Y': 'axa Y (transversal)', 'X': 'axa X (longitudinal)'}
for ax, k in zip(axs, 'ZYX'):
    seg, MN = res[k]
    t = [0]; v = []
    for d, m in seg:
        v.append(m); t.append(t[-1]+d)
    ax.step(t, v+[v[-1]], where='post', color='#3b6fc9', lw=1.8)
    ax.fill_between(t, v+[v[-1]], step='post', color='#3b6fc9', alpha=0.15)
    Me = mech(seg)
    ax.axhline(Me, color='#c8682e', ls='--', lw=1.2)
    ax.text(Tc-0.1, Me+0.05*MN, f'M$_{{ech}}$ = {Me:.2f} N·m', color='#c8682e',
            ha='right', va='bottom', fontsize=8)
    for sgn in (1, -1): ax.axhline(sgn*MN, color='gray', ls=':', lw=1)
    ax.text(0.15, MN*0.92, f'M$_N$ = {MN:.2f} N·m ({titles[k]})', fontsize=8, color='#555', va='top')
    ax.set_title(titles[k], loc='left', fontsize=9)
    ax.set_xlim(0, Tc); ax.set_ylim(-MN*1.1, MN*1.1)
    ax.set_ylabel('M [N·m]'); ax.grid(alpha=0.3)
axs[-1].set_xlabel('timp în ciclu [s]')
plt.tight_layout()
plt.savefig(f'{out_dir}/diagrame_sarcina.png', dpi=200)
plt.close()
print('Done. Images saved to', out_dir)
