import { toNano } from '@ton/core';
import { CrowdSalev2 } from '../wrappers/CrowdSalev2';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const crowdSalev2 = provider.open(await CrowdSalev2.fromInit(BigInt(Math.floor(Math.random() * 10000))));

    await crowdSalev2.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(crowdSalev2.address);

    console.log('ID', await crowdSalev2.getId());
}
