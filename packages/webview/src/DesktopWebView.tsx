/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { LoadURLOptions } from 'electron';
import { consts } from '@qiaomcfe/cross-inpage-provider-core';
import {
  IElectronWebView,
  InpageProviderWebViewProps,
} from '@qiaomcfe/cross-inpage-provider-types';

import { JsBridgeDesktopHost } from './JsBridgeDesktopHost';
import { useIsIpcReady } from './useIsIpcReady';

import { IWebViewWrapperRef } from './useWebViewBridge';

import isNil from 'lodash/isNil';
import isEmpty from 'lodash/isEmpty';
import isPlainObject from 'lodash/isPlainObject';
import isArray from 'lodash/isArray';

const isDev = process.env.NODE_ENV !== 'production';
const isBrowser = true;

function usePreloadJsUrl() {
  const { preloadJsUrl } = window.QIAOMC_DESKTOP_GLOBALS ?? {};
  useEffect(() => {
    if (preloadJsUrl) {
      return;
    }
    const timer = setTimeout(() => {
      if (!preloadJsUrl) {
        console.error(`Webview render failed:
      Please send messages of channel SET_QIAOMC_DESKTOP_GLOBALS at app start
      `);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [preloadJsUrl]);
  return preloadJsUrl as string;
}

// Used for webview type referencing
const WEBVIEW_TAG = 'webview';

export function waitAsync(timeout: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

export async function waitForDataLoaded({
  data,
  wait = 600,
  logName,
  timeout = 0,
}: {
  data: (...args: any) => any;
  wait?: number;
  logName: string;
  timeout?: number;
}) {
  return new Promise<void>((resolve, reject) => {
    void (async () => {
      let timeoutReject = false;
      let timer: any = null;
      const getDataArrFunc = ([] as ((...args: any) => any)[]).concat(data);
      if (timeout) {
        timer = setTimeout(() => {
          timeoutReject = true;
        }, timeout);
      }
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let isAllLoaded = true;

        await Promise.all(
          getDataArrFunc.map(async (getData) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const d = await getData();
            if (d === false) {
              isAllLoaded = false;
              return;
            }

            if (isNil(d)) {
              isAllLoaded = false;
              return;
            }

            if (isEmpty(d)) {
              if (isPlainObject(d) || isArray(d)) {
                isAllLoaded = false;
                return;
              }
            }
          }),
        );

        if (isAllLoaded || timeoutReject) {
          break;
        }
        await waitAsync(wait);
        if (logName) {
          console.log(`waitForDataLoaded: ${logName}`);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      clearTimeout(timer);
      if (timeoutReject) {
        reject(new Error(`waitForDataLoaded: ${logName ?? ''} timeout`));
      } else {
        resolve();
      }
    })();
  });
}

const DesktopWebView = forwardRef(
  (
    {
      src,
      style,
      receiveHandler,
      onSrcChange,
      ...props
    }: React.ComponentProps<typeof WEBVIEW_TAG> & InpageProviderWebViewProps,
    ref: any,
  ) => {
    const [isWebviewReady, setIsWebviewReady] = useState(false);
    const webviewRef = useRef<IElectronWebView | null>(null);
    const isIpcReady = useIsIpcReady();
    const [devToolsAtLeft, setDevToolsAtLeft] = useState(false);

    if (props.preload) {
      console.warn('DesktopWebView:  custom preload url may disable built-in injected function');
    }

    useEffect(
      () => () => {
        // not working, ref is null after unmount
        webviewRef.current?.closeDevTools();
      },
      [],
    );

    // TODO extract to hooks
    const jsBridgeHost = useMemo(
      () =>
        new JsBridgeDesktopHost({
          webviewRef,
          receiveHandler,
        }),
      [receiveHandler],
    );

    useImperativeHandle(ref as React.Ref<unknown>, (): IWebViewWrapperRef => {
      const wrapper = {
        innerRef: webviewRef.current,
        jsBridge: jsBridgeHost,
        reload: () => webviewRef.current?.reload(),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        loadURL: (url: string, options?: LoadURLOptions) => {
          if (onSrcChange) {
            onSrcChange(url);
          } else {
            console.warn(
              'DesktopWebView: Please pass onSrcChange props to enable loadURL() working.',
            );
          }
          // use onSrcChange props change src
          //    do not need call ElectronWebView.loadURL() manually.
          // webviewRef.current?.loadURL(url);
        },
      };

      jsBridgeHost.webviewWrapper = wrapper;

      return wrapper;
    });

    const initWebviewByRef = useCallback(($ref) => {
      webviewRef.current = $ref as IElectronWebView;
      // desktop "ipc-message" listener must be added after webviewReady
      //    so use ref to check it
      setIsWebviewReady(true);
    }, []);

    useEffect(() => {
      const webview = webviewRef.current;
      if (!webview || !isIpcReady || !isWebviewReady) {
        return;
      }
      const handleMessage = async (event: {
        channel: string;
        args: Array<string>;
        target: IElectronWebView;
      }) => {
        if (event.channel === consts.JS_BRIDGE_MESSAGE_IPC_CHANNEL) {
          const data: string = event?.args?.[0];
          let originInRequest = '';
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            originInRequest = JSON.parse(data)?.origin as string;
          } catch (error) {
            // noop
          } finally {
            // noop
          }
          let origin = '';
          await waitForDataLoaded({
            wait: 600,
            logName: 'DesktopWebView waitForDataLoaded if origin matched',
            timeout: 5000,
            data: () => {
              let originInUrl = '';
              // url initial value is empty after webview mounted first time
              const url1 = event.target.getURL(); // url won't update immediately when goForward or goBack
              const url2 = event.target.src;
              const url3 = src;
              const url = url1 || url2 || url3;
              if (url) {
                try {
                  const uri = new URL(url);
                  originInUrl = uri?.origin || '';
                } catch (error) {
                  // noop
                } finally {
                  // noop
                }
              }
              if (originInUrl && originInRequest && originInUrl === originInRequest) {
                origin = originInRequest;
                return true;
              }
              return false;
            },
          });
          if (origin) {
            // - receive
            jsBridgeHost.receive(data, { origin });
          } else {
            // TODO log error if url is empty
          }
        }

        // response back
        // webview.send();
      };
      webview.addEventListener('ipc-message', handleMessage);
      return () => {
        webview.removeEventListener('ipc-message', handleMessage);
      };
    }, [jsBridgeHost, isIpcReady, isWebviewReady, src]);

    const preloadJsUrl = usePreloadJsUrl();

    if (!preloadJsUrl) {
      return null;
    }

    if (!isIpcReady) {
      return null;
    }

    return (
      <>
        {isDev && (
          <button
            type="button"
            style={{
              fontSize: 12,
              padding: 0,
              opacity: 0.6,
              position: 'absolute',
              right: devToolsAtLeft ? undefined : 0,
              left: devToolsAtLeft ? 0 : undefined,
            }}
            onClick={() => {
              setDevToolsAtLeft(!devToolsAtLeft);
              webviewRef.current?.openDevTools();
            }}
          >
            DevTools
          </button>
        )}

        {/* <div ref={ref} className="webview-container" /> */}
        {isBrowser && (
          <webview
            ref={initWebviewByRef}
            preload={preloadJsUrl}
            src={isIpcReady && isWebviewReady ? src : undefined}
            style={{
              'width': '100%',
              'height': '100%',
              ...style,
            }}
            // @ts-ignore
            allowpopups="true"
            // @ts-ignore
            nodeintegration="true"
            nodeintegrationinsubframes="true"
            webpreferences="contextIsolation=0, contextisolation=0, nativeWindowOpen=1"
            // mobile user-agent
            // useragent="Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1"
            {...props}
          />
        )}
      </>
    );
  },
);
DesktopWebView.displayName = 'DesktopWebView';

// TODO rename to DesktopWebViewLegacy
export { DesktopWebView };
