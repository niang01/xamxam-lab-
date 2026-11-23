# XAM-XAM LAB — état du projet (point de reprise)

Mis à jour à chaque étape. **Reprendre à partir de ce fichier, sans recommencer le projet.**
Dépôt : `niang01/xamxam-lab-` (branche `main`). Indépendant de SUUF (aucun fichier, service, base ni secret partagé).
En ligne : https://xamxam-lab.onrender.com (Render, plan free, déploiement automatique depuis `main` ; base Neon `xamxam-db`).

## Vérifié (exécuté, preuves dans docs/RAPPORT_DE_TESTS.md)
| Contrôle | Résultat |
|---|---|
| Typage strict, lint | ✅ 0 erreur |
| Tests unitaires + intégration | ✅ 159/159 (18 fichiers) |
| Parcours de bout en bout (Playwright) | ✅ 13/13 (ordinateur + Pixel 7) |
| Production : inscription, profil, connexion, déconnexion, session, tableau de bord | ✅ téléphone, tablette, ordinateur (23/11) |
| APK Android (debug, relié à l'adresse publique) | ✅ compilé ; ❌ non essayé sur un vrai téléphone |

## Réalisé le 23/11 (audit complet demandé par l'exploitant)
1. **Comptes** : clés serveur générées et conservées en base si absentes ; administrateur principal (XX_ADMIN_EMAILS, secours : code des journaux → /installation) ; configuration du profil (/bienvenue) ; mot de passe oublié / réinitialisation (/mot-de-passe-oublie, /reinitialisation) ; vérification d'adresse ; verrouillage après 5 échecs ; messages en français.
2. **Licences** : essai 90 jours, catégories, clés hachées, postes, attribution, renouvellement, révocation, historique, intégrité HMAC, contrôle serveur (HTTP 402) ; administration par onglets ; page /licence. Paiement : non intégré (architecture prête : `issueLicences`).
3. **Aláji IA** : renommage, fournisseur configurable (Anthropic / compatible OpenAI), analyse des demandes, agent vérificateur réel, rapports et suivi de projets, historique.
4. **Espaces** : Schémas 2D multidisciplines (/schemas) ; Studio : scénarios 4D (énergie, réservoir, chambre froide, bilans de conservation), maquette 3D paramétrique (masse, CdG, STL).
5. **Bibliothèque** : 127 composants génériques, 12 disciplines, paramètres avec unités.
6. **Projets** : 10 modèles × 6 niveaux, dossier complet, composants et budget, rapport et présentation (.md).
7. **Guides intégrés** (/guide) : première connexion, tableau de bord, Aláji IA, 2D, 3D/4D, bibliothèques, projets IoT, disciplines, licence, administrateur.
Audit détaillé : docs/AUDIT_DISCIPLINES.md.

## Action de l'exploitant
- Se connecter avec l'adresse déclarée dans `XX_ADMIN_EMAILS` (Render) : le compte devient administrateur principal.
- Facultatif : fournisseur de courriel (XX_MAIL_*) et d'IA (AI_PROVIDER…) — voir docs/GUIDE_INSTALLATION.md.
- Proposer la révocation de la clé d'API Render après le déploiement (lecture seule utilisée).

## Non disponible / non validé (affiché comme tel)
CAO volumique, éléments finis, dynamique des solides, émulation réseau, calcul réglementaire de structures, paiement en ligne, IA générative sans fournisseur configuré, drones : armement / décollage non validés sur SITL (aucun drone réel pilotable), Sentinel-2 / NDVI (lecture des bandes vérifiée, non intégrée).

## Prochaine tâche exacte
1. Vérifier en production les nouvelles pages après déploiement (schémas, studio, modèles, licence, admin) sur téléphone.
2. Sentinel-2 (recherche STAC + NDVI) ; validation SITL des drones.
