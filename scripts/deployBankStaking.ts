import { toNano } from '@ton/core';
import { BankStaking } from '../wrappers/BankStaking';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const bankStaking = provider.open(await BankStaking.fromInit());

    await bankStaking.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        },
    );

    await provider.waitForDeploy(bankStaking.address);

    // run methods on `bankStaking`
}
