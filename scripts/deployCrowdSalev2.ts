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
        },
    );

    await provider.waitForDeploy(crowdSalev2.address);

    console.log('Address:', crowdSalev2.address);

    console.log('getBanker', await crowdSalev2.getBanker(provider.sender().address));
    console.log('getBanks', await crowdSalev2.getBanks(provider.sender().address));
    console.log('getCoins', await crowdSalev2.getCoins(provider.sender().address));
    console.log('getOwner', await crowdSalev2.getOwner());

    console.log('getAccounts', await crowdSalev2.getAccounts());
}
