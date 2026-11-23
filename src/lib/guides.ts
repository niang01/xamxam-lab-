/**
 * Guides d'utilisation intégrés (français). Chaque guide décrit des écrans qui EXISTENT et ont été vérifiés ;
 * une fonction non disponible est signalée comme telle, jamais décrite comme opérationnelle.
 */
export interface GuideStep { title: string; body: string; link?: { href: string; label: string } }
export interface Guide { slug: string; title: string; audience: string; summary: string; steps: GuideStep[]; example?: string; limits?: string[] }

export const GUIDES: Guide[] = [
  {
    slug: "premiers-pas", title: "Première connexion et création du compte", audience: "Tous",
    summary: "Créer son compte, configurer son profil, se connecter depuis un téléphone, une tablette ou un ordinateur.",
    steps: [
      { title: "Ouvrir la plateforme", body: "Dans le navigateur (Chrome sur Android, Safari sur iPhone), ouvrez https://xamxam-lab.onrender.com. En offre gratuite, le premier chargement après une période d'inactivité peut prendre jusqu'à une minute : c'est normal." },
      { title: "Créer un compte", body: "Touchez « Créer un compte ». Saisissez votre nom, votre adresse électronique, un mot de passe d'au moins 10 caractères et votre profil (élève, étudiant, technicien, ingénieur…). Un essai gratuit de 90 jours démarre automatiquement.", link: { href: "/inscription", label: "Créer un compte" } },
      { title: "Configurer le profil", body: "L'écran « Bienvenue » s'ouvre : indiquez votre établissement ou entreprise, votre filière ou fonction, votre pays et vos compétences. Ces informations orientent Aláji IA et les modèles de projets. Touchez « Enregistrer et continuer ».", link: { href: "/bienvenue", label: "Mon profil" } },
      { title: "Se connecter et se déconnecter", body: "Page « Connexion » : adresse et mot de passe. La session reste ouverte 14 jours sur l'appareil. Le bouton « Déconnexion » en haut à droite ferme la session. Après 5 mots de passe incorrects, le compte est bloqué 15 minutes.", link: { href: "/connexion", label: "Connexion" } },
      { title: "Mot de passe oublié", body: "Sur la page de connexion, touchez « Mot de passe oublié ? ». Si l'envoi de courriels est activé, un lien valable 1 heure vous est envoyé. Sinon, l'administrateur génère un lien de réinitialisation (valable 24 h, usage unique) et vous le transmet." },
      { title: "Renforcer la sécurité", body: "Dans Paramètres → Sécurité, activez la double authentification (application de type Google Authenticator) et conservez vos codes de secours.", link: { href: "/settings", label: "Paramètres" } },
      { title: "Installer l'application", body: "Android : installez l'APK fourni par l'administrateur, ou dans Chrome, menu ⋮ → « Ajouter à l'écran d'accueil ». iPhone : Safari → Partager → « Sur l'écran d'accueil »." },
    ],
    example: "Exemple : Awa, étudiante en BTS électrotechnique, crée son compte avec le profil « Étudiant », indique son lycée technique et les compétences « électricité, Arduino », puis ouvre le guide du tableau de bord.",
  },
  {
    slug: "tableau-de-bord", title: "Le tableau de bord", audience: "Tous",
    summary: "Lire les compteurs, accéder aux actions rapides et retrouver ses travaux récents.",
    steps: [
      { title: "Les compteurs", body: "Projets, simulations, appareils connectés et hors ligne, commandes en attente, validations demandées par l'IA, tâches, cours. Chaque tuile ouvre la rubrique correspondante. Un tiret « — » signifie qu'aucune donnée n'est encore disponible." },
      { title: "Actions rapides", body: "Nouveau projet, nouveau schéma (Electronics Lab), connecter un appareil (passerelle IoT), poser une question à Aláji IA." },
      { title: "Travaux récents", body: "Les derniers projets et simulations s'affichent avec leur état (terminée, en cours, échec)." },
      { title: "Menu", body: "Sur téléphone, le bouton ☰ en haut à gauche ouvre le menu des rubriques ; sur ordinateur il est affiché à gauche. Le bouton ✦ ouvre le panneau d'Aláji IA sur n'importe quelle page." },
      { title: "Langue et thème", body: "Le sélecteur WO/FR/EN change la langue immédiatement. En wolof, seuls les textes validés par des locuteurs natifs s'affichent ; les autres apparaissent dans la langue de repli (français par défaut)." },
    ],
  },
  {
    slug: "licence", title: "Essai gratuit et licence", audience: "Tous",
    summary: "Comprendre l'essai de 90 jours et activer une licence.",
    steps: [
      { title: "Essai gratuit", body: "Chaque compte dispose de 90 jours d'accès complet à partir de sa création. Les jours restants s'affichent dans un bandeau et dans Licence. Les dates sont contrôlées par le serveur.", link: { href: "/licence", label: "Ma licence" } },
      { title: "À la fin de l'essai", body: "Vos données sont conservées. Les fonctions de travail (laboratoires, IA, projets…) demandent une licence ; Paramètres, Licence et Guides restent accessibles." },
      { title: "Activer une clé", body: "Licence → saisissez la clé reçue (format XXL-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX) → Activer. Une clé ne peut servir qu'au nombre de postes prévu." },
      { title: "Obtenir une licence", body: "Contactez l'administrateur de la plateforme. Le paiement en ligne (mobile money, carte bancaire) n'est pas encore disponible." },
    ],
  },
  {
    slug: "administrateur", title: "Guide de l'administrateur : comptes et licences", audience: "Administrateurs",
    summary: "Initialiser l'administrateur principal, gérer les comptes, les rôles, les habilitations et les licences.",
    steps: [
      { title: "Devenir administrateur principal", body: "Voie recommandée : sur Render, service xamxam-lab → Environment → Add Environment Variable : XX_ADMIN_EMAILS = votre adresse → Save Changes. Une fois le redéploiement terminé, connectez-vous (ou créez le compte) avec cette adresse : il devient administrateur. Voie de secours (tant qu'aucun administrateur n'existe) : Render → Logs, recopiez le « Code d'initialisation » sur la page Installation.", link: { href: "/installation", label: "Installation" } },
      { title: "Gérer les comptes", body: "Administration → Comptes : recherche, profil (rôle), désactivation, nomination d'autres administrateurs, déblocage après trop d'essais, vérification manuelle de l'adresse, prolongation de l'essai.", link: { href: "/admin", label: "Administration" } },
      { title: "Réinitialiser un mot de passe", body: "Bouton « Lien de réinitialisation » : un lien valable 24 h et à usage unique s'affiche une seule fois. Transmettez-le à la personne par un canal sûr (en main propre, message privé)." },
      { title: "Habilitations", body: "Opération réelle, banc d'essai, télépilote de drone, validateur de traduction wolof, jury : attribuées avec un justificatif et une date de validité. Elles conditionnent les commandes d'équipements réels." },
      { title: "Créer une catégorie de licence", body: "Administration → Licences → Catégories : code (ex. etudiant-annuel), nom, durée en jours, nombre de postes, prix indicatif en FCFA (information seulement)." },
      { title: "Émettre et attribuer", body: "« Émettre des licences » : choisissez la catégorie, le nombre de clés, éventuellement une organisation. Les clés s'affichent UNE seule fois : copiez-les. Pour attribuer directement à un compte, indiquez son adresse : la licence est activée sur ce compte." },
      { title: "Contrôler, renouveler, révoquer", body: "Liste des licences : postes utilisés, échéance, titulaires. « Renouveler » prolonge de N jours ; « Libérer le poste » retire un titulaire ; « Révoquer » désactive définitivement la licence. Tout est inscrit dans l'historique." },
      { title: "Sauvegarde", body: "Administration → Traductions et sauvegarde → « Télécharger une sauvegarde » : fichier JSON complet, à conserver chiffré." },
    ],
    limits: ["Le paiement en ligne n'est pas intégré : l'architecture prévoit qu'un futur module de paiement émette les licences par la même fonction que l'administrateur.", "Sans fournisseur de courriel configuré (XX_MAIL_PROVIDER, XX_MAIL_API_KEY, XX_MAIL_FROM), aucun courriel n'est envoyé : utilisez les liens de réinitialisation."],
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug) ?? null;
