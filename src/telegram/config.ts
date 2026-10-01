export const TELEGRAM_PRODUCTION_ORIGIN = 'https://binrat-edge-v0.pettevik.workers.dev';
export const TELEGRAM_MINI_APP_URL = `${TELEGRAM_PRODUCTION_ORIGIN}/app/`;

export const telegramProductConfig = Object.freeze({
  identity: {
    username: 'BinratBot',
    name: 'BINRAT'
  },
  description: 'BINRAT digs through Pons garbage, remembers familiar paws and keeps the receipts. Fresh Garbage, Dig Deeper and Rat Watch. No buy/sell verdicts.',
  shortDescription: 'He gets the scraps. You get the receipts.',
  commandScopes: [
    {
      scope: { type: 'default' as const },
      commands: [
        { command: 'start', description: 'Wake the rat' },
        { command: 'rats', description: 'Fresh Garbage worth digging into' },
        { command: 'dig', description: 'Dig Deeper on an address' },
        { command: 'watches', description: 'Open Rat Watch' },
        { command: 'help', description: 'How BINRAT works' }
      ]
    },
    {
      scope: { type: 'all_private_chats' as const },
      commands: [
        { command: 'start', description: 'Wake the rat' },
        { command: 'rats', description: 'Fresh Garbage worth digging into' },
        { command: 'dig', description: 'Dig Deeper on an address' },
        { command: 'watches', description: 'Open Rat Watch' },
        { command: 'help', description: 'How BINRAT works' }
      ]
    }
  ],
  // The default menu remains the command list throughout the private beta.
  // The Mini App button is intentionally scoped to the selected tester below.
  globalMenuButton: {
    type: 'commands' as const
  },
  privateTesterMenuButton: {
    type: 'web_app' as const,
    text: 'OPEN BINRAT',
    web_app: { url: TELEGRAM_MINI_APP_URL }
  },
  miniApp: {
    url: TELEGRAM_MINI_APP_URL,
    authMaxAgeSeconds: 300
  },
  webhook: {
    url: `${TELEGRAM_PRODUCTION_ORIGIN}/telegram/webhook`,
    allowedUpdates: ['message', 'callback_query'] as const,
    mode: 'verify_only' as const
  },
  profilePhoto: {
    required: true,
    assetPath: 'web/assets/telegram/profile.jpg',
    verification: 'presence_only' as const
  },
  features: {
    autonomousRatEnabled: true,
    telegramUiV2Enabled: true,
    telegramMediaEnabled: true,
    autonomousRatPublicEnabled: false,
    controlledTesterRequired: true
  },
  botFatherOnly: [
    'Main Mini App registration and profile Launch app button',
    'Main Mini App preview media and splash-screen presentation',
    'Inline-mode, privacy-mode and topic settings'
  ]
});

export type TelegramProductConfig = typeof telegramProductConfig;
