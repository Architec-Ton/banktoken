import { toNano } from '@ton/core';
import { BanksCrowdSale } from '../wrappers/BanksCrowdSale';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const banksCrowdSale = provider.open(await BanksCrowdSale.fromInit());

    await banksCrowdSale.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(banksCrowdSale.address);

    // run methods on `banksCrowdSale`
}
