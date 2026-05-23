# TikTrack Telegram Bot

The Telegram bot is a parent-only control surface for quick TikTrack actions. Children do not need Telegram installed.

## Current Scope

- Link a Telegram parent account to a TikTrack family with a short-lived code.
- Start from `hi`, `/start`, or `/menu`.
- Pick child with Telegram buttons.
- Add a schedule as a task, event, or exam.
- Pick "No activity" or a configured activity.
- Hide invalid types for activities, for example no `Exam` option for an activity without the `exams` module.
- Parse simple schedule text such as:
  - `Physics exam next Friday 9am`
  - `Swimming class Saturday 6pm weekly`
  - `Reading practice tomorrow 7pm`
- Check same-child, same-title, same-day duplicates before creating.
- View today's schedules.
- View the next 7 days.
- Delete schedules from today's list.
- Delete schedules from the week list.
- Validate schedule end time is after start time.

## Firestore Collections

- `telegram_link_codes/{CODE}`: short-lived parent-generated link codes.
- `telegram_links/{telegramUserId}`: server-created Telegram parent links.
- `telegram_sessions/{telegramUserId}`: short-lived bot conversation state.

`telegram_links` and `telegram_sessions` are server-only in Firestore rules.

## Configure Secrets

Create a new dedicated Telegram bot with BotFather, for example `TikTrack Parent`.
Do not reuse a personal or unrelated bot.

Save the public bot username in TikTrack:

1. Open TikTrack as parent.
2. Go to `Settings -> Telegram`.
3. Enter the bot username without the token.

Then set the private bot token, webhook secret, and Mini App URL in Firebase Functions config:

```bash
firebase functions:config:set \
  telegram.bot_token="YOUR_BOT_TOKEN" \
  telegram.webhook_secret="A_LONG_RANDOM_SECRET" \
  telegram.mini_app_url="https://YOUR_HOSTING_DOMAIN/telegram" \
  telegram.mini_app_origin="https://YOUR_HOSTING_DOMAIN"
```

Or use the repeatable setup helper from this repo:

```bash
export TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"
export TELEGRAM_WEBHOOK_SECRET="A_LONG_RANDOM_SECRET"
export TELEGRAM_MINI_APP_URL="https://YOUR_HOSTING_DOMAIN/telegram"
npm run telegram:setup -- --deploy
```

The helper sets Functions config, optionally deploys functions/hosting/rules with `--deploy`, registers the Telegram webhook, and sets the bot menu button to open the TikTrack Mini App.

Deploy functions:

```bash
firebase deploy --only functions
```

Set the Telegram webhook:

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/telegramWebhook",
    "secret_token": "A_LONG_RANDOM_SECRET",
    "allowed_updates": ["message", "callback_query"]
  }'
```

Set the Mini App domain in BotFather:

```text
/mybots -> your bot -> Bot Settings -> Mini App
```

Use:

```text
https://YOUR_HOSTING_DOMAIN/telegram
```

The setup helper also calls Telegram `setChatMenuButton`, so parents can open the custom TikTrack UI from the bot's menu button. The inline `Open TikTrack Mini App` button in bot messages uses the same URL from `telegram.mini_app_url`.

## Parent Linking Flow

1. Open TikTrack as parent.
2. Go to `Settings -> Telegram`.
3. Generate a Telegram link code.
4. In Telegram, send the bot:

```text
/link CODE
```

The code expires after 15 minutes and is deleted after use.

## Bot Flow

```text
Parent: hi
Bot: Which child?
Parent taps child.
Bot: Open TikTrack Mini App / Add schedule / View today / View week / Routines / Rewards
Parent taps Add schedule.
Bot: Task / Event / Exam
Parent taps type.
Bot: No activity / configured activity list
Parent taps activity.
Bot asks for schedule text.
Parent: Physics exam next Friday 9am
Bot shows parsed summary and duplicate warning if needed.
Parent taps Create.
```

View/delete:

```text
Parent taps View today.
Bot shows today's tasks/events/exams with Delete buttons.
Parent taps Delete 1.
Bot deletes the item and refreshes today's list.

Parent taps View week.
Bot shows schedules for the next 7 days with Delete buttons for the first few items.
```

## Mini App Flow

```text
Parent opens bot.
Parent taps Open TikTrack Mini App.
Telegram opens /telegram inside Telegram.
Mini App sends Telegram initData to Firebase Functions.
Functions verifies the Telegram signature with the bot token.
Functions loads telegram_links/{telegramUserId}.
Mini App shows Add, Today, and Week tabs.
Add shows child/activity/type form.
Today shows schedules with Delete buttons.
Week shows the next 7 days with Delete buttons.
Create schedule calls telegramMiniAppCreateSchedule.
```

## Next Planned Work

- Richer recurring rules.
- Routines and rewards actions.
- Richer Mini App editing for existing schedules.
- Google Calendar sync.
