import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { BankStaking } from '../wrappers/BankStaking';
import '@ton/test-utils';
import { buildOnchainMetadata } from "../utils/jetton-helpers";
import * as BJ /* { BankJetton, JettonBurn } */ from '../build/BankJetton/tact_BankJetton';
import *as BJW /* { BankJettonWallet, JettonTransfer } */ from '../build/BankJetton/tact_BankJettonWallet';
import * as AJ /* { ArcJetton, JettonBurn } */ from '../build/ArcJetton/tact_ArcJetton';
import * as AJW /* { ArcJettonWallet, JettonTransfer } */ from '../build/ArcJetton/tact_ArcJettonWallet';

describe('BankStaking', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let bankStaking: SandboxContract<BankStaking>;
    let owner: SandboxContract<TreasuryContract>;
    let alice: SandboxContract<TreasuryContract>;
    let bankJetton: SandboxContract<BJ.BankJetton>;

    let ARCJetton: SandboxContract<AJ.ArcJetton>;

    const BNKjettonParams = {
        name: "BNK jetton",
        description: "This is description for BNK jetton",
        symbol: "BNK",
        image: "https://www.com/BNKjetton.json"
    };
    const ARCjettonParams = {
        name: "ARC jetton",
        description: "This is description for ARC jetton",
        symbol: "ARC",
        image: "https://www.com/ARCjetton.json"
    };

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        owner = await blockchain.treasury('owner');
        alice = await blockchain.treasury('alice');
        bankJetton = blockchain.openContract(await BJ.BankJetton.fromInit(owner.address, buildOnchainMetadata(BNKjettonParams)));
        const deployResultBNK = await bankJetton.send(
            owner.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployResultBNK.transactions).toHaveTransaction({
            from: owner.address,
            to: bankJetton.address,
            deploy: true,
            success: true,
        });
    
        ARCJetton = blockchain.openContract(await AJ.ArcJetton.fromInit(owner.address, buildOnchainMetadata(ARCjettonParams)));
        const deployResult = await ARCJetton.send(
            owner.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: owner.address,
            to: ARCJetton.address,
            deploy: true,
            success: true,
        });

        bankStaking = blockchain.openContract(await BankStaking.fromInit(deployer.address, 1n));

        const deployResultAJ = await bankStaking.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployResultAJ.transactions).toHaveTransaction({
            from: deployer.address,
            to: bankStaking.address,
            deploy: true,
            success: true,
        });
    });
    it('stake BNK', async () => {
        // the check is done inside beforeEach
        // blockchain and bankStaking are ready to use
    });
});
