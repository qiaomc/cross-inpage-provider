import { createNewImageToContainer, hackConnectButton } from '../hackConnectButton';
import { IInjectedProviderNames } from '@qiaomcfe/cross-inpage-provider-types';
import { WALLET_CONNECT_INFO } from '../consts';
import domUtils from '../utils/utilsDomNodes';

export default () => hackConnectButton({
  urls: ['app.hyperliquid.xyz'],
  providers: [IInjectedProviderNames.ethereum],
  replaceMethod(options) {
    const replaceFunc = ({
      findName,
      icon,
      text,
    }: {
      findName: string;
      icon: string;
      text: string;
    }) => {
      const walletBtnList = Array.from(
        document.querySelectorAll(`.modal.fullscreen button[color="gray"]`),
      ) as (HTMLElement | undefined)[];

      for (const walletBtn of walletBtnList) {
        if (walletBtn?.innerText === findName) {
          const textNode = domUtils.findTextNode(walletBtn, findName) as HTMLElement | undefined;
          textNode?.replaceWith(text);

          const img = walletBtn?.querySelector('img') as HTMLImageElement | undefined;
          if (img) {
            img.src = icon;
          }
        }
      }
    };

    if (options?.providers?.includes(IInjectedProviderNames.ethereum)) {
      replaceFunc({
        findName: 'MetaMask',
        icon: WALLET_CONNECT_INFO.metamask.icon,
        text: WALLET_CONNECT_INFO.metamask.text,
      });
      replaceFunc({
        findName: 'WalletConnect',
        icon: WALLET_CONNECT_INFO.walletconnect.icon,
        text: WALLET_CONNECT_INFO.walletconnect.text,
      });
    }
  },
});
