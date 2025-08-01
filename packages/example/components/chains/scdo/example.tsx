/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, no-unsafe-optional-chaining */
import { dapps } from './dapps.config';
import ConnectButton from '../../../components/connect/ConnectButton';
import { useRef } from 'react';
import { get } from 'lodash';
import { IProviderApi, IProviderInfo } from './types';
import { ApiPayload, ApiGroup } from '../../ApiActuator';
import { useWallet } from '../../../components/connect/WalletContext';
import type { IKnownWallet } from '../../../components/connect/types';
import DappList from '../../../components/DAppList';
import params from './params';
import { Input } from '../../ui/input';
import { ScdoNodeClient } from './rpc';
import BigNumber from 'bignumber.js';
import { useToast } from '../../ui/use-toast';
import { encodeTokenTransferPayload } from './utils';

// https://demo.scdo.org/
export default function Example() {
  const walletsRef = useRef<IProviderInfo[]>([
    {
      uuid: 'injected',
      name: 'Injected Wallet',
      inject: 'scdo',
    },
    {
      uuid: 'injected-qiaomc',
      name: 'Injected QiaoMc',
      inject: '$qiaomc.scdo',
    },
  ]);

  const client = new ScdoNodeClient();

  const { account, provider } = useWallet<IProviderApi>();
  const { toast } = useToast();

  const onConnectWallet = async (selectedWallet: IKnownWallet) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const providerDetail = walletsRef.current?.find((w) => w.uuid === selectedWallet.id);
    if (!providerDetail) {
      return Promise.reject('Wallet not found');
    }

    const provider = get(window, providerDetail.inject) as IProviderApi | undefined;

    const [address] = await provider?.request<string[]>({ method: 'scdo_requestAccounts' });

    return {
      provider,
      address: address,
    };
  };

  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  const getTokenTransferFrom = (chainId: string | undefined, approve: boolean = false) => {
    const tokens: {
      name: string;
      address: string;
    }[] = [];

    tokens.push({
      name: ' SCDO TEST0',
      // address: '1S015daca201b66f96f74b4230916f9db8db0c0002',
      address:'1S01f0daaf7a59fb5eb90256112bf5d080ff290022'
    });

    return (
      <>
        <Input
          label="收款地址"
          type="text"
          name="toAddress"
          defaultValue={account?.address ?? ''}
        />
        <Input label="金额" type="number" name="amount" defaultValue="10000" />

        {approve && (
          <>
            <div>
              <input id="max_approve" name="maxApprove" type="checkbox" />
              <label htmlFor="max_approve">无限授权</label>
            </div>
            <div>
              <input id="mock_uniswap" name="mockUniSwap" type="checkbox" />
              <label htmlFor="mock_uniswap">模拟 UniSwap（不传 Value）</label>
            </div>
          </>
        )}

        <select name="tokenAddress" className="select">
          <option selected value={undefined}>选择 Token</option>
          {tokens.map((token) => (
            <option value={token.address}>{token.name}</option>
          ))}
        </select>
      </>
    );
  };

  const tokenTransferFromToTx = async (fromData: Record<string, any>) => {
    const from = account?.address ?? '';
    const to = fromData.toAddress ?? from;
    const amount = fromData.amount;
    const tokenAddress = fromData.tokenAddress;

    if (!amount) {
      return 'Amount is required';
    }

    // 获取最新的 nonce
    const nonce = await client.getNonce(from);
    if (nonce === null) {
      throw new Error('获取 nonce 失败');
    }
    console.log('使用 nonce:', nonce);

    if (tokenAddress && tokenAddress !== 'SCDO') {
      const payload = encodeTokenTransferPayload({ address: to, amount });

      return JSON.stringify({
        accountNonce: nonce,  // 使用最新的 nonce
        from: from,
        to: tokenAddress,
        amount: 0,
        gasLimit: 100000,
        gasPrice: 1,
        payload: payload,
      });
    }

    return JSON.stringify({
      accountNonce: nonce,  // 使用最新的 nonce
      from: from,
      to: to,
      amount: new BigNumber(amount).toNumber(),
      gasLimit: 21000,
      gasPrice: 1,
      payload: '',
    });
  }

  return (
    <>
      <ConnectButton<IProviderApi>
        fetchWallets={() => {
          return Promise.resolve(
            walletsRef.current.map((wallet) => {
              return {
                id: wallet.uuid,
                name: wallet.name,
              };
            }),
          );
        }}
        onConnect={onConnectWallet}
        onDisconnect={async () => {
          await provider?.request({ method: 'scdo_disconnect' });
        }}
      />

      <ApiGroup title="Basics">
        <ApiPayload
          title="scdo_requestAccounts"
          description="请求链接账户"
          onExecute={async (request: string) => {
            return await provider?.request<string[]>({ method: 'scdo_requestAccounts' });
          }}
        />
        <ApiPayload
          title="scdo_getAccounts"
          description="获取账户"
          onExecute={async (request: string) => {
            return await provider?.request<string[]>({ method: 'scdo_getAccounts' });
          }}
        />
        <ApiPayload
          title="scdo_getBalance"
          description="获取账户余额"
          presupposeParams={[
            {
              id: 'scdo_getBalance',
              name: 'getBalance',
              value: account?.address,
            },
          ]}
          onExecute={async (request: string) => {
            const res = await provider?.request<string[]>({
              method: 'scdo_getBalance',
              params: [request ?? '', '', -1],
            });
            console.log('scdo_getBalance', res);

            return res;
          }}
        />
      </ApiGroup>

      <ApiGroup title="Sign Message">
        <ApiPayload
          title="scdo_signMessage"
          description="签署消息"
          onExecute={async (request: string) => {
            return await provider?.request<string>({
              method: 'scdo_signMessage',
              params: [request],
            });
          }}
          onValidate={async (request: string, response: string) => {
            return await provider?.request<string>({
              method: 'scdo_ecRecover',
              params: [request, response],
            });
          }}
        />
      </ApiGroup>

      <ApiGroup title="Sign Transaction">
        <ApiPayload
          title="scdo_estimateGas"
          description="估算交易费用"
          presupposeParams={params.signTransaction(account?.address ?? '', account?.address ?? '')}
          generateRequestFrom={() => getTokenTransferFrom(account?.chainId)}
          onGenerateRequest={tokenTransferFromToTx}
          onExecute={async (request: string) => {
            const tx = JSON.parse(request);
            return await provider?.request<string>({
              method: 'scdo_signTransaction',
              params: [tx],
            });
          }}
          onValidate={async (request: string, response: string) => {
            try {
              console.log('签名交易请求:', request);
              console.log('签名交易响应:', response);

              const res = JSON.parse(response) as {
                "Data": {
                  "Type": number,
                  "From": string,
                  "To": string,
                  "Amount": number,
                  "AccountNonce": number,
                  "GasPrice": number,
                  "GasLimit": number,
                  "Timestamp": number,
                  "Payload": string
                },
                "Hash": string,
                "Signature": {
                  "Sig": string
                }
              }
              return await provider?.request<string>({
                method: 'scdo_estimateGas',
                params: [{
                  'accountNonce': res.Data.AccountNonce,
                  'amount': res.Data.Amount,
                  'from': res.Data.From,
                  'to': res.Data.To,
                  'gasLimit': res.Data.GasLimit,
                  'gasPrice': res.Data.GasPrice,
                  'hash': res.Hash,
                  'payload': res.Data.Payload,
                  'signature': {
                    'Sig': res.Signature.Sig,
                  },

                }],
              });
            } catch (error) {
              console.error('估算 Gas 失败:', error);
              toast({
                title: '估算 Gas 失败',
                description: error instanceof Error ? error.message : '未知错误',
                variant: 'destructive',
              });
              return false;
            }
          }}
        />
        <ApiPayload
          title="scdo_signTransaction"
          description="签署交易"
          presupposeParams={params.signTransaction(account?.address ?? '', account?.address ?? '')}
          onExecute={async (request: string) => {
            const tx = JSON.parse(request);
            return await provider?.request<string>({
              method: 'scdo_signTransaction',
              params: [tx],
            });
          }}
          onValidate={async (request: string, response: string) => {
            try {
              console.log('签名交易请求:', request);
              console.log('签名交易响应:', response);

              const tx = JSON.parse(response);
              console.log('解析后的交易数据:', tx);

              // 检查交易数据结构
              if (!tx.Data || !tx.Hash || !tx.Signature?.Sig) {
                throw new Error('交易数据格式不正确');
              }

              // 检查必要字段
              const requiredFields = ['From', 'To', 'Amount', 'AccountNonce', 'GasPrice', 'GasLimit'];
              for (const field of requiredFields) {
                if (tx.Data[field] === undefined) {
                  throw new Error(`缺少必要字段: ${field}`);
                }
              }

              // 检查 nonce 值
              const currentNonce = await client.getNonce(tx.Data.From);
              console.log('当前 nonce:', currentNonce, '交易 nonce:', tx.Data.AccountNonce);

              if (tx.Data.AccountNonce < currentNonce) {
                throw new Error(`Nonce 值过低，当前 nonce: ${currentNonce}`);
              }

              // 使用 client 广播交易
              const success = await client.pushTransaction(tx.Data.From, tx);
              console.log('广播交易结果:', success);

              if (!success) {
                throw new Error('交易广播失败，请检查：\n1. 账户余额是否充足\n2. Gas 费用是否足够\n3. Nonce 值是否正确');
              }

              toast({
                title: '交易广播成功',
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                description: `交易哈希: ${get(tx, 'Hash', '')}`,
              });
              return true;
            } catch (error) {
              console.error('验证交易失败:', error);
              toast({
                title: '验证交易失败',
                description: error instanceof Error ? error.message : '未知错误',
                variant: 'destructive',
              });
              return false;
            }
          }}
          generateRequestFrom={() => getTokenTransferFrom(account?.chainId)}
          onGenerateRequest={tokenTransferFromToTx}
        />
        <ApiPayload
          title="scdo_sendTransaction"
          description="发送交易，动态生成"
          presupposeParams={params.signTransaction(account?.address ?? '', account?.address ?? '')}
          generateRequestFrom={() => getTokenTransferFrom(account?.chainId)}
          onGenerateRequest={tokenTransferFromToTx}
          onExecute={async (request: string) => {
            const tx = JSON.parse(request);
            return await provider?.request<string>({
              method: 'scdo_sendTransaction',
              params: [tx],
            });
          }}
        />
        <ApiPayload
          title="scdo_sendTransaction"
          description="发送交易，静态参数"
          presupposeParams={params.sendTransaction(account?.address ?? '', account?.address ?? '')}
          onExecute={async (request: string) => {
            const tx = JSON.parse(request);
            return await provider?.request<string>({
              method: 'scdo_sendTransaction',
              params: [tx],
            });
          }}
        />
      </ApiGroup>

      <DappList dapps={dapps} />
    </>
  );
}
