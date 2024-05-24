import { Address, toNano } from '@ton/core';
import { BanksCrowdSaleV2 } from '../wrappers/BanksCrowdSaleV2';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    // run methods on `banksCrowdSaleV2`
    // const address = Address.parse( args.length > 0 ? args[0] : await ui.input('Crowdsale  address'));
    const address = Address.parse('EQAKBlWOqJDIEQ8t3jIAXO06N1s9utti-1JoVUuWCX_5yPIY');
    //                             EQAKBlWOqJDIEQ8t3jIAXO06N1s9utti-1JoVUuWCX_5yPIY
    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    const banksCrowdSaleV2 = provider.open(BanksCrowdSaleV2.fromAddress(address));

    // SetManager
    let manager = Address.parse('UQDwdIQ_Hx0A7ZkGz5L3OfDseIX-E9OgnOOkCyaQYKqi29RN');
    // const manager = Address.parse( args.length > 0 ? args[0] : await ui.input('manager  address'));
    //  await banksCrowdSaleV2.send(
    //         provider.sender(),
    //         {
    //             value: toNano('0.005'),
    //         },
    //         {
    //             $$type: 'SetManager',
    //             // query_id: 0n,
    //             to: manager
    //         }
    //     );
    // SetBankOffset
    // let bankOffset = 423300n;

    console.log('managerAfter:', await banksCrowdSaleV2.getManager());

    let counter = await banksCrowdSaleV2.getTotalBankers();
    console.log('getTotalBankers:', counter);

    const bankersOffset = BigInt(args.length > 0 ? args[0] : await ui.input('bankerOffset'));
    await banksCrowdSaleV2.send(
        provider.sender(),
        {
            value: toNano('0.005'),
        },
        {
            $$type: 'SetBankersOffset',
            // query_id: 0n,
            offset: bankersOffset,
        },
    );

    counter = await banksCrowdSaleV2.getTotalBankers();
    console.log('getTotalBankers after:', counter);

    //SetBankersOffset

    // SetBankOffset
    // let bankerOffset = 3150n;
    counter = await banksCrowdSaleV2.getTotalBanks();
    console.log('TotalBanks  before:', counter);

    const banksOffset = BigInt(args.length > 0 ? args[0] : await ui.input('banksOffset'));
    await banksCrowdSaleV2.send(
        provider.sender(),
        {
            value: toNano('0.005'),
        },
        {
            $$type: 'SetBankOffset',
            // query_id: 0n,
            offset: banksOffset,
        },
    );

    counter = await banksCrowdSaleV2.getTotalBanks();
    console.log('TotalBanks  after:', counter);

    // let newOwner = Address.parse('UQAeV4crAaUoCJo5igUIzosJXcOjtb4W7ff7Qr0DrgXPRle_'); //https://tonscan.org/address/UQAeV4crAaUoCJo5igUIzosJXcOjtb4W7ff7Qr0DrgXPRle_
    // await banksCrowdSaleV2.send(
    //     provider.sender(),
    //     {
    //         value: toNano('0.005'),
    //     },
    //     {
    //         $$type: 'ChangeOwner',
    //         query_id: 0n,
    //         newOwner: newOwner
    //     }
    // );
}
//http://103.219.170.103/api/v2
