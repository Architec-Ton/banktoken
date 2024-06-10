import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { BanksCrowdSale } from '../wrappers/BanksCrowdSale';
import '@ton/test-utils';

describe('BanksCrowdSale', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let banksCrowdSale: SandboxContract<BanksCrowdSale>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        banksCrowdSale = blockchain.openContract(await BanksCrowdSale.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await banksCrowdSale.send(
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
            to: banksCrowdSale.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and banksCrowdSale are ready to use
    });
});
