# Guide administrateur — XAM-XAM LAB

## Devenir administrateur
Le rôle n'est jamais attribué par formulaire : déclarez les adresses dans `XX_ADMIN_EMAILS`, puis créez le compte avec l'une d'elles (ou recréez-le si le compte existait avant la déclaration).

## Comptes et habilitations (Paramètres → Administration)
- **Désactiver / réactiver** un compte : effet immédiat (toutes ses sessions sont révoquées).
- **Habilitations nominatives** (justificatif obligatoire, date d'expiration facultative) :
  | Habilitation | Permet |
  |---|---|
  | Banc d'essai | confirmer des commandes et ouvrir des sessions sur des appareils « banc » |
  | Opération réelle | idem sur des appareils « réel » (avec référence d'autorisation et check-list) |
  | Télépilote drone (ANACIM) | sessions réelles sur un drone (en plus de « opération réelle ») |
  | Validateur traduction wolof | relire et valider les textes wolof |
  | Juré | (réservé aux concours) |
  Retirer une habilitation révoque aussi les préautorisations de niveau 5 de la personne.

## Traductions wolof
1. **Exporter** (CSV ou JSON) : toutes les clés avec le texte français et anglais de référence.
2. Confier le fichier à des traducteurs locuteurs natifs ; ne jamais faire générer le wolof par une IA. Les paramètres `{x}` doivent être conservés (sinon la ligne est rejetée). Clés `gloss.<terme>` : glossaire scientifique imposé à l'IA (laisser le terme scientifique s'il n'existe pas d'équivalent validé).
3. **Importer** : « Valider les cellules remplies » (inscrit « Fichier importé par l'administrateur » au journal) ou « Brouillon à relire ». Seuls les textes validés s'affichent.
4. Les validateurs habilités relisent les brouillons ligne à ligne (leur nom est enregistré).

## Tableaux normatifs (Electrical Lab)
Saisir les tableaux de courants admissibles **depuis la norme achetée** (NF C 15-100, CEI 60364) : norme et édition, référence du tableau, mode de pose, nom de l'ingénieur validateur, lignes « section Iz ». Aucun tableau n'est fourni d'office.

## Bibliothèque de composants
Contrôler les références ajoutées par les utilisateurs contre leur fiche technique, puis « Marquer vérifié ».

## AI Command Center
- **Coupe-circuits** : IA (toutes opérations), automatisations, commandes d'équipements (les arrêts restent toujours possibles ; les sécurités matérielles ne dépendent pas de la plateforme).
- Activer/désactiver chaque **agent** ; suivre les opérations IA, simulations, équipements (révocation), automatisations (désactivation), sessions de télépilotage (fin), comptes à autonomie élevée (retour au niveau 2), ressources consommées.
- **Journal d'audit** : intégrité de la chaîne d'empreintes affichée ; toute modification d'une entrée est détectée.

## Modération (Tech News & annonces, écosystème)
Un contenu signalé par 3 personnes est masqué automatiquement ; les administrateurs sont notifiés et peuvent le masquer ou le rétablir.

## Modération de XAM-XAM MARKETPLACE
Onglet **Modération** de la rubrique (administrateurs uniquement) : signalements (motif, auteur, vendeur) et annonces masquées. Chaque décision exige un **motif écrit**, communiqué au vendeur : « Masquer l'annonce » (signalement retenu ; les autres signalements ouverts sur l'annonce sont clos) ou « Rejeter le signalement ». Depuis le détail d'une annonce : masquer / rétablir, marquer **sponsorisée** (toujours affiché comme tel). Toutes ces actions sont inscrites au journal d'audit.

## Configuration du serveur
Variables : [.env.example](../.env.example). Points clés : `SESSION_SECRET` (obligatoire), `ANTHROPIC_API_KEY` (+ `AI_DAILY_LIMIT`), `XX_PYTHON`, `METEOMATICS_USERNAME/PASSWORD`, `XX_TURN_*` (réunions entre réseaux différents), TLS MQTT. Santé : `GET /api/health`.

## Sauvegardes
Voir [SAUVEGARDE_RESTAURATION.md](SAUVEGARDE_RESTAURATION.md).
