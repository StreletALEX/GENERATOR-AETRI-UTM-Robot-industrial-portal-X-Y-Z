import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

# ---- DATE DIN FIȘA INDIVIDUALĂ (varianta 16) ----
tZ, tX, tY, tp = 0.7, 2.0, 1.1, 0.4      # [s]
# --------------------------------------------------
tD = max(tX, tY)
Tc = 4*tZ + 2*tD + 2*tp
N = 3600/Tc

t1 = 0
t2 = t1 + tZ
t3 = t2 + tp
t4 = t3 + tZ
t5 = t4 + tD
t6 = t5 + tZ
t7 = t6 + tp
t8 = t7 + tZ

blue, green, orange = '#dfe5f7', '#e2efd9', '#f8e5c8'
rows = ['axa Z', 'axa Y', 'axa X', 'prehensor']
ypos = {r: len(rows)-1-i for i, r in enumerate(rows)}

blocks = [
 ('axa Z', t1, tZ, 'coborâre\n(gol)', blue),
 ('axa Z', t3, tZ, 'ridicare\n(cu piesă)', blue),
 ('axa Z', t5, tZ, 'coborâre\n(cu piesă)', blue),
 ('axa Z', t7, tZ, 'ridicare\n(gol)', blue),
 ('axa Y', t4, tY, 'deplasare Y (cu piesă)', green),
 ('axa Y', t8, tY, 'întoarcere Y (gol)', green),
 ('axa X', t4, tX, 'deplasare X (cu piesă)', green),
 ('axa X', t8, tX, 'întoarcere X (gol)', green),
 ('prehensor', t2, tp, 'prindere', orange),
 ('prehensor', t6, tp, 'eliberare', orange),
]

fig, ax = plt.subplots(figsize=(8.3, 3.6))
for r, s, d, txt, c in blocks:
    y = ypos[r]
    ax.add_patch(Rectangle((s, y-0.3), d, 0.6, fc=c, ec='black', lw=0.8))
    ax.text(s+d/2, y, txt, ha='center', va='center', fontsize=7)

ax.set_xlim(0, Tc); ax.set_ylim(-0.6, 3.6)
ax.set_yticks(list(ypos.values())); ax.set_yticklabels(list(ypos.keys()), fontsize=10)
ax.set_xlabel('timp [s]')
ax.grid(axis='x', alpha=0.3)
ax.set_title(f'T$_c$ = 4t$_Z$ + 2 max(t$_X$, t$_Y$) + 2t$_p$ = {Tc:.1f} s  →  N = 3600/T$_c$ = {N:.0f} cicluri/h',
             color='#b5541c', fontsize=10)
plt.tight_layout()
out = 'C:/Users/DSV/Desktop/Lucrare/New folder/ciclograma_v16.png'
plt.savefig(out, dpi=200)
print('Saved:', out)
print('Tc =', Tc, 's, N =', N, 'cicluri/h')
