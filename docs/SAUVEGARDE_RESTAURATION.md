# Sauvegarde et restauration — XAM-XAM LAB

## Ce qui est sauvegardé
Toutes les tables métier : comptes et habilitations, projets, schémas et versions, calculs, simulations, composants, IA (conversations, journal d'exécution, mémoire), appareils, mesures, commandes, automatisations, télépilotage, données géographiques en cache, cours et certificats, écosystème, traductions, notifications, réglages et journal d'audit chaîné. Les tables de signalisation des réunions (éphémères) sont exclues.

## Méthode 1 — sauvegarde portable JSON (toute base)
```bash
npm run db:backup                         # backups/xamxam-<date>.json (DATABASE_URL ou PGLITE_DIR)
npm run db:backup -- /chemin/fichier.json
```
Dans l'image Docker : `docker compose exec app node node_modules/tsx/dist/cli.mjs scripts/backup.mts /app/data/sauvegarde.json` (vérifié sur PostgreSQL 16).

Ou, sans accès au serveur : **Administration** → téléchargement par `GET /api/admin/backup` (administrateur ; action journalisée).

Le fichier contient une empreinte SHA-256 de son contenu et la liste des migrations appliquées.

### Restauration (base neuve uniquement)
```bash
DATABASE_URL=postgres://…/xamxam_neuve npm run db:restore -- fichier.json
```
- Refusée si la base cible contient déjà un compte (aucun écrasement possible).
- Refusée si l'empreinte ne correspond pas (fichier altéré ou tronqué) ou si la base cible est en retard de migrations.
- Exécutée en une transaction ; les compteurs sont réalignés ; la chaîne d'audit est vérifiée et le résultat affiché.

**Vérifié le 17/11/2026** : aller-retour complet (test d'intégration) et exécution réelle des commandes sur des bases PGlite sur disque (« Chaîne d'audit : intègre (11 entrées) » ; seconde restauration refusée).

## Méthode 2 — sauvegarde PostgreSQL native (production Docker)
```bash
docker compose exec db pg_dump -U xamxam -d xamxam -Fc -f /tmp/xamxam.dump
docker compose cp db:/tmp/xamxam.dump ./backups/xamxam-$(date +%F).dump
# Restauration dans une base vide :
docker compose cp ./backups/xamxam-AAAA-MM-JJ.dump db:/tmp/r.dump
docker compose exec db pg_restore -U xamxam -d xamxam --clean --if-exists /tmp/r.dump
```
**Vérifié** : `pg_dump` exécuté sur la pile Docker (38 tables de données dans l'archive).

## Politique recommandée
- Sauvegarde quotidienne (cron) + conservation 30 jours + copie hors site chiffrée (`gpg --symmetric` ou stockage chiffré).
- Les sauvegardes contiennent des données personnelles : accès restreint aux administrateurs.
- Test de restauration mensuel dans une base neuve (méthode 1), avec contrôle de la chaîne d'audit.
- Exemple de tâche planifiée : `0 2 * * * cd /opt/xamxam/app && npm run db:backup && find backups -mtime +30 -delete`.
