# Coco Vercel Telegram Bot

This is the stable version of the Coco Telegram bot.

## Environment variables

- `TELEGRAM_BOT_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_TABLE` optional, default `jobs`
- `ADMIN_TOKEN`

## Supabase setup

Run `supabase/schema.sql` in Supabase SQL Editor.

## Telegram webhook

After Vercel deploy, set:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<vercel-domain>/api/telegram&drop_pending_updates=true
```

## Test

Open:

```text
https://<vercel-domain>/api/health
```
