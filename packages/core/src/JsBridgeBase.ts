/* eslint-disable @typescript-eslint/ban-ts-comment */
import { isPlainObject, isString } from 'lodash-es';
import { CrossEventEmitter } from './CrossEventEmitter';
import { appDebugLogger, consoleErrorInDev } from './loggers';

import type { Web3ProviderError } from '@qiaomcfe/cross-inpage-provider-errors';
import { web3Errors, toNativeErrorObject } from '@qiaomcfe/cross-inpage-provider-errors';
import {
  IDebugLogger,
  IInjectedProviderNamesStrings,
  IJsBridgeCallback,
  IJsBridgeConfig,
  IJsBridgeMessagePayload,
  IJsBridgeMessageTypes,
  IJsonRpcResponse,
} from '@qiaomcfe/cross-inpage-provider-types';
import versionInfo from './versionInfo';

function toPlainError(errorInfo: IErrorInfo) {
  return {
    constructorName: errorInfo.constructorName,

    name: errorInfo.name,
    message: errorInfo.message,
    stack: errorInfo.stack,

    code: errorInfo.code,
    data: errorInfo.data as unknown,

    key: errorInfo.key, // i18n key
    info: errorInfo.info as unknown, // i18n params
    className: errorInfo.className,
    autoToast: errorInfo.autoToast,
    requestId: errorInfo.requestId,

    reconnect: errorInfo.reconnect,
    payload: errorInfo.payload,
  };
}

function isLegacyExtMessage(payload: unknown): boolean {
  const payloadObj = payload as { name: string };
  return (
    Boolean(payloadObj.name) &&
    ['qiaomc-provider-eth', 'qiaomc-provider-cfx', 'publicConfig'].includes(payloadObj.name)
  );
}

const globalWindow = typeof window !== 'undefined' ? window : global;

type IErrorInfo = Error & {
  constructorName?: string;

  // Error
  name?: string;
  message?: string;
  stack?: string;

  // Web3RpcError
  code?: string | number;
  data?: any;

  // QiaoMcError
  key?: string;
  info?: any;
  className?: string;
  autoToast?: boolean;
  requestId?: string;

  // QiaoMcHardwareError
  reconnect?: boolean;
  payload?: {
    code?: number | string;
    error?: string;
    message?: string;
    params?: any;
    connectId?: string;
    deviceId?: string;
  };
};

const BRIDGE_EVENTS = {
  message: 'message',
  error: 'error',
};

abstract class JsBridgeBase extends CrossEventEmitter {
  constructor(config: IJsBridgeConfig = {}) {
    super();
    this.config = config;
    this.callbacksExpireTimeout = config.timeout ?? this.callbacksExpireTimeout;
    this.debugLogger = config.debugLogger || appDebugLogger;
    this.sendAsString = config.sendAsString ?? this.sendAsString;
    if (this.config.receiveHandler) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      this.on(BRIDGE_EVENTS.message, this.globalOnMessage);
    }
    this.on(BRIDGE_EVENTS.error, (error) => {
      consoleErrorInDev('JsBridge ERROR: ', error, {
        code: (error as Web3ProviderError<any>)?.code,
      });
    });
    this.rejectExpiredCallbacks();
  }

  private _requestPayloadCache: Record<string | number, IJsBridgeMessagePayload> = {};

  protected isExtUi = false;

  protected isInjected = false;

  protected sendAsString = true;

  public globalOnMessageEnabled = true;

  public providersHub: Record<string, any[]> = {
    // name: []
  };

  public attachProviderInstance(provider: { providerName: string }) {
    const name = provider.providerName;
    if (name) {
      this.providersHub[name] = this.providersHub[name] ?? [];
      this.providersHub[name].push(provider);
    }
  }

  // Only handle type=REQUEST messages, type=RESPONSE message will be ignored
  private globalOnMessage = async (message: IJsBridgeMessagePayload) => {
    try {
      if (this.config.receiveHandler && this.globalOnMessageEnabled) {
        const returnValue: unknown = await this.config.receiveHandler(message, this);
        if (message.id) {
          this.response({
            id: message.id,
            scope: message.scope,
            remoteId: message.remoteId,
            data: returnValue,
            peerOrigin: message.origin,
          });
        }
      }
    } catch (error) {
      if (message.id && message.type === IJsBridgeMessageTypes.REQUEST) {
        this.responseError({
          id: message.id,
          scope: message.scope,
          remoteId: message.remoteId,
          error,
          peerOrigin: message.origin,
        });
      }
      this.emit(BRIDGE_EVENTS.error, error);
    } finally {
      // noop
    }
  };

  public version: string = versionInfo.version;

  public remoteInfo: {
    origin?: string;
    remoteId?: string | number | null;
  } = {
    origin: '',
    remoteId: '',
  };

  private config: IJsBridgeConfig;

  // TODO increase timeout as hardware sign transaction may take a long time
  //    can set timeout for each callback
  protected callbacksExpireTimeout: number = 10 * 60 * 1000;

  public debugLogger: IDebugLogger = appDebugLogger;

  private callbacks: IJsBridgeCallback[] = [];

  private callbackId = 1;

  private createCallbackId(): number {
    this.callbackId += 1;
    return this.callbackId;
  }

  private createPayload(
    payload: IJsBridgeMessagePayload,
    {
      resolve,
      reject,
    }: {
      resolve?: (value: unknown) => void;
      reject?: (value: unknown) => void;
    },
  ) {
    const { id, type } = payload;
    if (resolve && reject && id && type === IJsBridgeMessageTypes.REQUEST) {
      if (this.callbacks[id]) {
        // TODO custom error
        throw new Error(`JsBridge ERROR: callback exists, id=${id}`);
      }
      this.callbacks[id] = { id, resolve, reject, created: Date.now() };
    }

    // convert to plain error object which can be stringify
    if (payload.error) {
      const errorInfo = payload.error as IErrorInfo;
      payload.error = toPlainError(errorInfo);
    }
    // delete resolve, reject function which can not be send as string
    delete payload?.resolve;
    delete payload?.reject;

    return payload;
  }

  private send({
    type,
    data,
    error,
    id,
    remoteId,
    sync = false,
    scope,
    peerOrigin,
  }: IJsBridgeMessagePayload) {
    const executor = (resolve?: (value: unknown) => void, reject?: (value: unknown) => void) => {
      // TODO check resolve when calling without await
      // eslint-disable-next-line @typescript-eslint/naming-convention
      let _id = id;
      // sendSync without Promise cache
      if (!sync && type === IJsBridgeMessageTypes.REQUEST) {
        _id = this.createCallbackId();
      }
      try {
        const payload = this.createPayload(
          {
            id: _id,
            data,
            error,
            type,
            origin: globalWindow?.location?.origin || '',
            peerOrigin,
            remoteId,
            scope,
          },
          { resolve, reject },
        );
        let payloadToSend: unknown = payload;
        if (this.sendAsString) {
          payloadToSend = JSON.stringify(payload);
        }

        // @ts-ignore
        if (this.debugLogger.jsBridge?.enabled) {
          if (payload && payload.id && payload.type === IJsBridgeMessageTypes.REQUEST) {
            this._requestPayloadCache[payload.id] = payload;
            if (payload.id % 100 === 0) {
              this._requestPayloadCache = {};
            }
          }
        }
        this.debugLogger.jsBridge(
          'send',
          payload,
          '\r\n ------> ',
          payload.data,
          '\r\n ------> ',
          // @ts-ignore
          payload.data?.result,
        );

        this.sendPayload(payloadToSend as string);
      } catch (error) {
        if (_id) {
          this.rejectCallback(_id, error);
        } else {
          this.emit(BRIDGE_EVENTS.error, error);
        }
      }
    };
    if (sync) {
      executor();
      void 0;
    } else {
      return new Promise(executor) as Promise<IJsonRpcResponse<unknown>>;
    }
  }

  rejectCallback(id: number | string, error: unknown) {
    this.processCallback({
      method: 'reject',
      id,
      error,
    });
  }

  resolveCallback(id: number | string, data?: unknown) {
    this.processCallback({
      method: 'resolve',
      id,
      data,
    });
  }

  processCallback({
    method,
    id,
    data,
    error,
  }: {
    method: 'resolve' | 'reject';
    id: number | string;
    data?: unknown;
    error?: unknown;
  }) {
    const callbackInfo = this.callbacks[id as number];
    if (callbackInfo) {
      if (method === 'reject') {
        if (callbackInfo.reject) {
          callbackInfo.reject(error);
        }
        this.emit(BRIDGE_EVENTS.error, error);
      }
      if (method === 'resolve') {
        if (callbackInfo.resolve) {
          callbackInfo.resolve(data);
        }
      }
      this.clearCallbackCache(id);
    }
  }

  rejectExpiredCallbacks() {
    if (!this.callbacksExpireTimeout) {
      return;
    }
    const now = Date.now();
    const callbacksLength = this.callbacks.length;
    for (let id = 0; id < callbacksLength; id++) {
      const callbackInfo = this.callbacks[id];
      if (callbackInfo && callbackInfo.created) {
        if (now - callbackInfo.created > this.callbacksExpireTimeout) {
          const error = web3Errors.provider.requestTimeout();
          this.rejectCallback(id, error);
        }
      }
    }
    setTimeout(() => {
      this.rejectExpiredCallbacks();
    }, this.callbacksExpireTimeout);
  }

  clearCallbackCache(id: number | string) {
    delete this.callbacks[id as number];
  }

  public receive(
    payloadReceived: string | IJsBridgeMessagePayload = '',
    sender?: {
      origin?: string;
      internal?: boolean;
    },
  ) {
    let payload: IJsBridgeMessagePayload = {
      data: null,
    };

    if (isPlainObject(payloadReceived)) {
      payload = payloadReceived as IJsBridgeMessagePayload;
    }
    if (isString(payloadReceived)) {
      try {
        payload = JSON.parse(payloadReceived) as IJsBridgeMessagePayload;
      } catch (error) {
        this.emit(BRIDGE_EVENTS.error, error);
        throw new Error('JsBridge ERROR: JSON.parse payloadReceived failed');
      }
    }

    // !IMPORTANT: force overwrite origin and internal field
    //    DO NOT trust dapp params
    payload.origin = sender?.origin;
    payload.internal = Boolean(sender?.internal);

    // ignore legacy Ext publicConfig message
    if (sender?.internal && this.isExtUi && isLegacyExtMessage(payload)) {
      return;
    }

    if (!payload.origin && !this.isInjected) {
      consoleErrorInDev(this?.constructor?.name, '[payload.origin] is missing.', this);
      throw new Error('JsBridge ERROR: receive message [payload.origin] is required.');
    }

    if (!payload.internal && !payload.scope) {
      throw new Error(
        'JsBridge ERROR: receive message [payload.scope] is required for non-internal method call.',
      );
    }

    const relatedSendPayload = this._requestPayloadCache[payload?.id ?? ''] ?? null;
    this.debugLogger.jsBridge(
      'receive',
      payload,
      { sender },
      '\r\n -----> ',
      (payload.data as IJsonRpcResponse<any>)?.result ?? payload.data,
      '\r\n <----- ',
      relatedSendPayload?.data,
    );

    const { type, id, data, error, origin, remoteId } = payload;
    this.remoteInfo = {
      origin,
      remoteId,
    };

    if (type === IJsBridgeMessageTypes.RESPONSE) {
      if (id === undefined || id === null) {
        throw new Error(
          'JsBridge ERROR: parameter [id] is required in JsBridge.receive() when REQUEST type message',
        );
      }
      const callbackInfo = this.callbacks[id];
      if (callbackInfo) {
        try {
          if (error) {
            const errorObject = toNativeErrorObject(error); 
            this.rejectCallback(id, errorObject);
          } else {
            this.resolveCallback(id, data);
          }
        } catch (error0) {
          this.emit(BRIDGE_EVENTS.error, error0);
        } finally {
          // noop
        }
      }
    } else if (type === IJsBridgeMessageTypes.REQUEST) {
      const eventMessagePayload = {
        ...payload,
        created: Date.now(),
      };
      // https://nodejs.org/api/events.html#capture-rejections-of-promises
      // only type=REQUEST message will be handled by globalOnMessage
      this.emit(BRIDGE_EVENTS.message, eventMessagePayload);
    } else {
      throw new Error(`JsBridge ERROR: payload type not support yet (type=${type || 'undefined'})`);
    }
  }

  public requestSync({
    data,
    scope,
    remoteId,
  }: {
    data: unknown;
    scope?: IInjectedProviderNamesStrings;
    remoteId?: number | string | null;
  }): void {
    void this.send({
      id: undefined,
      type: IJsBridgeMessageTypes.REQUEST,
      scope,
      data,
      remoteId,
      sync: true,
    });
  }

  public request(info: {
    data: unknown;
    remoteId?: number | string | null;
    scope?: IInjectedProviderNamesStrings;
  }): Promise<IJsonRpcResponse<unknown>> | undefined {
    const { data, remoteId, scope } = info;
    if (data === undefined) {
      console.warn('JsBridge ERROR: data required. Call like `bridge.request({ data: {...} });`');
    }
    return this.send({
      type: IJsBridgeMessageTypes.REQUEST,
      data,
      remoteId,
      sync: false,
      scope,
    });
  }

  // send response DATA to remote
  public response({
    id,
    data,
    remoteId,
    scope,
    peerOrigin,
  }: {
    id: number;
    data: unknown;
    scope?: IInjectedProviderNamesStrings;
    remoteId?: number | string | null;
    peerOrigin?: string;
  }): void {
    void this.send({
      type: IJsBridgeMessageTypes.RESPONSE,
      data,
      id,
      remoteId,
      scope,
      sync: true,
      peerOrigin,
    });
  }

  // send response ERROR to remote
  public responseError({
    id,
    error,
    scope,
    remoteId,
    peerOrigin,
  }: {
    id: number;
    error: unknown;
    scope?: IInjectedProviderNamesStrings;
    remoteId?: number | string | null;
    peerOrigin?: string;
  }): void {
    void this.send({
      type: IJsBridgeMessageTypes.RESPONSE,
      error,
      id,
      remoteId,
      scope,
      sync: true,
      peerOrigin,
    });
  }

  abstract sendPayload(payload: IJsBridgeMessagePayload | string): void;
}

export { JsBridgeBase, isLegacyExtMessage };
