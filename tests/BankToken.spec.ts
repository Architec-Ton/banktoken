import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { BankJetton } from '../wrappers/BankJetton';
import '@ton/test-utils';

describe('BankJetton', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let BankJetton: SandboxContract<BankJetton>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        BankJetton = blockchain.openContract(await BankJetton.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await BankJetton.send(
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
            to: BankJetton.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and BankJetton are ready to use
    });
});
