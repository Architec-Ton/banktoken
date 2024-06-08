import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { StakeStorage } from '../wrappers/StakeStorage';
import '@ton/test-utils';

describe('StakeStorage', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let stakeStorage: SandboxContract<StakeStorage>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        stakeStorage = blockchain.openContract(await StakeStorage.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await stakeStorage.send(
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
            to: stakeStorage.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and stakeStorage are ready to use
    });
});
