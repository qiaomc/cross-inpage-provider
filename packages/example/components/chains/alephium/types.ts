import { PublicKey } from '@solana/web3.js';

export interface IProviderApi {
  isQiaoMc?: boolean;
  connect(): Promise<{
    publicKey: PublicKey;
  }>;
  signMessage(
    data: Uint8Array,
    display?: string,
  ): Promise<{
    signature: Uint8Array;
    publicKey: PublicKey;
  }>;
}

export interface IProviderInfo {
  uuid: string;
  name: string;
  inject?: string; // window.ethereum
}
