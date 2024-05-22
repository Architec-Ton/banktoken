import { toNano } from '@ton/core';
import { CrowdSaleJettons } from '../wrappers/CrowdSaleJettons';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const crowdSaleJettons = provider.open(await CrowdSaleJettons.fromInit());

    await crowdSaleJettons.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(crowdSaleJettons.address);

    // run methods on `crowdSaleJettons`
}
