import { toNano } from '@ton/core';
import { ArcJetton } from '../wrappers/ArcJetton';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const arcJetton = provider.open(await ArcJetton.fromInit());

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

    // run methods on `arcJetton`
}
