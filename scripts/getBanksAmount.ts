import { Address, toNano } from '@ton/core';
import { CrowdSale } from '../wrappers/CrowdSale';
import { NetworkProvider, sleep } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    // const address = Address.parse('EQByVJjaA9EM8SzoApOuF0eE2USMNB2kT8ZlMV1TmWLfhgLe');
    const address = Address.parse( args.length > 0 ? args[0] : await ui.input('Crowdsale  address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }
    // const addressBuyer = Address.parse('EQDOQbS74Sn-sGojYfUK6Uknlg8t1CdNjG-5VJx5VIO2zNms');
    const addressBuyer = Address.parse(args.length > 0 ? args[0] : await ui.input('Buyer address'));

    const cs = provider.open(CrowdSale.fromAddress(address));

    const counterBefore =await cs.getSomeoneBanksBalance(addressBuyer);
    ui.write('banks at address {addressBuyer} = {counterBefore}');

    
}
