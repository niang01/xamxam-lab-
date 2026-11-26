/**
 * Marème IA — assistante commerciale de la boutique XAM-XAM LAB.
 * Fonctionne SANS modèle de langage (mode « règles », signalé) : elle reconnaît l'intention de la demande puis répond
 * UNIQUEMENT à partir des données réelles (catalogue publié, stocks et prix déclarés par les vendeurs, commandes de
 * l'utilisateur, nomenclature d'une étude ou d'un projet, fiches génériques de la bibliothèque). Elle ne fixe ni ne
 * devine jamais un prix, un stock, une commande ou un paiement ; elle ne place rien dans le panier sans action de
 * l'utilisateur (elle propose des boutons « Ajouter au panier »).
 */
import type { User } from "./api";
import { sql } from "./db";
import { catalog, offersFor, orders } from "./shop";
import { paymentStatus } from "./payments";
import { myStudy } from "./studies";
import { requireProject } from "./access";
import { SHOP_SECTIONS } from "@/lib/shop";

export interface MaremeItem { id: string; title: string; price_xof: number | null; quantity: number | null; seller: string; seller_verified: boolean; delivery?: string[]; specs?: Record<string, string> | null }
export interface MaremeReply { intent: string; text: string[]; items: MaremeItem[]; mode: "rules"; sources: string[] }

const STATUS: Record<string, string> = { placed: "transmise au vendeur", confirmed: "confirmée par le vendeur (stock réservé)", shipped: "expédiée", delivered: "livrée", cancelled: "annulée", refused: "refusée par le vendeur", return_requested: "retour demandé", returned: "retournée (stock réintégré)", return_refused: "retour refusé par le vendeur" };
const DELIVERY: Record<string, string> = { pickup: "retrait chez le vendeur", shipping: "expédition / livraison organisée par le vendeur", digital: "remise numérique", onsite: "intervention sur site" };
const STOP = new Set(["je", "j", "veux", "voudrais", "cherche", "besoin", "un", "une", "des", "de", "du", "le", "la", "les", "pour", "mon", "ma", "mes", "avec", "et", "ou", "en", "à", "a", "au", "aux", "d", "l", "qui", "quel", "quelle", "quels", "est", "sont", "il", "y", "svp", "merci", "bonjour", "acheter", "trouver", "avez", "vous", "comparer", "compare", "comparez", "prix", "moins", "cher", "plus", "entre", "panier", "ajoute", "ajouter", "donne", "moi", "me", "combien", "coûte", "coute", "plaît", "plait", "stp", "voudrais", "aimerais", "quoi", "dispo", "disponible", "disponibles", "avoir", "faut"]);

const fcfa = (n: number | null) => (n == null ? "prix sur demande" : `${Number(n).toLocaleString("fr-FR")} FCFA`);
const stock = (q: number | null) => (q == null ? "stock non déclaré" : `stock déclaré : ${q}`);
const keywords = (m: string) => m.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((w) => (w.length > 2 || /\d/.test(w)) && !STOP.has(w));

async function search(words: string[]): Promise<MaremeItem[]> {
  if (!words.length) return [];
  const seen = new Map<string, MaremeItem>();
  for (const w of words.slice(0, 5)) for (const r of await catalog({ q: w, section: null, maxPrice: null }) as unknown as MaremeItem[]) {
    const hits = words.filter((x) => r.title.toLowerCase().includes(x)).length;
    if (hits && !seen.has(r.id)) seen.set(r.id, { ...r, price_xof: r.price_xof == null ? null : Number(r.price_xof), quantity: r.quantity == null ? null : Number(r.quantity) });
  }
  const hits = (i: MaremeItem) => words.filter((x) => i.title.toLowerCase().includes(x)).length;
  const best = Math.max(0, ...[...seen.values()].map(hits));
  // Seuls les articles qui correspondent le mieux à la demande sont présentés.
  return [...seen.values()].filter((i) => hits(i) === best).slice(0, 10);
}

export async function mareme(u: User, message: string, ctx: { study?: string | null; project?: string | null } = {}): Promise<MaremeReply> {
  const m = message.trim(), low = m.toLowerCase();
  const reply = (intent: string, text: string[], items: MaremeItem[] = [], sources: string[] = []): MaremeReply => ({ intent, text, items, mode: "rules", sources });

  // 1. Suivi des commandes de l'utilisateur
  if (/\b(ma|mes) commandes?\b|suivi|où en est|statut/.test(low)) {
    const list = (await orders(u, "buyer")).slice(0, 10) as unknown as { id: string; status: string; seller_name: string; created_at: string; items: { title: string; qty: number }[] }[];
    if (!list.length) return reply("orders", ["Vous n'avez passé aucune commande pour le moment."], [], ["Vos commandes"]);
    return reply("orders", ["Voici l'état de vos dernières commandes (statuts enregistrés par les vendeurs) :", ...list.map((o) => `• ${new Date(o.created_at).toLocaleDateString("fr-FR")} — ${o.seller_name} : ${o.items.map((i) => `${i.qty} × ${i.title}`).join(", ")} → ${STATUS[o.status] ?? o.status}`), "Le détail et l'historique sont dans l'onglet « Mes commandes »."], [], ["Vos commandes"]);
  }
  // 2. Paiement et livraison
  if (/paie|payer|paiement|carte bancaire|mobile money|wave|orange money|livraison|livrer|délai|expédi/.test(low)) {
    const p = paymentStatus();
    return reply("delivery", [p.message, "Modes de remise proposés par les vendeurs, selon l'article : retrait chez le vendeur, expédition/livraison organisée par le vendeur, remise numérique ou intervention sur site. Ils sont indiqués sur chaque fiche et choisis lors de la commande.", "XAM-XAM LAB n'assure pas lui-même la livraison ; les délais et frais éventuels sont à convenir avec le vendeur."], [], ["Configuration des paiements", "Fiches des articles"]);
  }
  // 3. Mise en relation humaine
  if (/vendeur|administrat|humain|réclamation|reclamation|litige|retour|rembours|garantie|contact/.test(low)) {
    return reply("human", ["Pour une question sur un article (garantie, retour, délai), écrivez au vendeur depuis la fiche de l'annonce dans XAM-XAM MARKETPLACE (bouton « Demander ») : l'échange reste tracé.", "Pour un litige ou un vendeur non conforme, signalez l'annonce : l'administrateur de la plateforme examine les signalements.", "Retour d'un article livré : onglet « Mes commandes » → « Demander un retour » avec le motif ; le vendeur l'accepte (stock réintégré) ou le refuse en motivant sa décision.", "Je ne peux ni accorder un remboursement ni modifier une commande : seuls le vendeur et l'administrateur le peuvent."], [], []);
  }
  // 4. Équipements d'une étude ou d'un projet
  if (ctx.study || ctx.project || /mon étude|ma nomenclature|mon projet/.test(low)) {
    let lines: { name: string; qty: number }[] = [];
    let src = "";
    if (ctx.study) { const s = await myStudy(ctx.study, u); lines = s.result.bom.map((b) => ({ name: b.name, qty: b.qty })); src = `Étude « ${s.title} »`; }
    else if (ctx.project) { await requireProject(ctx.project, u, "viewer"); lines = await sql<{ name: string; qty: number }>("SELECT name, qty FROM project_components WHERE project_id=$1", [ctx.project]); src = "Nomenclature du projet"; }
    if (lines.length) {
      const offers = await offersFor(lines.map((l) => l.name)) as Record<string, MaremeItem[]>;
      const found = lines.filter((l) => offers[l.name]?.length), missing = lines.filter((l) => !offers[l.name]?.length);
      return reply("bom", [`${src} : ${found.length} équipement(s) sur ${lines.length} ont au moins une offre en rayon.`, ...(missing.length ? [`Sans offre actuellement : ${missing.map((l) => l.name).join(", ")}.`] : []), "Vérifiez la compatibilité avec les caractéristiques calculées dans l'étude avant d'ajouter au panier."], found.flatMap((l) => offers[l.name].slice(0, 2)), [src, "Catalogue publié"]);
    }
  }
  // 5. Recherche / comparaison dans le catalogue réel
  const words = keywords(m);
  const items = await search(words);
  const compare = /compar|moins cher|meilleur prix|différence/.test(low);
  if (!items.length) {
    const lib = words.length ? await sql<{ name: string; description: string; params: { label: string; unit: string }[] }>("SELECT name, description, params FROM components WHERE mpn='generic' AND (name ILIKE '%'||$1||'%') LIMIT 3", [words[0]]) : [];
    return reply("search", [
      words.length ? `Aucun article en rayon ne correspond à « ${words.join(" ")} » pour le moment.` : "Dites-moi ce que vous cherchez (ex. « capteur de température », « batterie 12 V », « ESP32 »).",
      ...(lib.length ? [`Fiche générique de la bibliothèque : ${lib[0].name} — ${lib[0].description} Caractéristiques à vérifier sur l'offre : ${lib[0].params.map((p) => `${p.label}${p.unit ? ` (${p.unit})` : ""}`).join(", ")}.`] : []),
      `Rayons de la boutique : ${SHOP_SECTIONS.map(([, l]) => l).join(", ")}.`,
    ], [], ["Catalogue publié", ...(lib.length ? ["Bibliothèque de composants"] : [])]);
  }
  const priced = items.filter((i) => i.price_xof != null).sort((a, b) => a.price_xof! - b.price_xof!);
  const text = compare && items.length > 1
    ? ["Comparaison des offres en rayon (prix et stocks déclarés par les vendeurs) :", ...items.map((i) => `• ${i.title} — ${fcfa(i.price_xof)} — ${stock(i.quantity)} — ${i.seller}${i.seller_verified ? " (vendeur vérifié)" : ""}`), ...(priced.length ? [`Prix le plus bas déclaré : ${fcfa(priced[0].price_xof)} (${priced[0].title}, ${priced[0].seller}). Le prix ne dit rien de la qualité : comparez les fiches techniques.`] : [])]
    : [`${items.length} article(s) en rayon pour « ${words.join(" ")} » :`, ...items.map((i) => `• ${i.title} — ${fcfa(i.price_xof)} — ${stock(i.quantity)} — ${i.seller}${i.delivery?.length ? ` — ${i.delivery.map((d) => DELIVERY[d] ?? d).join(", ")}` : ""}`), "Touchez « Ajouter au panier » sous l'article choisi ; vous pourrez modifier la quantité dans le panier."];
  return reply(compare ? "compare" : "search", text, items, ["Catalogue publié"]);
}
