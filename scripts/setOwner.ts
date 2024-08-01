import { Address, toNano } from '@ton/core';
import { BanksCrowdSaleV2 } from '../wrappers/BanksCrowdSaleV2';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('Crowdsale  address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    const cs = provider.open(BanksCrowdSaleV2.fromAddress(address));
    const ownBefore = await cs.getOwner();
    console.log('ownBefore ', ownBefore);

    const newOwner = Address.parse(args.length > 0 ? args[0] : await ui.input('NewOwner  address'));

    await cs.send(
        provider.sender(),
        {
            value: toNano('0.005'),
        },
        {
            $$type: 'ChangeOwner',
            queryId: 0n,
            newOwner: newOwner,
        },
    );

    const newOwns = await cs.getOwner();
    console.log('newOwns ', newOwns);
}
