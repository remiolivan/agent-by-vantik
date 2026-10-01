# Backend Agent by Vantik (sauvegarde du 30/09/2026)

*Dossier volontairement nommé `backend-backup` (et non `supabase`) pour qu’aucun outil — CLI ou intégration GitHub de Supabase — ne réapplique ces migrations ou ne redéploie ces fonctions automatiquement.*

Copie du code **déployé** sur Supabase (projet `ppommcjfwwrvmtdinitw`). La source de vérité reste le code déployé : avant de modifier une fonction, relire la version en ligne (`get_edge_function`) et mettre à jour ce dossier ensuite.

## Edge functions

| Dossier | Version déployée | verify_jwt |
|---|---|---|
| `functions/stripe-webhook` | v41 | **non** (Stripe signe les requêtes) |
| `functions/lifecycle-emails` | v3 | **non** (header `x-cron-secret`) |
| `functions/create-checkout-session` | v44 | oui |
| `functions/create-portal-session` | v37 | oui |
| `functions/cancel-subscription` | v33 | oui |
| `functions/admin-api` | v22 | oui |

Redéployer : via le MCP Supabase (`deploy_edge_function`), ou avec le CLI après avoir copié le dossier dans `supabase/functions/` : `supabase functions deploy <nom>` (ajouter `--no-verify-jwt` pour `stripe-webhook`).

Secrets requis : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_SOLO_MONTHLY`, `STRIPE_PRICE_SOLO_ANNUAL`, `STRIPE_PRICE_TEAM_MONTHLY`, `STRIPE_PRICE_TEAM_ANNUAL` (+ `ANTHROPIC_API_KEY`, `CRON_SECRET` pour `admin-api`, `stripe-webhook` et `lifecycle-emails` ; `RESEND_API_KEY` pour `lifecycle-emails`). Aucune valeur n'est dans ce dossier.

## Migrations

Les fichiers de `migrations/` sont déjà appliqués en base (intégration Stripe, puis `email_log` le 30/09) : ne pas les réappliquer. Ils ne couvrent pas le schéma d'origine.

## Emails de cycle de vie (30/09/2026)

`lifecycle-emails` envoie via Resend (`alerts@getvantik.com`, reply-to `remi.olivan@getvantik.com`) : bienvenue J0 (après confirmation de l'email), pipeline vide J+1, mi-essai J-7, fin d'essai J-2, essai terminé J0, paiement confirmé, résiliation confirmée. Appelée par le cron `lifecycle-emails-15min` et par `stripe-webhook` (`{ org_id }`) juste après une synchro. Chaque email est enregistré dans `email_log` (unique par org + clé) : jamais envoyé deux fois. Orgs comped et suspendues exclues. Les échecs vont dans `app_errors`.
