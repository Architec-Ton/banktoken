import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { BankJetton } from '../wrappers/BankJetton';
import '@ton/test-utils';

describe('BankJetton', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let bankJetton: SandboxContract<BankJetton>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        bankJetton = blockchain.openContract(await BankJetton.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await bankJetton.send(
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
            to: bankJetton.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and bankJetton are ready to use
    });
});
