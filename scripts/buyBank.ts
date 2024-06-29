import { Address, toNano } from '@ton/core';
import { CrowdSale } from '../wrappers/CrowdSale';
import { NetworkProvider, sleep } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    // const address = Address.parse('EQByVJjaA9EM8SzoApOuF0eE2USMNB2kT8ZlMV1TmWLfhgLe');
    // const crowdSale_address = Address.parse('EQDIfqmP71phy7GlkRrx86eQrtufpj9HDjNAt5uhTFr-JUVH');
    // const crowdSale_address = Address.parse('EQDIfqmP71phy7GlkRrx86eQrtufpj9HDjNAt5uhTFr-JUVH');
    // const crowdSale_address = Address.parse('EQCd7tb14-Gks9wLqVpl9zmc19ijqrMX6dZzDrwV_fS5-YNz');
    const crowdSale_address = Address.parse('EQBfVCiPwH3XOB-CI8XvkVDhunSm9KLy86uxk_pQStEKbK1m');
    // args.length > 0 ? args[0] : await ui.input('Crowdsale  address'));

    if (!(await provider.isContractDeployed(crowdSale_address))) {
        ui.write(`Error: Contract at address ${crowdSale_address} is not deployed!`);
        return;
    }
    // const addressBuyer = Address.parse('EQDOQbS74Sn-sGojYfUK6Uknlg8t1CdNjG-5VJx5VIO2zNms');
    const addressBuyer = Address.parse('0QCtwujhh-vTomKvurFgHifJOb4mK-vHnBjELhkhfLVvJ0Tz');
    // args.length > 0 ? args[0] : await ui.input('Buyer address'));

    const cs = provider.open(CrowdSale.fromAddress(crowdSale_address));

    const counterBefore = await cs.getSomeoneBanksBalance(addressBuyer);
    ui.write('banks at address: ');
    console.log(addressBuyer);
    console.log(counterBefore);

    await cs.send(
        provider.sender(),
        {
            value: toNano('0.1'),
        },
        {
            $$type: 'ReferralAddress',
            referral: Address.parse('EQDOQbS74Sn-sGojYfUK6Uknlg8t1CdNjG-5VJx5VIO2zNms'),
            // queryId: 0n,
            // amount: 1n,
        },
    );

    ui.write('Waiting for counter to increase...');

    let counterAfter = await cs.getSomeoneBanksBalance(addressBuyer);
    let attempt = 1;
    while (counterAfter === counterBefore) {
        ui.setActionPrompt(`Attempt ${attempt}`);
        await sleep(2000);
        counterAfter = await cs.getSomeoneBanksBalance(addressBuyer);
        attempt++;
    }
    ui.write('banks at address ${addressBuyer} = ${counterAfter}');

    ui.clearActionPrompt();
    ui.write('Counter increased successfully!');
}
