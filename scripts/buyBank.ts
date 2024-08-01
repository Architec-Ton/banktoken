import * as CS from '../build/BanksCrowdSaleV3/tact_BanksCrowdSaleV3';
import * as BJ from '../build/BankJetton/tact_BankJetton';

import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const bankJettonMasterAddress = Address.parse('')

    const bankJettonMaster = provider.open(BJ.BankJetton.fromAddress(bankJettonMasterAddress));
    const banksCrowdSaleV3 = provider.open(await CS.BanksCrowdSaleV3.fromInit(bankJettonMaster.address));

    if (!(await provider.isContractDeployed(banksCrowdSaleV3.address))) {
        ui.write(`Error: Contract at address ${banksCrowdSaleV3.address} is not deployed!`);
        return;
    }

    const banksAmount = 1

    await banksCrowdSaleV3.send(
        provider.sender(),
        {
            value: toNano(banksAmount * 1.5),
        },
        {
            $$type: 'ReferralAddress',
            referral: Address.parse(''),
        },
    );
}
