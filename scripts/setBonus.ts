import { Address, toNano } from '@ton/core';
import { BanksCrowdSale } from '../wrappers/BanksCrowdSale';
import { NetworkProvider, sleep } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    console.log('USE DEEPLINK TO TRANZACT!');
    const ui = provider.ui();

    // const address = Address.parse('EQByVJjaA9EM8SzoApOuF0eE2USMNB2kT8ZlMV1TmWLfhgLe');
    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('Crowdsale  address'));

    // const address = Address.parse('EQB8EPrSzysu6wAGH9JF6X2jIOah9wUs-5sHo8oK8afKsvDp');
    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    // const addressBuyer = Address.parse('EQDOQbS74Sn-sGojYfUK6Uknlg8t1CdNjG-5VJx5VIO2zNms');
    // const addressBuyer = Address.parse(args.length > 0 ? args[0] : await ui.input('Buyer address'));

    const cs = provider.open(BanksCrowdSale.fromAddress(address));
    const ownBefore = await cs.getOwner();

    console.log('owner ', ownBefore);

    // const addressBuyer = Address.parse(args.length > 0 ? args[0] : await ui.input('Buyer address'));

    const counterBefore = await cs.getBanks(ownBefore);

    console.log('counterBefore', counterBefore);

    // await cs.send(
    //     provider.sender(),
    //     {
    //         value: toNano('0.005'),
    //     },
    //     {
    //         $$type: 'Bonus',
    //         // queryId: 0n,
    //         to: ownBefore,
    //         amount: 1n,
    //     },
    // );

    const after = await cs.getBanks(ownBefore);

    console.log('counterafter', after);
}
