import { bytesToHex } from '@qiaomcfe/cross-inpage-provider-core';
/* eslint-disable tsdoc/syntax */
import type { IInpageProviderConfig } from '@qiaomcfe/cross-inpage-provider-core';
import { getOrCreateExtInjectedJsBridge } from '@qiaomcfe/extension-bridge-injected';
import { ProviderBfcBase } from './ProviderBfcBase';
import type * as TypeUtils from './type-utils';
import type { IJsonRpcRequest } from '@qiaomcfe/cross-inpage-provider-types';
import { web3Errors } from '@qiaomcfe/cross-inpage-provider-errors';
import { TransactionBlock } from '@benfen/bfc.js/transactions';

import { ALL_PERMISSION_TYPES, AccountInfo } from './types';
import type { PermissionType } from './types';
import {
  IdentifierString,
  BenfenSignAndExecuteTransactionBlockInput,
  BenfenSignAndExecuteTransactionBlockOutput,
  BenfenSignMessageInput,
  BenfenSignMessageOutput,
  BenfenSignPersonalMessageInput,
  BenfenSignPersonalMessageOutput,
  BenfenSignTransactionBlockInput,
  BenfenSignTransactionBlockOutput,
} from '@benfen/bfc.js/wallet-standard';

const PROVIDER_EVENTS = {
  'connect': 'connect',
  'disconnect': 'disconnect',
  'accountChanged': 'accountChanged',
  'networkChange': 'networkChange',
  'message_low_level': 'message_low_level',
} as const;

type BfcProviderEventsMap = {
  [PROVIDER_EVENTS.connect]: (account: string) => void;
  [PROVIDER_EVENTS.disconnect]: () => void;
  [PROVIDER_EVENTS.accountChanged]: (
    account: { address: string; publicKey: string } | null,
  ) => void;
  [PROVIDER_EVENTS.networkChange]: (name: string | null) => void;
  [PROVIDER_EVENTS.message_low_level]: (payload: IJsonRpcRequest) => void;
};

type SignAndExecuteTransactionBlockInput = BenfenSignAndExecuteTransactionBlockInput & {
  blockSerialize: string;
  walletSerialize: string;
};
type SignTransactionBlockInput = BenfenSignTransactionBlockInput & {
  blockSerialize: string;
  walletSerialize: string;
};
type SignMessageInput = BenfenSignMessageInput & { messageSerialize: string; walletSerialize: string };

type SignPersonalMessageInput = BenfenSignPersonalMessageInput & {
  messageSerialize: string;
  walletSerialize: string;
};

export type BenfenRequest = {
  'hasPermissions': (permissions: readonly PermissionType[]) => Promise<boolean>;

  'requestPermissions': (permissions: readonly PermissionType[]) => Promise<boolean>;

  'disconnect': () => Promise<void>;

  'getActiveChain': () => Promise<IdentifierString | undefined>;

  'getAccounts': () => Promise<AccountInfo[]>;

  'signAndExecuteTransactionBlock': (
    input: SignAndExecuteTransactionBlockInput,
  ) => Promise<BenfenSignAndExecuteTransactionBlockOutput>;

  'signTransactionBlock': (
    input: SignTransactionBlockInput,
  ) => Promise<BenfenSignTransactionBlockOutput>;

  'signMessage': (input: SignMessageInput) => Promise<BenfenSignMessageOutput>;

  'signPersonalMessage': (input: SignPersonalMessageInput) => Promise<BenfenSignPersonalMessageOutput>;
};

type JsBridgeRequest = {
  [K in keyof BenfenRequest]: (
    params: Parameters<BenfenRequest[K]>[0],
  ) => Promise<TypeUtils.WireStringified<TypeUtils.ResolvePromise<ReturnType<BenfenRequest[K]>>>>;
};

type JsBridgeRequestParams<T extends keyof JsBridgeRequest> = Parameters<JsBridgeRequest[T]>[0];

type JsBridgeRequestResponse<T extends keyof JsBridgeRequest> = ReturnType<JsBridgeRequest[T]>;

export type PROVIDER_EVENTS_STRINGS = keyof typeof PROVIDER_EVENTS;

export interface IProviderBfc {
  hasPermissions(permissions: readonly PermissionType[]): Promise<boolean>;

  requestPermissions(permissions: readonly PermissionType[]): Promise<boolean>;

  /**
   * Disconnect wallet
   */
  disconnect(): Promise<void>;

  /**
   * Connect wallet, and get wallet info
   * @emits `connect` on success
   */
  getAccounts(): Promise<AccountInfo[]>;
}

export type QiaoMcBfcProviderProps = IInpageProviderConfig & {
  timeout?: number;
};

function isWalletEventMethodMatch({ method, name }: { method: string; name: string }) {
  return method === `wallet_events_${name}`;
}

class ProviderBfc extends ProviderBfcBase implements IProviderBfc {
  protected _account: AccountInfo | null = null;

  constructor(props: QiaoMcBfcProviderProps) {
    super({
      ...props,
      bridge: props.bridge || getOrCreateExtInjectedJsBridge({ timeout: props.timeout }),
    });

    this._registerEvents();
  }

  private _registerEvents() {
    window.addEventListener('qiaomc_bridge_disconnect', () => {
      this._handleDisconnected();
    });

    this.on(PROVIDER_EVENTS.message_low_level, (payload) => {
      if (!payload) return;
      const { method, params } = payload;

      if (isWalletEventMethodMatch({ method, name: PROVIDER_EVENTS.accountChanged })) {
        this._handleAccountChange(params as AccountInfo | undefined);
      }

      if (isWalletEventMethodMatch({ method, name: PROVIDER_EVENTS.networkChange })) {
        this._handleNetworkChange(params as string);
      }
    });
  }

  private _callBridge<T extends keyof JsBridgeRequest>(params: {
    method: T;
    params: JsBridgeRequestParams<T>;
  }): JsBridgeRequestResponse<T> {
    return this.bridgeRequest(params) as JsBridgeRequestResponse<T>;
  }

  private _handleConnected(account: AccountInfo, options: { emit: boolean } = { emit: true }) {
    if (options.emit) {
      this.emit('connect', account?.address ?? null);
      this.emit(
        'accountChanged',
        account ? { address: account?.address, publicKey: account?.publicKey } : null,
      );
    }
  }

  private _handleDisconnected(options: { emit: boolean } = { emit: true }) {
    this._account = null;

    if (options.emit) {
      this.emit('disconnect');
      this.emit('accountChanged', null);
    }
  }

  isAccountsChanged(account: AccountInfo | undefined) {
    return account?.address !== this._account?.address;
  }

  // trigger by bridge account change event
  private _handleAccountChange(payload: AccountInfo | undefined) {
    if (!payload) {
      this._handleDisconnected();
      return;
    }

    if (this.isAccountsChanged(payload)) {
      this._handleConnected(payload);
    }

    this._account = payload;
  }

  private _network: string | null | undefined;
  isNetworkChanged(network: string) {
    return this._network === undefined || network !== this._network;
  }

  private _handleNetworkChange(payload: string) {
    const network = payload;
    if (this.isNetworkChanged(network)) {
      this.emit('networkChange', network || null);
    }
    this._network = network;
  }

  async hasPermissions(permissions: readonly PermissionType[] = ALL_PERMISSION_TYPES) {
    return await this._callBridge({
      method: 'hasPermissions',
      params: permissions,
    });
  }

  async requestPermissions(permissions: readonly PermissionType[] = ALL_PERMISSION_TYPES) {
    return await this._callBridge({
      method: 'requestPermissions',
      params: permissions,
    });
  }

  async disconnect(): Promise<void> {
    await this._callBridge({
      method: 'disconnect',
      params: void 0,
    });
    this._handleDisconnected();
  }

  async getAccounts() {
    const accounts = await this._callBridge({
      method: 'getAccounts',
      params: undefined,
    });
    if (accounts.length === 0) {
      this._handleDisconnected();
      throw web3Errors.provider.unauthorized();
    }
    return accounts;
  }

  async getActiveChain() {
    return this._callBridge({
      method: 'getActiveChain',
      params: undefined,
    });
  }

  async signAndExecuteTransactionBlock(
    input: BenfenSignAndExecuteTransactionBlockInput,
  ): Promise<BenfenSignAndExecuteTransactionBlockOutput> {
    return this._callBridge({
      method: 'signAndExecuteTransactionBlock',
      params: {
        ...input,
        // https://github.com/MystenLabs/sui/blob/ace69fa8404eb704b504082d324ebc355a3d2948/sdk/typescript/src/transactions/object.ts#L6-L17
        // With a few more objects, other wallets have steps for tojson.
        transactionBlock: TransactionBlock.from(input.transactionBlock.serialize()),
        walletSerialize: JSON.stringify(input.account),
        blockSerialize: input.transactionBlock.serialize(),
      },
    }) as Promise<BenfenSignAndExecuteTransactionBlockOutput>;
  }

  async signTransactionBlock(
    input: BenfenSignTransactionBlockInput,
  ): Promise<BenfenSignTransactionBlockOutput> {
    return this._callBridge({
      method: 'signTransactionBlock',
      params: {
        ...input,
        transactionBlock: TransactionBlock.from(input.transactionBlock.serialize()),
        walletSerialize: JSON.stringify(input.account),
        blockSerialize: input.transactionBlock.serialize(),
      },
    });
  }

  async signMessage(input: BenfenSignMessageInput): Promise<BenfenSignMessageOutput> {
    return this._callBridge({
      method: 'signMessage',
      params: {
        ...input,
        walletSerialize: JSON.stringify(input.account),
        messageSerialize: bytesToHex(input.message),
      },
    });
  }

  async signPersonalMessage(
    input: BenfenSignPersonalMessageInput,
  ): Promise<BenfenSignPersonalMessageOutput> {
    return this._callBridge({
      method: 'signPersonalMessage',
      params: {
        ...input,
        walletSerialize: JSON.stringify(input.account),
        messageSerialize: bytesToHex(input.message),
      },
    });
  }

  isConnected() {
    return this._account !== null;
  }

  onNetworkChange(listener: BfcProviderEventsMap['networkChange']): this {
    return super.on(PROVIDER_EVENTS.networkChange, listener);
  }

  onAccountChange(listener: BfcProviderEventsMap['accountChanged']): this {
    return super.on(PROVIDER_EVENTS.accountChanged, listener);
  }

  on<E extends keyof BfcProviderEventsMap>(event: E, listener: BfcProviderEventsMap[E]): this {
    return super.on(event, listener);
  }

  emit<E extends keyof BfcProviderEventsMap>(
    event: E,
    ...args: Parameters<BfcProviderEventsMap[E]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

export { ProviderBfc };
