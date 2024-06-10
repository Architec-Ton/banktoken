import { toNano } from '@ton/core';
import { BanksCrowdSaleV2 } from '../wrappers/BanksCrowdSaleV2';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const banksCrowdSaleV2 = provider.open(await BanksCrowdSaleV2.fromInit());

    await banksCrowdSaleV2.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        },
    );
    console.log(banksCrowdSaleV2.address);
    await provider.waitForDeploy(banksCrowdSaleV2.address);

    // run methods on `banksCrowdSaleV2`
    // run methods on `banksCrowdSale`
    // let newOwner = Address.parse('UQAeV4crAaUoCJo5igUIzosJXcOjtb4W7ff7Qr0DrgXPRle_'); //https://tonscan.org/address/UQAeV4crAaUoCJo5igUIzosJXcOjtb4W7ff7Qr0DrgXPRle_
    // await banksCrowdSale.send(
    //     provider.sender(),
    //     {
    //         value: toNano('0.005'),
    //     },
    //     {
    //         $$type: 'ChangeOwner',
    //         queryId: 0n,
    //         newOwner: newOwner
    //     }
    // );
}
