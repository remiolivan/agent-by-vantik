# Backend Agent by Vantik (sauvegarde du 30/09/2026)

*Dossier volontairement nommé `backend-backup` (et non `supabase`) pour qu’aucun outil — CLI ou intégration GitHub de Supabase — ne réapplique ces migrations ou ne redéploie ces fonctions automatiquement.*

Copie du code **déployé** sur Supabase (projet `ppommcjfwwrvmtdinitw`). La source de vérité reste le code déployé : avant de modifier une fonction, relire la version en ligne (`get_edge_function`) et mettre à jour ce dossier ensuite.

## Edge functions

| Dossier | Version déployée | verify_jwt |
|---|---|---|
| `functions/stripe-webhook` | v40 | **non** (Stripe signe les requêtes) |
| `functions/create-checkout-session` | v44 | oui |
| `functions/create-portal-session` | v37 | oui |
| `functions/cancel-subscription` | v33 | oui |
| `functions/admin-api` | v22 | oui |

Redéployer : via le MCP Supabase (`deploy_edge_function`), ou avec le CLI après avoir copié le dossier dans `supabase/functions/` : `supabase functions deploy <nom>` (ajouter `--no-verify-jwt` pour `stripe-webhook`).

Secrets requis : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_SOLO_MONTHLY`, `STRIPE_PRICE_SOLO_ANNUAL`, `STRIPE_PRICE_TEAM_MONTHLY`, `STRIPE_PRICE_TEAM_ANNUAL` (+ `ANTHROPIC_API_KEY`, `CRON_SECRET` pour `admin-api`). Aucune valeur n'est dans ce dossier.

## Migrations

Les deux fichiers de `migrations/` sont les migrations appliquées pendant l'intégration Stripe (déjà en base, ne pas les réappliquer). Ils ne couvrent pas le schéma d'origine.
