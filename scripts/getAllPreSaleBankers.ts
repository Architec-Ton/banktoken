import { BanksCrowdSaleV2 } from '../build/BanksCrowdSaleV2/tact_BanksCrowdSaleV2';

import { Address } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

import fs from 'node:fs';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    const address = Address.parse('EQDTS6A4-hL3znSA7WsInBfwi--nD1p_9FJOrszGUTF5fO3y');
    const address0 = Address.parse('EQBhOhdA8vncTSH3ft2f-Nqj9PTmKTSZMbhkMN8DhFTeJC1g');

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    const banksCrowdSaleV2 = provider.open(BanksCrowdSaleV2.fromAddress(address));
    const banksCrowdSale = provider.open(BanksCrowdSaleV2.fromAddress(address0));

    const allBankersV2 = await banksCrowdSaleV2.getBankers();

    const allBankers = await banksCrowdSale.getBankers();
    for (let address of allBankers.keys()) {
        if (allBankersV2.has(address)) {
            allBankersV2.set(address, allBankersV2.get(address) + allBankers.get(address));
        } else {
            allBankersV2.set(address, allBankers.get(address));
        }
    }

    let sum = 0;
    const filename = 'all.csv';
    let s = '';
    for (let address of allBankersV2.keys()) {
        sum += allBankersV2.get(address);
        s += address.toString() + ',' + allBankersV2.get(address).toString() + '\n';
    }

    console.log(sum);
    console.log(allBankersV2.values().length);
    fs.writeFileSync(filename, s, 'utf8');
}
