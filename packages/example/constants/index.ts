export const DEFAULT_APP_METADATA = {
  name: 'dApp Example',
  description: 'QiaoMc dApp Example for WalletConnect',
  url: 'https://dapp-example.qiaomctest.com/',
  icons: ['https://avatars.githubusercontent.com/u/37784886'],
  verifyUrl: 'https://verify.walletconnect.com',
};

export const DEFAULT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;
export const DEFAULT_RELAY_URL =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_RELAY_URL || 'wss://relay.walletconnect.com';
