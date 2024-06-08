import { toNano } from '@ton/core';
import { StakeStorage } from '../wrappers/StakeStorage';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const stakeStorage = provider.open(await StakeStorage.fromInit());

    await stakeStorage.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(stakeStorage.address);

    // run methods on `stakeStorage`
}
