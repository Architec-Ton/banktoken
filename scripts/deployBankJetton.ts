import { toNano } from '@ton/core';
import { BankJetton } from '../wrappers/BankJetton';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const bankJetton = provider.open(await BankJetton.fromInit());

    await bankJetton.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(bankJetton.address);

    // run methods on `bankJetton`
}
