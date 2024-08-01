import { buildOnchainMetadata } from '../utils/jetton-helpers';
import { ARCjettonParams } from './imports/const';
import * as AJ from '../build/ArcJetton/tact_ArcJetton';

import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const ownerAddress = Address.parse('')
    const arcJetton = provider.open(await AJ.ArcJetton.fromInit(ownerAddress, buildOnchainMetadata(ARCjettonParams)));

    await arcJetton.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(arcJetton.address);
}
