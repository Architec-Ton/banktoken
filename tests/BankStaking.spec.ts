import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, beginCell } from '@ton/core';
import { BankStaking } from '../wrappers/BankStaking';
import '@ton/test-utils';
import { buildOnchainMetadata } from '../utils/jetton-helpers';
import * as BJ /* { BankJetton, JettonBurn } */ from '../build/BankJetton/tact_BankJetton';
import * as BJW /* { BankJettonWallet, JettonTransfer } */ from '../build/BankJetton/tact_BankJettonWallet';
import * as AJ /* { ArcJetton, JettonBurn } */ from '../build/ArcJetton/tact_ArcJetton';
import * as AJW /* { ArcJettonWallet, JettonTransfer } */ from '../build/ArcJetton/tact_ArcJettonWallet';
import { StakeStorage } from '../wrappers/StakeStorage';

describe('BankStaking', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let bankStaking: SandboxContract<BankStaking>;
    let owner: SandboxContract<TreasuryContract>;
    let alice: SandboxContract<TreasuryContract>;
    let bankJetton: SandboxContract<BJ.BankJetton>;

    let ARCJetton: SandboxContract<AJ.ArcJetton>;

    const BNKjettonParams = {
        name: 'BNK jetton',
        description: 'This is description for BNK jetton',
        symbol: 'BNK',
        image: 'https://www.com/BNKjetton.json',
    };
    const ARCjettonParams = {
        name: 'ARC jetton',
        description: 'This is description for ARC jetton',
        symbol: 'ARC',
        image: 'https://www.com/ARCjetton.json',
    };

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        owner = await blockchain.treasury('owner');
        alice = await blockchain.treasury('alice');
        bankJetton = blockchain.openContract(
            await BJ.BankJetton.fromInit(owner.address, buildOnchainMetadata(BNKjettonParams)),
        );
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

        ARCJetton = blockchain.openContract(
            await AJ.ArcJetton.fromInit(owner.address, buildOnchainMetadata(ARCjettonParams)),
        );
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

        bankStaking = blockchain.openContract(await BankStaking.fromInit(alice.address, bankJetton.address, 1n));

        const deployResultBS = await bankStaking.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployResultBS.transactions).toHaveTransaction({
            from: deployer.address,
            to: bankStaking.address,
            deploy: true,
            success: true,
        });
    });
    it('stake BNK', async () => {
        // Mint 1 token to Alice first to build her jetton wallet
        const mintyResult = await bankJetton.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            'Mint:1',
        );

        expect(mintyResult.transactions).toHaveTransaction({
            from: alice.address,
            to: bankJetton.address,
            success: true,
        });

        // Alice's jetton wallet address
        const aliceWalletAddress = await bankJetton.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        const aliceJettonContract = blockchain.openContract(await BJW.BankJettonWallet.fromAddress(aliceWalletAddress));

        const jettonTransfer: BJW.JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            amount: 1n,
            destination: bankStaking.address,
            response_destination: bankStaking.address,
            custom_payload: null,
            forward_ton_amount: toNano('1'),
            forward_payload: beginCell().endCell(),
        };
        const transferResult = await aliceJettonContract.send(
            alice.getSender(),
            {
                value: toNano('2'),
            },
            jettonTransfer,
        );
        //printTransactionFees(transferResult.transactions);

        // Check that Alice sent JettonTransfer to staking

        const stakeStorageAddr = await bankStaking.getCalculateStakeAddress(alice.address, bankStaking.address);
        console.log(
            'alice.address ',
            alice.address,
            '\n aliceWalletAddress',
            aliceWalletAddress,
            '\n bankStaking.address',
            bankStaking.address,
            '\n bankJetton.address',
            bankJetton.address,
            '\n stakeStorageAddr: ',
            stakeStorageAddr,
        );

        // expect(transferResult.transactions).toHaveTransaction({
        //     from: aliceWalletAddress,
        //     to: bankStaking.address,
        //     success: true,
        // });


        const stakeStorage = blockchain.openContract(await StakeStorage.fromAddress(stakeStorageAddr));
        const amountTime = await stakeStorage.getAmountTime();

        expect(amountTime.amount).toEqual(toNano('1'));
    });
});
