import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
// import { toNano } from '@ton/core';
import { Address, beginCell, Cell, Slice, toNano } from '@ton/ton';
// import { ContractSystem } from '@tact-lang/emulator';
import { CrowdSale } from '../wrappers/CrowdSale';
import '@ton/test-utils';

describe('CrowdSale', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let crowdSale: SandboxContract<CrowdSale>;
    let unlockDate = 0n; //UnixTime
    let owner = Address.parse('UQAsB6vBUeSPdQ_XnIrTt8psWXpxdcJmCKVgyuDQYr8B2HQg');

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        crowdSale = blockchain.openContract(
            await CrowdSale.fromInit(
                unlockDate, //: Int,
                //  owner, //: Address */
            ),
        );

        deployer = await blockchain.treasury('deployer');

        const deployResult = await crowdSale.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: crowdSale.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and crowdSale are ready to use
    });

    it('buy bank default', async () => {
        const counterBefore = await crowdSale.getSomeoneBanksBalance(deployer.address);

        await crowdSale.send(
            // provider.sender(),
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            null,
        );

        let counterAfter = await crowdSale.getSomeoneBanksBalance(deployer.address);
        expect(counterAfter != counterBefore);
        // let attempt = 1;
        // while (counterAfter === counterBefore) {
        //     ui.setActionPrompt(`Attempt ${attempt}`);
        //     await sleep(2000);
        //     counterAfter = await cs.getSomeoneBanksBalance(addressBuyer);
        //     attempt++;
    });

    it('buy bank  mess buyBank', async () => {
        const counterBefore = await crowdSale.getSomeoneBanksBalance(deployer.address);

        await crowdSale.send(
            // provider.sender(),
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            'buyBank',
        );

        let counterAfter = await crowdSale.getSomeoneBanksBalance(deployer.address);
        expect(counterAfter != counterBefore);
        // let attempt = 1;
        // while (counterAfter === counterBefore) {
        //     ui.setActionPrompt(`Attempt ${attempt}`);
        //     await sleep(2000);
        //     counterAfter = await cs.getSomeoneBanksBalance(addressBuyer);
        //     attempt++;
    });

    it('buy bank with referal', async () => {
        const counterBefore = await crowdSale.getSomeoneBanksBalance(deployer.address);

        await crowdSale.send(
            // provider.sender(),
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'ReferralAddress',
                referral: deployer.address,
                // query_id: 0n,
                // amount: 1n,
            },
        );

        let counterAfter = await crowdSale.getSomeoneBanksBalance(deployer.address);
        expect(counterAfter != counterBefore);
        // let attempt = 1;
        // while (counterAfter === counterBefore) {
        //     ui.setActionPrompt(`Attempt ${attempt}`);
        //     await sleep(2000);
        //     counterAfter = await cs.getSomeoneBanksBalance(addressBuyer);
        //     attempt++;
    });
});
