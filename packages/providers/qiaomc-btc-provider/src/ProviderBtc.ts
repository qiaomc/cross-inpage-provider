import { getOrCreateExtInjectedJsBridge } from '@qiaomcfe/extension-bridge-injected';
import { ConsoleLike } from '@qiaomcfe/cross-inpage-provider-types';
import { web3Errors } from '@qiaomcfe/cross-inpage-provider-errors';

import { ProviderBtcBase } from './ProviderBtcBase';
import {
  IProviderBtc,
  QiaoMcBtcProviderProps,
  RequestArguments,
  ProviderState,
  ProviderEvents,
  ProviderMethods,
  ProviderEventsMap,
  MessageType,
  BalanceInfo,
  InscriptionInfo,
  Chain,
} from './types';
import { isWalletEventMethodMatch } from './utils';

class ProviderBtc extends ProviderBtcBase implements IProviderBtc {
  public readonly isQiaoMc = true;

  _selectedAddress: string | null = null;
  _networkId: string | null = null;
  _isConnected = false;
  _initialized = false;
  _isUnlocked = false;

  _state: ProviderState = {
    accounts: null,
    isConnected: false,
    isUnlocked: false,
    initialized: false,
    isPermanentlyDisconnected: false,
    isBtcWalletProvider: false,
  };

  private readonly _log: ConsoleLike;
  constructor(props: QiaoMcBtcProviderProps) {
    super({
      ...props,
      bridge: props.bridge || getOrCreateExtInjectedJsBridge({ timeout: props.timeout }),
    });

    this._log = props.logger ?? window.console;
    this.setMaxListeners(100);
    this._registerEvents();
    void this._initializeState();
  }

  private _registerEvents() {
    window.addEventListener('qiaomc_bridge_disconnect', () => {
      this._handleDisconnect();
    });

    this.on(ProviderEvents.MESSAGE_LOW_LEVEL, (payload) => {
      const { method, params } = payload;

      if (
        isWalletEventMethodMatch({
          method,
          name: ProviderEvents.ACCOUNTS_CHANGED,
        })
      ) {
        this._handleAccountsChanged(params as string[]);
      }

      if (isWalletEventMethodMatch({ method, name: ProviderEvents.NETWORK_CHANGED })) {
        this._handleNetworkChanged(params as string);
      }
    });
  }

  private async _initializeState() {
    try {
      const { networkId, accounts, isUnlocked } = await this._request<{
        accounts: string[];
        networkId: string;
        isUnlocked: boolean;
      }>({
        method: ProviderMethods.GET_PROVIDER_STATE,
      });

      if (isUnlocked) {
        this._isUnlocked = true;
        this._state.isUnlocked = true;
      }
      this.emit(ProviderEvents.CONNECT, {});
      this._handleNetworkChanged(networkId);

      this._handleAccountsChanged(accounts);
    } catch (error) {
      this._log.error('QiaoMc: Failed to get initial state. Please report this bug.', error);
    } finally {
      this._initialized = true;
    }
  }

  private _emit(event: ProviderEvents, data: any) {
    if (this._initialized) {
      this.emit(event, data);
    }
  }

  private _handleConnect(data: any) {
    if (!this._isConnected) {
      this._isConnected = true;
      this._state.isConnected = true;
      this._emit(ProviderEvents.CONNECT, data);
    }
  }

  private _handleDisconnect() {
    this._isConnected = false;
    this._state.isConnected = false;
    this._state.accounts = null;
    this._selectedAddress = null;
    const disconnectError = web3Errors.provider.disconnected();

    this._emit(ProviderEvents.ACCOUNTS_CHANGED, []);
    this._emit(ProviderEvents.ACCOUNT_CHANGED, []);
    this._emit(ProviderEvents.DISCONNECT, disconnectError);
    this._emit(ProviderEvents.CLOSE, disconnectError);
  }

  private _handleNetworkChanged(networkId: string) {
    this._handleConnect({});

    if (networkId !== this._networkId) {
      this._networkId = networkId;
      this._emit(ProviderEvents.NETWORK_CHANGED, networkId);
    }
  }

  private _handleAccountsChanged(accounts: string[]) {
    if (accounts?.[0] === this._selectedAddress) {
      return;
    }

    this._selectedAddress = accounts?.[0];
    this._state.accounts = accounts;
    this._emit(ProviderEvents.ACCOUNTS_CHANGED, accounts);
    this._emit(ProviderEvents.ACCOUNT_CHANGED, accounts);
  }

  protected async _request<T>(args: RequestArguments): Promise<T> {
    const { method, params } = args;

    if (!method || typeof method !== 'string' || method.length === 0) {
      throw web3Errors.rpc.methodNotFound();
    }

    if (
      params !== undefined &&
      !Array.isArray(params) &&
      (typeof params !== 'object' || params === null)
    ) {
      throw web3Errors.rpc.invalidParams();
    }

    const resp = await this.bridgeRequest(args);

    return resp as T;
  }

  // public methods
  async requestAccounts() {
    return this._request<string[]>({
      method: ProviderMethods.REQUEST_ACCOUNTS,
    });
  }

  async getAccounts() {
    return this._request<string[]>({
      method: ProviderMethods.GET_ACCOUNTS,
    });
  }

  async getNetwork() {
    return this._request<string>({
      method: ProviderMethods.GET_NETWORK,
    });
  }

  async switchNetwork(network: string) {
    return this._request<void>({
      method: ProviderMethods.SWITCH_NETWORK,
      params: { network },
    });
  }

  //https://docs.unisat.io/dev/unisat-developer-center/unisat-wallet/supported-chains
  async getChain() {
    return this._request<Chain>({
      method: ProviderMethods.GET_CHAIN,
    });
  }

  /**
   *
   * @param chain the chain. BITCOIN_MAINNET or BITCOIN_TESTNET or FRACTAL_BITCOIN_MAINNET
   * @returns
   */
  async switchChain(chain: string) {
    return this._request<Chain>({
      method: ProviderMethods.SWITCH_CHAIN,
      params: { chain },
    });
  }

  async getPublicKey() {
    return this._request<string>({
      method: ProviderMethods.GET_PUBLIC_KEY,
    });
  }

  async getBalance(): Promise<BalanceInfo | number> {
    return this._request<BalanceInfo>({
      method: ProviderMethods.GET_BALANCE,
    });
  }

  async getInscriptions(cursor = 0, size = 20) {
    return this._request<{
      total: number;
      list: InscriptionInfo[];
    }>({
      method: ProviderMethods.GET_INSCRIPTIONS,
      params: {
        cursor,
        size,
      },
    });
  }

  async sendBitcoin(toAddress: string, satoshis: number, options?: { feeRate: number }) {
    return this._request<string>({
      method: ProviderMethods.SEND_BITCOIN,
      params: {
        toAddress,
        satoshis,
        feeRate: options?.feeRate,
      },
    });
  }

  async sendInscription(toAddress: string, inscriptionId: string, options?: { feeRate: number }) {
    return this._request<string>({
      method: ProviderMethods.SEND_INSCRIPTION,
      params: {
        toAddress,
        inscriptionId,
        feeRate: options?.feeRate,
      },
    });
  }

  async signMessage(message: string, type: MessageType = 'ecdsa') {
    return this._request<string>({
      method: ProviderMethods.SIGN_MESSAGE,
      params: {
        message,
        type,
      },
    });
  }

  async pushTx(rawTx: string) {
    return this._request<string>({
      method: ProviderMethods.PUSH_TX,
      params: {
        rawTx,
      },
    });
  }

  async signPsbt(psbtHex: string, options: { autoFinalized: boolean } = { autoFinalized: true }) {
    return this._request<string>({
      method: ProviderMethods.SIGN_PSBT,
      params: {
        psbtHex,
        options,
      },
    });
  }

  async signPsbts(
    psbtHexs: string[],
    options: { autoFinalized: boolean } = { autoFinalized: true },
  ) {
    return this._request<string[]>({
      method: ProviderMethods.SIGN_PSBTS,
      params: {
        psbtHexs,
        options,
      },
    });
  }

  async pushPsbt(psbtHex: string) {
    return this._request<string>({
      method: ProviderMethods.PUSH_PSBT,
      params: {
        psbtHex,
      },
    });
  }

  async inscribeTransfer(ticker: string, amount: string) {
    return this._request<string>({
      method: ProviderMethods.INSCRIBE_TRANSFER,
      params: {
        ticker,
        amount,
      },
    });
  }

  async getVersion() {
    return Promise.resolve('1.4.10');
  }

  on<E extends ProviderEvents>(event: E, listener: ProviderEventsMap[E]): this {
    return super.on(event, listener);
  }

  off<E extends ProviderEvents>(event: E, listener: ProviderEventsMap[E]): this {
    return super.off(event, listener);
  }

  emit<E extends ProviderEvents>(event: E, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }
}

export { ProviderBtc };

export {
  IProviderBtc,
  ProviderState,
  ProviderEvents,
  ProviderMethods,
  ProviderEventsMap,
  MessageType,
  BalanceInfo,
  InscriptionInfo,
};
