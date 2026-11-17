# 9. Plan de cybersécurité et de gouvernance

## 9.1 Menaces principales
| Menace | Conséquence | Mesures |
|---|---|---|
| Vol de compte | Accès aux projets, commande d'équipements | scrypt, double authentification (TOTP, clés d'accès WebAuthn) **obligatoire** pour habilitations opérationnelles et administrateurs, limitation de débit, alertes de connexion |
| Injection d'instructions dans l'IA (documents, pages web, données d'appareils) | Actions non voulues | Politiques évaluées hors LLM, liste blanche d'outils par agent, contenus externes marqués « données non fiables », confirmation humaine pour toute action physique |
| Commande malveillante d'un appareil | Dommage matériel/humain | Chaîne de défense en profondeur (doc 07 §7.3), commandes signées et expirantes, limites dans le firmware |
| Évasion depuis une simulation ou du code utilisateur | Compromission serveur | Conteneurs jetables (gVisor/équivalent), sans réseau, utilisateur non privilégié, quotas ; nœuds de calcul séparés des données |
| Fuite de propriété intellectuelle | Perte de valeur des inventions | Projets privés par défaut, RLS, chiffrement au repos (stockage + sauvegardes), journal des accès, export filigrané en option |
| Appareil IoT compromis | Fausses mesures, rebond | Identité par appareil, ACL MQTT, détection d'anomalies, révocation immédiate |
| Abus de ressources (IA, calcul) | Coûts | Quotas, plafonds, détection d'abus |
| Secrets exposés | Compromission des services | Aucun secret client, chiffrement AES-256-GCM, rotation, masquage dans les journaux |

## 9.2 Contrôles
- **Authentification** : sessions `httpOnly`/`secure`/`sameSite`, jetons mobiles courts, révocation immédiate.
- **Autorisation** : RBAC plateforme + rôles d'organisation + ACL projet + permissions d'appareil + habilitations nominatives ; vérifiées côté serveur à chaque requête et par chaque outil IA.
- **API** : validation zod, requêtes paramétrées, CSP stricte, CORS restreint, limitation de débit par route/utilisateur/appareil.
- **Fichiers** : type réel vérifié, taille bornée, analyse antivirus des fichiers partagés.
- **Journalisation et audit** : journal append-only chaîné (empreintes), toute action IA tracée (plan, outil, entrée, sortie, coût, validation humaine).
- **Sauvegardes** : quotidiennes chiffrées, hors site, restauration testée mensuellement.
- **Incidents** : procédure (détection → confinement → éradication → reprise → retour d'expérience), rôle d'astreinte, notification des personnes concernées.
- **Protection des données** : loi sénégalaise n° 2008-12 sur les données personnelles (autorité : CDP) ; RGPD pour les utilisateurs européens ; consentements tracés, export et suppression des données.

## 9.3 Gouvernance de l'IA
- Coupe-circuit global et par agent (Command Center).
- Les protections critiques ne dépendent jamais exclusivement de l'IA (doc 07).
- Évaluations de sécurité de l'IA avant chaque changement d'agent (doc 05 §5.8).
- Concours, recrutement, modération : décisions finales humaines, recommandations IA expliquées et auditées.

## 9.4 Tests de sécurité
Analyse statique et des dépendances en CI, tests d'autorisation automatisés (chaque route × chaque rôle), tests d'injection d'instructions, test d'intrusion externe avant l'ouverture publique et avant l'activation des opérations réelles.
