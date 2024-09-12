import { buildOnchainMetadata } from '../utils/jetton-helpers';
import { BNKjettonParams } from './imports/const';
import * as BJ from '../build/BankJetton/tact_BankJetton';

import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const ownerAddress = Address.parse('')
    const bankJetton = provider.open(await BJ.BankJetton.fromInit(ownerAddress, buildOnchainMetadata(BNKjettonParams)));

    await bankJetton.send(
        provider.sender(),
        {
            value: toNano('0.07'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(bankJetton.address);
}
