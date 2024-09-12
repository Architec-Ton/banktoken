import { DEFAULT_TIMEOUT, SUBWALLET_ID } from './imports/const';
import { HighloadWalletV3 } from '../wrappers/HighloadWalletV3';

import { toNano } from '@ton/core';
import { mnemonicToPrivateKey } from 'ton-crypto';
import { compile, NetworkProvider } from '@ton/blueprint';

import 'dotenv/config';

export async function run(provider: NetworkProvider) {
    const keyPair = await mnemonicToPrivateKey(process.env.WALLET_MNEMONIC!.split(' '));
    const code = await compile('HighloadWalletV3');

    const highloadWalletV3 = provider.open(
        HighloadWalletV3.createFromConfig(
            {
                publicKey: keyPair.publicKey,
                subwalletId: SUBWALLET_ID,
                timeout: DEFAULT_TIMEOUT
            },
            code
        )
    );

    await highloadWalletV3.sendDeploy(
        provider.sender(),
        toNano('0.05')
    );

    console.log(highloadWalletV3.address);
    await provider.waitForDeploy(highloadWalletV3.address);
}