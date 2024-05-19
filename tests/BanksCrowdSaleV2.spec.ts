import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { BanksCrowdSaleV2 } from '../wrappers/BanksCrowdSaleV2';
import '@ton/test-utils';

describe('BanksCrowdSaleV2', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let banksCrowdSaleV2: SandboxContract<BanksCrowdSaleV2>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        banksCrowdSaleV2 = blockchain.openContract(await BanksCrowdSaleV2.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await banksCrowdSaleV2.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: banksCrowdSaleV2.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and banksCrowdSaleV2 are ready to use
    });
});
