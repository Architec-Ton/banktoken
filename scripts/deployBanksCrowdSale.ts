import { Address, toNano } from '@ton/core';
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
            query_id: 0n,
        },
    );

    await provider.waitForDeploy(banksCrowdSale.address);

    // run methods on `banksCrowdSale`
    let newOwner = Address.parse('UQAeV4crAaUoCJo5igUIzosJXcOjtb4W7ff7Qr0DrgXPRle_'); //https://tonscan.org/address/UQAeV4crAaUoCJo5igUIzosJXcOjtb4W7ff7Qr0DrgXPRle_
    await banksCrowdSale.send(
        provider.sender(),
        {
            value: toNano('0.005'),
        },
        {
            $$type: 'ChangeOwner',
            query_id: 0n,
            newOwner: newOwner,
        },
    );
}
