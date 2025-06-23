import type { TronWeb } from '@qiaomcfe/qiaomc-tron-provider';

export interface IProviderApi {
  isQiaoMc?: boolean;
  request<T>({ method, params }: { method: string; params?: any }): Promise<T>;
  tronWeb?: TronWeb;
}

export interface IProviderInfo {
  uuid: string;
  name: string;
  inject?: string; // window.ethereum
}
