import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { ArcJetton } from '../wrappers/ArcJetton';
import '@ton/test-utils';

describe('ArcJetton', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let arcJetton: SandboxContract<ArcJetton>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        arcJetton = blockchain.openContract(await ArcJetton.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await arcJetton.send(
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
            to: arcJetton.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and arcJetton are ready to use
    });
});
