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

describe('ARCWithdraw', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    // let bankStaking: SandboxContract<BankStaking>;
    let owner: SandboxContract<TreasuryContract>;
    let alice: SandboxContract<TreasuryContract>;
    let bankJetton: SandboxContract<BJ.BankJetton>;
    let ARCJetton: SandboxContract<AJ.ArcJetton>;

    const BNKjettonParams = {
        name: 'BNK jetton',
        description: 'This is description for BNK jetton',
        symbol: 'BNK',
        image_data: 'https://www.com/BNKjetton.json',
        decimals: '0'
    };
    const ARCjettonParams = {
        name: 'ARC jetton',
        description: 'This is description for ARC jetton',
        symbol: 'ARC',
        image_data: 'https://www.com/ARCjetton.json',
        decimals: '9'
    };

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1;
        deployer = await blockchain.treasury('deployer');
        owner = await blockchain.treasury('owner');
        alice = await blockchain.treasury('alice');
        bankJetton = blockchain.openContract(
            await BJ.BankJetton.fromInit(owner.address, buildOnchainMetadata(BNKjettonParams)),
        );
        const deployResultBNK = await bankJetton.send(
            owner.getSender(),
            {
                value: toNano('1'),
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
            await AJ.ArcJetton.fromInit(owner.address,
                // bankJetton.address,
                buildOnchainMetadata(ARCjettonParams)),
        );
        const deployResult = await ARCJetton.send(
            owner.getSender(),
            {
                value: toNano('10'),
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
        // console.log ("alice.address, bankJetton.address, ARCJetton.address");
        // console.log (alice.address, bankJetton.address, ARCJetton.address);

  
        // bankStaking = blockchain.openContract(await BankStaking.fromInit(alice.address, bankJetton.address, ARCJetton.address));

        // const deployResultBS = await bankStaking.send(
        //     deployer.getSender(),
        //     {
        //         value: toNano('10'),
        //     },
        //     {
        //         $$type: 'Deploy',
        //         queryId: 0n,
        //     },
        // );

        // expect(deployResultBS.transactions).toHaveTransaction({
        //     from: deployer.address,
        //     to: bankStaking.address,
        //     deploy: true,
        //     success: true,
        // });

        const newMinter = await ARCJetton.send(
            owner.getSender(),
            {
                value: toNano('1'),
            },
            {
                $$type: 'ChangeMinter',
                newMinter: bankJetton.address,
                isMinter: true
            },
        );

        expect(newMinter.transactions).toHaveTransaction({
            from: owner.address,
            to: ARCJetton.address,
            success: true,
        });

        const addARCjetton = await bankJetton.send(
            owner.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'AddingJettonAddress',
                this_contract_jettonWallet: ARCJetton.address
            },
        );

        expect(addARCjetton.transactions).toHaveTransaction({
            from: owner.address,
            to: bankJetton.address,
            success: true,
        });

    });


    it('withdraw ARCS for 10 BNK for 300 days', async () => {
        // Mint 1 token to Alice first to build her jetton wallet

        const ownerWalletAddress = await bankJetton.getGetWalletAddress(owner.address);
        const ownerBNKJettonContract = blockchain.openContract( BJW.BankJettonWallet.fromAddress(ownerWalletAddress));

        await ownerBNKJettonContract.send(
            owner.getSender(),
            {
                value: toNano('2'),
            },
            {
                $$type: 'JettonTransfer',
                query_id: 0n,
                amount: 100000n,
                destination: alice.address,
                response_destination: alice.address,
                custom_payload: null,
                forward_ton_amount: toNano('1'),
                forward_payload: beginCell().endCell(),
            }
        );
        // Alice's jetton wallet address
        const aliceWalletAddress = await bankJetton.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        const aliceBNKJettonContract = blockchain.openContract(await BJW.BankJettonWallet.fromAddress(aliceWalletAddress));

        const jettonTransfer: BJW.Stake = {
            $$type: 'Stake',
            query_id: 0n,
            amount: 10n,
            
        };
        const transferResult = await aliceBNKJettonContract.send(
            alice.getSender(),
            {
                value: toNano('2'),
            },
            jettonTransfer,
        );
        // console.log(transferResult.transactions);

        // Check that Alice sent JettonTransfer to staking

        const stakeStorageAddr = await bankJetton.getCalculateStakeAddress(alice.address);
        // console.log("alice: ", alice.address);
        // console.log("stakeStorageAddr: ", stakeStorageAddr);
        const stakeStorage = blockchain.openContract(await StakeStorage.fromAddress(stakeStorageAddr));

        blockchain.now = 1 + 60*60*24*300; // 300 days gone
        const amountTime2 = await stakeStorage.getAmountTime(alice.address);
        expect(amountTime2.calculatedAmount).toEqual(toNano("3.3"))
        // claim reward
        const claimTX  = await bankJetton.send(
            alice.getSender(),
            {
                value: toNano('10'),
            },
            "Claim"
        );
        // console.log
        // console.log (claimTX);
        // Check that Alice's jetton wallet balance is 1
        const aliceARCWalletAddress = await ARCJetton.getGetWalletAddress(alice.address);
        const aliceARCjettonContract = blockchain.openContract(await AJW.ArcJettonWallet.fromAddress(aliceARCWalletAddress));
        const aliceARCBalanceAfter = (await aliceARCjettonContract.getGetWalletData()).balance;
        expect(aliceARCBalanceAfter).toEqual(toNano("3.3"));
    });


});
