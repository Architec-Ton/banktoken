import { toNano } from '@ton/core';
import { BankJetton } from '../wrappers/BankJetton';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const BankJetton = provider.open(await BankJetton.fromInit());

    await BankJetton.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        },
    );

    await provider.waitForDeploy(BankJetton.address);

    // run methods on `BankJetton`
}
