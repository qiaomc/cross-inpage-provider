/* eslint-disable @typescript-eslint/no-use-before-define */
import { JsBridgeBase } from '@qiaomcfe/cross-inpage-provider-core';
import { IInjectedProviderNames } from '@qiaomcfe/cross-inpage-provider-types';

import messages from './messages';
import { ConsoleLike } from './utils';

/**
 * Sends site metadata over an RPC request.
 *
 * @param engine - The JSON RPC Engine to send metadata over.
 * @param log - The logging API to use.
 */
export default async function sendSiteMetadata(
  engine: JsBridgeBase,
  log: ConsoleLike,
): Promise<void> {
  try {
    const domainMetadata = await getSiteMetadata();
    // call engine.handle directly to avoid normal RPC request handling
    void engine.request({
      scope: IInjectedProviderNames.ethereum,
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'metamask_sendDomainMetadata',
        params: domainMetadata,
      },
    });
  } catch (error) {
    log.error({
      message: messages.errors.sendSiteMetadata(),
      originalError: error,
    });
  }
}

/**
 * Gets site metadata and returns it
 *
 */
async function getSiteMetadata() {
  return {
    name: getSiteName(window),
    icon: await getSiteIcon(window),
  };
}

/**
 * Extracts a name for the site from the DOM
 */
function getSiteName(windowObject: typeof window): string {
  const { document } = windowObject;

  const siteName: HTMLMetaElement | null = document.querySelector(
    'head > meta[property="og:site_name"]',
  );
  if (siteName) {
    return siteName.content;
  }

  const metaTitle: HTMLMetaElement | null = document.querySelector(
    'head > meta[name="title"]',
  );
  if (metaTitle) {
    return metaTitle.content;
  }

  if (document.title && document.title.length > 0) {
    return document.title;
  }

  return window.location.hostname;
}

/**
 * Extracts an icon for the site from the DOM
 * @returns an icon URL
 */
async function getSiteIcon(
  windowObject: typeof window,
): Promise<string | null> {
  const { document } = windowObject;

  const icons: NodeListOf<HTMLLinkElement> = document.querySelectorAll(
    'head > link[rel~="icon"]',
  );
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const iconsArr = icons as HTMLLinkElement[];
  for (const icon of iconsArr) {
    if (icon && (await imgExists(icon.href))) {
      return icon.href;
    }
  }

  return null;
}

/**
 * Returns whether the given image URL exists
 * @param url - the url of the image
 * @returns Whether the image exists.
 */
function imgExists(url: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      const img = document.createElement('img');
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    } catch (e) {
      reject(e);
    }
  });
}
