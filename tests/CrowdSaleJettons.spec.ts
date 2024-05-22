import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { CrowdSaleJettons } from '../wrappers/CrowdSaleJettons';
import '@ton/test-utils';

describe('CrowdSaleJettons', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let crowdSaleJettons: SandboxContract<CrowdSaleJettons>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        crowdSaleJettons = blockchain.openContract(await CrowdSaleJettons.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await crowdSaleJettons.send(
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
            to: crowdSaleJettons.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and crowdSaleJettons are ready to use
    });
});
