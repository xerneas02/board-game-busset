# Sous l’escalier

Petite ludothèque familiale, sans compte utilisateur. Node.js 22.12+ est recommandé.

## En local

```bash
npm ci
npm run dev
```

Ouvrir http://localhost:3000. La base SQLite est créée et alimentée automatiquement au premier lancement à partir de `data/seed-games.ts`. Les liens vers les règles et les sources des couvertures sont dans `data/seed-assets.ts`. Les 22 couvertures initiales sont déjà copiées dans `public/covers` ; `npm run covers` les retélécharge si nécessaire. Les règles des jeux traditionnels peuvent varier selon votre famille.

Vérifier avec `npm test` et `npm run build`, puis lancer la version de production avec `npm start`.

## VPS / Docker

Copier `.env.example` en `.env`, définir `FAMILY_PASSWORD` pour activer la protection, puis lancer :

```bash
docker compose up -d --build
```

Le navigateur demande l’identifiant `famille` et le mot de passe défini dans `.env`. Publier derrière un reverse-proxy HTTPS car HTTP Basic n’est pas chiffré sans HTTPS.

Sauvegarder régulièrement la base et les fichiers ajoutés :

```bash
docker compose cp sous-lescalier:/app/data/library.db ./library-backup.db
docker compose cp sous-lescalier:/app/public/uploads ./uploads-backup
```

Les volumes `game-data` et `game-uploads` persistent lors des mises à jour : récupérer le nouveau code puis relancer `docker compose up -d --build`. Ne supprimez pas les volumes si vous souhaitez conserver vos données.
