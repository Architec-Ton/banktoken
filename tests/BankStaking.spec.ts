import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { BankStaking } from '../wrappers/BankStaking';
import '@ton/test-utils';

describe('BankStaking', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let bankStaking: SandboxContract<BankStaking>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        bankStaking = blockchain.openContract(await BankStaking.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await bankStaking.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                query_id: 0n,
            },
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: bankStaking.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and bankStaking are ready to use
    });
});
