import numpy as np, math
import matplotlib.pyplot as plt

# ============ DATE DIN FIȘA INDIVIDUALĂ (varianta 13) ============
mp, mg = 10, 3
SX, tX, mX, F0X = 1.8, 2.2, 70, 60
SY, tY, mY, F0Y = 0.9, 1.3, 22, 30
SZ, tZ, mZ, F0Z = 0.35, 0.8, 18, 35
alpha, mu, tp = 0.5, 0.01, 0.5
g = 9.81

# ============ DATE DIN CATALOG (Anexa A) ==========================
P_Z, eta_Z, Jp_Z, Jc_Z = 0.016, 0.93, 0.5e-4, 0.2e-4
Jr_Z, Jfr_Z, MN_Z = 0.28e-4, 0.03e-4, 1.27
P_Y, eta_Y, Jp_Y, Jc_Y = 0.025, 0.93, 3.0e-4, 0.6e-4
Jr_Y, MN_Y = 1.13e-4, 2.39
z, p_belt, i_red = 32, 0.010, 12
eta_c, eta_red, Jred, Jc_X = 0.96, 0.94, 0.08e-4, 0.2e-4
b_belt, m_belt_pm, rho = 0.032, 0.14, 7850
Jr_X, MN_X = 2.65e-4, 3.18

# ============ CINEMATICĂ =========================================
def kin(S, t): return 3*S/(2*t), 9*S/(2*t**2)
vZ, aZ = kin(SZ, tZ); vY, aY = kin(SY, tY); vX, aX = kin(SX, tX)
tD = max(tX, tY); Tc = 4*tZ + 2*tD + 2*tp

# ============ MASE ===============================================
m_mort = mZ + mg; m_cw = alpha*m_mort
mSZ = {'g': mZ+mg+m_cw, 'p': mZ+mg+mp+m_cw}
mSY = {k: mY+v for k, v in mSZ.items()}
mSX = {k: mX+v for k, v in mSY.items()}

# ============ RAZE DE RAPORTARE ȘI INERȚII =======================
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
out = 'C:/Users/DSV/Desktop/Lucrare/New folder/diagrame_sarcina_v13.png'
plt.savefig(out, dpi=200)
print('Saved:', out)
print('Tc =', Tc, 's')
for k, (s, MN) in res.items():
    print(f'{k}: Mech={mech(s):.2f} N·m, Mmax={max(abs(m) for _, m in s):.2f} N·m, sum t={sum(d for d, _ in s):.2f}/{Tc:.2f}')
