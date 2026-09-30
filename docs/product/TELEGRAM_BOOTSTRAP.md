# Telegram one-time bootstrap

Everything Telegram currently exposes through the Bot API is governed by
`src/telegram/config.ts` and the `telegram:plan`, `telegram:apply`, and
`telegram:verify` commands. Do not repeat Bot API configuration in BotFather.

The remaining one-time BotFather boundary is:

1. Configure `@BinratBot`'s **Main Mini App** URL as
   `https://binrat-edge-v0.pettevik.workers.dev/app/` if the profile-level
   Launch app button is desired.
2. Optionally upload Main Mini App preview media and configure its splash
   presentation. These are presentation-only and do not grant BINRAT evidence
   or user authority.
3. Keep inline mode, privacy mode, and private-topic settings at their existing
   values unless a separate product change explicitly governs them.

Telegram's current documentation assigns Main Mini App registration and its
profile previews to BotFather. The ordinary chat menu button is different and
is controlled through `setChatMenuButton` by this repository:

- <https://core.telegram.org/bots/webapps#launching-the-main-mini-app>
- <https://core.telegram.org/bots/webapps#launching-mini-apps-from-the-menu-button>

Bot profile photos are Bot API-controlled as of Bot API 9.4. Telegram exposes
presence and file identity on readback, but not the source asset's content
digest. BINRAT therefore applies the repository JPEG only when the bot has no
profile photo and reports exact content verification as unavailable rather
than replacing an existing photo on every run.
