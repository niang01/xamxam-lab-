# 10. Plan multilingue — WO (référence), FR, EN

## 10.1 Principes
1. **Le wolof est la langue de référence de l'interface** : sélectionné par défaut, présent dès la conception (clés de traduction partout, aucun texte en dur), testé sur chaque écran.
2. **Aucun texte wolof n'est inventé** par l'équipe de développement ni généré par l'IA sans validation : seuls les textes fournis ou validés par des locuteurs natifs désignés sont publiés comme « validés ».
3. **Terme scientifique sans équivalent validé** : conserver le terme scientifique (ex. « transistor ») et l'expliquer ; le glossaire indique « conserver le terme ».
4. Changer de langue ne fait perdre aucun travail (état client conservé, brouillons enregistrés).

## 10.2 Conséquence pratique (à valider)
Le wolof « de référence » signifie : interface conçue pour le wolof et circuit de traduction prioritaire. Mais tant que les textes wolof ne sont pas validés, un texte manquant s'affiche dans la **langue de repli choisie par l'utilisateur (FR ou EN)** avec la mention « traduction wolof en cours de validation ». Les textes sont **rédigés** en français (langue de travail de l'équipe), puis traduits en wolof et en anglais. Le contenu technique (cours) suit le même circuit.

## 10.3 Circuit de traduction
Export (JSON/CSV) → traduction par locuteurs natifs → import (validé automatiquement par décision de l'exploitant du 16/11/2026, ou brouillon à relire) → seuls les textes validés sont imposés à l'IA et utilisés dans les notifications → traduction automatique (MyMemory gratuit ou Google Cloud, au choix de l'exploitant) marquée `machine_translated` « à relire », jamais par-dessus une traduction humaine.

Rôles : au moins deux validateurs wolof (habilitation `validateur_traduction_wo`), un relecteur scientifique par domaine pour le glossaire.

## 10.4 IA multilingue
- Compréhension des demandes en WO/FR/EN ; réponse dans la langue de l'utilisateur ; en wolof, usage **imposé** du glossaire validé et mention « réponse générée, non validée » tant que la qualité n'est pas évaluée.
- Évaluation : jeu de questions wolof réelles collectées auprès d'utilisateurs, notées par les validateurs (compréhension, exactitude des termes).

## 10.5 Voix
| Fonction | Wolof | Français / anglais |
|---|---|---|
| Synthèse (TTS) | Service de synthèse wolof à choisir et à évaluer par les locuteurs (ex. Meta MMS-TTS) ; messages audio enregistrés pour les alertes critiques | Voix système / fournisseur |
| Reconnaissance (ASR) | Meta MMS (ASR multilingue incluant le wolof) ou modèle affiné sur corpus wolof — **à évaluer** (taux d'erreur mesuré sur un corpus de test réel) avant d'annoncer la fonction | Fournisseur ou API navigateur |
| Commandes vocales | Après validation de l'ASR ; confirmation affichée/lue avant toute action ; jamais de commande physique sur la seule voix | Idem |

## 10.6 Glossaire scientifique multilingue
Entrée : terme (FR/EN), domaine, définition, équivalent wolof **validé** ou décision « conserver le terme », explication en wolof validée, validateurs, sources. Utilisé par l'interface, l'Academy et l'IA.

## 10.7 Tests
Couverture de clés (aucun texte en dur — test automatique), rendu de chaque écran dans les trois langues (longueur des textes, absence de débordement), absence de traduction non validée affichée comme validée, changement de langue sans perte d'état.
