"""
Génère l'identité visuelle vectorielle de XAM-XAM LAB (propositions de logo, variantes, icônes).

    python3 design/identite/generer.py            # écrit design/identite/svg/*.svg

Tout est construit géométriquement (aucune image générée, aucun symbole repris d'une autre marque).
Le texte des logos est converti en tracés à partir des polices libres (SIL OFL) du dossier `polices/`,
pour que les fichiers SVG/PDF s'affichent à l'identique sans police installée.
Dépendance : fontTools + brotli (lecture des .woff2).
"""
from __future__ import annotations
import math
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ICI = Path(__file__).resolve().parent
SORTIE = ICI / "svg"

# Palette officielle (document « Identité visuelle », § 3)
NUIT = "#080D1B"
INGENIERIE = "#123B83"
CYAN = "#22D3EE"
VIOLET = "#8B5CF6"
BLANC = "#F8FAFC"
VERT = "#22C55E"
BLEU_ELEC = "#3B82F6"  # intermédiaire du dégradé cyan → bleu ingénierie (lisibilité sur fond nuit)


# ---------------------------------------------------------------- texte → tracés
class Police:
    def __init__(self, fichier: str):
        self.font = TTFont(ICI / "polices" / fichier)
        self.upm = self.font["head"].unitsPerEm
        self.cmap = self.font.getBestCmap()
        self.glyphs = self.font.getGlyphSet()
        self.hmtx = self.font["hmtx"]
        self.cap = getattr(self.font["OS/2"], "sCapHeight", 0) or self.upm * 0.7

    def trace(self, texte: str, x: float, y_base: float, taille: float, espacement: float = 0.0) -> tuple[str, float]:
        """Chemin SVG du texte (ligne de base y_base) et largeur totale."""
        k = taille / self.upm
        morceaux, cx = [], x
        for i, ch in enumerate(texte):
            nom = self.cmap.get(ord(ch))
            if nom is None:
                raise ValueError(f"Caractère absent de la police : {ch!r}")
            pen = SVGPathPen(self.glyphs)
            self.glyphs[nom].draw(TransformPen(pen, (k, 0, 0, -k, cx, y_base)))
            morceaux.append(pen.getCommands())
            cx += self.hmtx[nom][0] * k + (espacement if i < len(texte) - 1 else 0)
        return " ".join(m for m in morceaux if m), cx - x

    def hauteur_cap(self, taille: float) -> float:
        return self.cap * taille / self.upm


TITRE = Police("space-grotesk-latin-700-normal.woff2")
SIGNATURE = Police("inter-latin-600-normal.woff2")


# ---------------------------------------------------------------- symboles (repère 256 × 256)
def degrades(p: str, mono: str | None) -> str:
    if mono:
        return ""
    return f"""<defs>
  <linearGradient id="{p}-bras" x1="40" y1="40" x2="216" y2="216" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{CYAN}"/><stop offset="1" stop-color="{BLEU_ELEC}"/></linearGradient>
  <linearGradient id="{p}-bras2" x1="216" y1="40" x2="40" y2="216" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{CYAN}"/><stop offset=".55" stop-color="{BLEU_ELEC}"/><stop offset="1" stop-color="{VIOLET}"/></linearGradient>
  <linearGradient id="{p}-orbite" x1="0" y1="0" x2="256" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{VIOLET}"/><stop offset="1" stop-color="{CYAN}"/></linearGradient>
</defs>"""


def couleurs(p: str, mono: str | None, fond: str):
    if mono:
        return dict(b1=mono, b2=mono, orb=mono, coeur=mono, creux=fond, acc=mono)
    return dict(b1=f"url(#{p}-bras)", b2=f"url(#{p}-bras2)", orb=f"url(#{p}-orbite)", coeur=CYAN, creux=fond, acc=VIOLET)


def symbole_a(p="a", mono=None, fond=NUIT, simplifie=False) -> str:
    """A — « Nœud orbital » : X de deux pistes de circuit terminées par des pastilles, noyau d'IA central, orbite tissée."""
    c = couleurs(p, mono, fond)
    rx, ry, ang = 116, 36, -24
    orb_arr = f'<path d="M{128-rx} 128 A{rx} {ry} 0 0 1 {128+rx} 128" transform="rotate({ang} 128 128)" fill="none" stroke="{c["orb"]}" stroke-width="7" stroke-linecap="round" opacity="{1 if mono else .55}"/>'
    orb_av = f'<path d="M{128+rx} 128 A{rx} {ry} 0 0 1 {128-rx} 128" transform="rotate({ang} 128 128)" fill="none" stroke="{c["orb"]}" stroke-width="7" stroke-linecap="round"/>'
    pastilles = "".join(
        f'<circle cx="{x}" cy="{y}" r="11" fill="{c["creux"]}" stroke="{c["b1"] if i % 2 == 0 else c["b2"]}" stroke-width="7"/>'
        for i, (x, y) in enumerate([(50, 50), (206, 50), (206, 206), (50, 206)]))
    bras = (f'<path d="M58 58 L198 198" stroke="{c["b1"]}" stroke-width="30" stroke-linecap="butt"/>'
            f'<path d="M198 58 L58 198" stroke="{c["b2"]}" stroke-width="30" stroke-linecap="butt"/>')
    coeur = (f'<rect x="104" y="104" width="48" height="48" rx="6" transform="rotate(45 128 128)" fill="{c["creux"]}" stroke="{c["coeur"]}" stroke-width="6"/>'
             f'<rect x="119" y="119" width="18" height="18" rx="2" transform="rotate(45 128 128)" fill="{c["coeur"]}"/>')
    if simplifie:  # petit format (≤ 32 px) : X + noyau, sans orbite ni pastilles
        bras = (f'<path d="M40 40 L216 216" stroke="{c["b1"]}" stroke-width="40" stroke-linecap="round"/>'
                f'<path d="M216 40 L40 216" stroke="{c["b2"]}" stroke-width="40" stroke-linecap="round"/>')
        coeur = (f'<rect x="98" y="98" width="60" height="60" rx="8" transform="rotate(45 128 128)" fill="{c["creux"]}" stroke="{c["coeur"]}" stroke-width="10"/>'
                 f'<rect x="116" y="116" width="24" height="24" rx="3" transform="rotate(45 128 128)" fill="{c["coeur"]}"/>')
        return degrades(p, mono) + bras + coeur
    return degrades(p, mono) + orb_arr + bras + pastilles + orb_av + coeur


def symbole_b(p="b", mono=None, fond=NUIT, simplifie=False) -> str:
    """B — « Rencontre XAM·XAM » : deux chevrons qui se font face (deux savoirs) ; leur rencontre forme le X, un noyau hexagonal au centre."""
    c = couleurs(p, mono, fond)
    hexa = " ".join(f"{128 + 17 * math.cos(math.radians(30 + 60 * i)):.2f},{128 + 17 * math.sin(math.radians(30 + 60 * i)):.2f}" for i in range(6))
    traces = (f'<path d="M36 48 H18 M36 208 H18" stroke="{c["b1"]}" stroke-width="6" stroke-linecap="round"/>'
              f'<path d="M220 48 H238 M220 208 H238" stroke="{c["b2"]}" stroke-width="6" stroke-linecap="round"/>'
              f'<circle cx="14" cy="48" r="6" fill="{c["b1"]}"/><circle cx="14" cy="208" r="6" fill="{c["b1"]}"/>'
              f'<circle cx="242" cy="48" r="6" fill="{c["b2"]}"/><circle cx="242" cy="208" r="6" fill="{c["b2"]}"/>')
    chevrons = (f'<path d="M40 44 L108 128 L40 212" fill="none" stroke="{c["b1"]}" stroke-width="30" stroke-linejoin="miter"/>'
                f'<path d="M216 44 L148 128 L216 212" fill="none" stroke="{c["b2"]}" stroke-width="30" stroke-linejoin="miter"/>')
    coeur = f'<polygon points="{hexa}" fill="{c["coeur"]}"/>'
    return degrades(p, mono) + ("" if simplifie else traces) + chevrons + coeur


def symbole_c(p="c", mono=None, fond=NUIT, simplifie=False) -> str:
    """C — « Constellation » : X formé d'un réseau de quatre nœuds reliés à un noyau, dans une orbite ouverte portant un satellite."""
    c = couleurs(p, mono, fond)
    r = 104
    a0, a1 = math.radians(-60), math.radians(250)  # orbite ouverte (ouverture en haut à droite)
    x0, y0, x1, y1 = 128 + r * math.cos(a0), 128 + r * math.sin(a0), 128 + r * math.cos(a1), 128 + r * math.sin(a1)
    orbite = f'<path d="M{x0:.2f} {y0:.2f} A{r} {r} 0 1 1 {x1:.2f} {y1:.2f}" fill="none" stroke="{c["orb"]}" stroke-width="8" stroke-linecap="round"/>'
    sat = f'<circle cx="{128 + r * math.cos(math.radians(-75)):.2f}" cy="{128 + r * math.sin(math.radians(-75)):.2f}" r="9" fill="{c["acc"]}"/>'
    noeuds = [(70, 70), (186, 70), (186, 186), (70, 186)]
    liens = "".join(f'<path d="M128 128 L{x} {y}" stroke="{c["b1"] if i % 2 == 0 else c["b2"]}" stroke-width="22" stroke-linecap="round"/>' for i, (x, y) in enumerate(noeuds))
    pts = "".join(f'<circle cx="{x}" cy="{y}" r="16" fill="{c["creux"]}" stroke="{c["b1"] if i % 2 == 0 else c["b2"]}" stroke-width="8"/>' for i, (x, y) in enumerate(noeuds))
    coeur = f'<circle cx="128" cy="128" r="22" fill="{c["creux"]}" stroke="{c["coeur"]}" stroke-width="7"/><circle cx="128" cy="128" r="9" fill="{c["coeur"]}"/>'
    return degrades(p, mono) + ("" if simplifie else orbite + sat) + liens + pts + coeur


SYMBOLES = {"a": symbole_a, "b": symbole_b, "c": symbole_c}


# ---------------------------------------------------------------- compositions
def svg(largeur: float, hauteur: float, corps: str, titre: str, fond: str | None = None) -> str:
    rect = f'<rect width="{largeur}" height="{hauteur}" fill="{fond}"/>' if fond else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {largeur:g} {hauteur:g}" width="{largeur:g}" height="{hauteur:g}" role="img" aria-label="{titre.replace("&", "&amp;")}">'
            f"<title>{titre.replace("&", "&amp;")}</title>{rect}{corps}</svg>\n")


def mot_cle(x: float, y_base: float, taille: float, c_xam: str, c_lab: str) -> tuple[str, float]:
    d1, w1 = TITRE.trace("XAM-XAM", x, y_base, taille, espacement=taille * 0.02)
    d2, w2 = TITRE.trace("LAB", x + w1 + taille * 0.28, y_base, taille, espacement=taille * 0.02)
    return f'<path d="{d1}" fill="{c_xam}"/><path d="{d2}" fill="{c_lab}"/>', w1 + taille * 0.28 + w2


def signature(x: float, y_base: float, taille: float, couleur: str) -> tuple[str, float]:
    d, w = SIGNATURE.trace("GLOBAL AI ENGINEERING & INNOVATION", x, y_base, taille, espacement=taille * 0.16)
    return f'<path d="{d}" fill="{couleur}"/>', w


def theme(fond: str):
    clair = fond in (BLANC, "#FFFFFF", None)
    return dict(xam=NUIT if clair else BLANC, lab=INGENIERIE if clair else CYAN, sig="#334155" if clair else "#94A3B8", creux=fond or BLANC)


def horizontal(cle: str, fond: str | None = NUIT, mono: str | None = None) -> str:
    t = theme(fond)
    if mono:
        t.update(xam=mono, lab=mono, sig=mono)
    sym = SYMBOLES[cle](p=f"{cle}h", mono=mono, fond=t["creux"])
    s = 120 / 256
    mots, w = mot_cle(150, 76, 58, t["xam"], t["lab"])
    sig, ws = signature(152, 112, 13.2, t["sig"])
    largeur = 150 + max(w, ws) + 28
    corps = f'<g transform="translate(14 12) scale({s})">{sym}</g>{mots}{sig}'
    return svg(round(largeur), 144, corps, "XAM-XAM LAB — Global AI Engineering & Innovation", fond)


def vertical(cle: str, fond: str | None = NUIT, mono: str | None = None) -> str:
    t = theme(fond)
    if mono:
        t.update(xam=mono, lab=mono, sig=mono)
    _, w = mot_cle(0, 0, 54, "#000", "#000")
    _, ws = signature(0, 0, 12.4, "#000")
    largeur = max(w, ws) + 48
    mots, _ = mot_cle((largeur - w) / 2, 250, 54, t["xam"], t["lab"])
    sig, _ = signature((largeur - ws) / 2, 284, 12.4, t["sig"])
    sym = SYMBOLES[cle](p=f"{cle}v", mono=mono, fond=t["creux"])
    s = 176 / 256
    corps = f'<g transform="translate({(largeur - 176) / 2:.2f} 18) scale({s})">{sym}</g>{mots}{sig}'
    return svg(round(largeur), 308, corps, "XAM-XAM LAB — Global AI Engineering & Innovation", fond)


def symbole_seul(cle: str, fond: str | None = None, mono: str | None = None, simplifie=False) -> str:
    return svg(256, 256, SYMBOLES[cle](p=f"{cle}s", mono=mono, fond=fond or NUIT, simplifie=simplifie), "XAM-XAM LAB", fond)


def icone(cle: str, marge: float = 0.12, arrondi: float = 0.0, simplifie=False, fond=NUIT) -> str:
    """Icône carrée : fond bleu nuit, symbole ≈ 70 % de la surface utile (marge 12 % de chaque côté). `arrondi` : rayon relatif (0 = carré plein, l'OS découpe)."""
    taille = 1024
    s = taille * (1 - 2 * marge) / 256
    halo = f'<radialGradient id="halo" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="{INGENIERIE}"/><stop offset="1" stop-color="{fond}"/></radialGradient>'
    corps = (f'<defs>{halo}</defs><rect width="{taille}" height="{taille}" rx="{taille * arrondi:g}" fill="url(#halo)"/>'
             f'<g transform="translate({taille * marge:g} {taille * marge:g}) scale({s:.4f})">{SYMBOLES[cle](p=f"{cle}i", fond=fond, simplifie=simplifie)}</g>')
    return svg(taille, taille, corps, "XAM-XAM LAB")


def avant_plan_adaptatif(cle: str) -> str:
    """Android : avant-plan d'icône adaptative (108 dp, zone sûre 66 dp ⇒ symbole dans les 61 % centraux)."""
    taille = 432
    s = taille * 0.56 / 256
    m = taille * 0.22
    return svg(taille, taille, f'<g transform="translate({m:g} {m:g}) scale({s:.4f})">{SYMBOLES[cle](p=f"{cle}f", fond=NUIT)}</g>', "XAM-XAM LAB")


def ecrire(nom: str, contenu: str):
    SORTIE.mkdir(parents=True, exist_ok=True)
    (SORTIE / nom).write_text(contenu, encoding="utf8")


def main():
    for cle in SYMBOLES:  # les trois propositions, présentées à égalité
        ecrire(f"proposition-{cle}-symbole.svg", symbole_seul(cle, fond=NUIT))
        ecrire(f"proposition-{cle}-horizontal-sombre.svg", horizontal(cle, NUIT))
        ecrire(f"proposition-{cle}-horizontal-clair.svg", horizontal(cle, BLANC))
        ecrire(f"proposition-{cle}-icone.svg", icone(cle, arrondi=0.225))
        ecrire(f"proposition-{cle}-petit.svg", symbole_seul(cle, fond=NUIT, simplifie=True))
    # Déclinaisons complètes de la proposition recommandée (A) — à confirmer par l'exploitant.
    r = "a"
    ecrire("logo-horizontal-sombre.svg", horizontal(r, NUIT))
    ecrire("logo-horizontal-clair.svg", horizontal(r, BLANC))
    ecrire("logo-horizontal-transparent.svg", horizontal(r, None))
    ecrire("logo-horizontal-mono-noir.svg", horizontal(r, BLANC, mono="#000000"))
    ecrire("logo-horizontal-mono-blanc.svg", horizontal(r, "#000000", mono="#FFFFFF"))
    ecrire("logo-vertical-sombre.svg", vertical(r, NUIT))
    ecrire("logo-vertical-clair.svg", vertical(r, BLANC))
    ecrire("symbole.svg", symbole_seul(r))
    ecrire("symbole-mono-noir.svg", symbole_seul(r, fond="#FFFFFF", mono="#000000"))
    ecrire("symbole-petit-format.svg", symbole_seul(r, fond=NUIT, simplifie=True))
    ecrire("icone-application.svg", icone(r))                       # source Android (hérité) et iOS (1024, carré plein)
    ecrire("icone-favicon.svg", icone(r, marge=0.08, arrondi=0.2, simplifie=True))
    ecrire("icone-android-avant-plan.svg", avant_plan_adaptatif(r))
    print(f"{len(list(SORTIE.glob('*.svg')))} fichiers SVG dans {SORTIE}")


if __name__ == "__main__":
    main()
