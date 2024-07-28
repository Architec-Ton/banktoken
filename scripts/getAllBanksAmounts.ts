import { Address, toNano } from '@ton/core';
import { CrowdSalev2 } from '../wrappers/CrowdSalev2';
import { NetworkProvider, sleep } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const address = Address.parse('EQDTS6A4-hL3znSA7WsInBfwi--nD1p_9FJOrszGUTF5fO3y'); //cs2
    //const address = Address.parse('EQBhOhdA8vncTSH3ft2f-Nqj9PTmKTSZMbhkMN8DhFTeJC1g'); //CS1

    // const address = Address.parse( args.length > 0 ? args[0] : await ui.input('Crowdsale  address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }
    // const addressBuyer = Address.parse('EQDOQbS74Sn-sGojYfUK6Uknlg8t1CdNjG-5VJx5VIO2zNms');
    // const addressBuyer = Address.parse(args.length > 0 ? args[0] : await ui.input('Buyer address'));

    const cs = provider.open(CrowdSalev2.fromAddress(address));

    const counterBNK =await cs.getTotalBanks();
    // ui.write('banks at CS ${address} = ${counterBNK}');
    console.log (address, counterBNK )

    
}
