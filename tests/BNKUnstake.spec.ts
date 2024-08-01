import { buildOnchainMetadata } from '../utils/jetton-helpers';
import * as BJ from '../build/BankJetton/tact_BankJetton';
import * as BJW from '../build/BankJetton/tact_BankJettonWallet';
import * as AJ from '../build/ArcJetton/tact_ArcJetton';
import * as AJW from '../build/ArcJetton/tact_ArcJettonWallet';
import { StakeStorage } from '../wrappers/StakeStorage';

import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, beginCell, fromNano } from '@ton/core';
import '@ton/test-utils';

describe('BankUnStaking', () => {
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
        alice = await blockchain.treasury('alice', {balance: toNano('10')});
        bankJetton = blockchain.openContract(
            await BJ.BankJetton.fromInit(owner.address, buildOnchainMetadata(BNKjettonParams)),
        );
        const deployResultBNK = await bankJetton.send(
            owner.getSender(),
            {
                value: toNano('0.07'),
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
                buildOnchainMetadata(ARCjettonParams)),
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



       
        const newMinter = await ARCJetton.send(
            owner.getSender(),
            {
                value: toNano('0.05'),
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

        const ownerWalletAddress = await bankJetton.getGetWalletAddress(owner.address);
        const ownerBNKJettonContract = blockchain.openContract( BJW.BankJettonWallet.fromAddress(ownerWalletAddress));

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
        
        await ownerBNKJettonContract.send(
            owner.getSender(),
            {
                value: toNano('0.07'),
            },
            {
                $$type: 'JettonTransfer',
                query_id: 0n,
                amount: 10n,
                destination: alice.address,
                response_destination: alice.address,
                custom_payload: null,
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell(),
            }
        );

    });


    it('unstake  10 BNK and withdraw ARCS for for 300 days', async () => {
        // Alice's jetton wallet address
        const aliceWalletAddress = await bankJetton.getGetWalletAddress(alice.address);
        // console.log ("bankJetton", bankJetton.address);
        // console.log ("aliceWalletAddress", aliceWalletAddress);
        // console.log ('bankStaking.address', bankStaking.address);
        // Alice's jetton wallet
        const aliceBNKJettonContract = blockchain.openContract(await BJW.BankJettonWallet.fromAddress(aliceWalletAddress));
        const aliceBNKBalanceInit = (await aliceBNKJettonContract.getGetWalletData()).balance;
        expect(aliceBNKBalanceInit).toEqual(10n);

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

        const bnkstkWalletAddress = await bankJetton.getGetWalletAddress(bankJetton.address);
        // console.log('bnkstkWalletAddress', bnkstkWalletAddress);
        const BNKstkJettonContract = blockchain.openContract(BJW.BankJettonWallet.fromAddress(bnkstkWalletAddress));
        const BNKstkBalanceInit = (await BNKstkJettonContract.getGetWalletData()).balance;
        expect(BNKstkBalanceInit).toEqual(0n);


        // console.log(transferResult.transactions);

        // Check that Alice sent JettonTransfer to staking

        const stakeStorageAddr = await bankJetton.getCalculateStakeAddress(alice.address);
        // console.log("alice: ", alice.address);
        // console.log("stakeStorageAddr: ", stakeStorageAddr);
        const stakeStorage = blockchain.openContract(await StakeStorage.fromAddress(stakeStorageAddr));

        blockchain.now = 1 + 60*60*24*300; // 300 days gone
        const amountTime2 = await stakeStorage.getAmountTime(alice.address);
        const exspct= (toNano("3.3"));
        expect(amountTime2.calculatedAmount).toEqual(exspct)


        // Unstake && claim reward
        const claimTX  = await bankJetton.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            "Unstake"
            // {
            //     $$type: 'Unstake',
            //     applied_user_address: alice.address,
            //     // bnk_stake_wallet_address: bnkstkWalletAddress
            // }
        );
        // console.log
        // console.log (claimTX);
        // Check that Alice's ARC jetton wallet balance is 33N
        const aliceARCWalletAddress = await ARCJetton.getGetWalletAddress(alice.address);
        const aliceARCjettonContract = blockchain.openContract(await AJW.ArcJettonWallet.fromAddress(aliceARCWalletAddress));
        const aliceARCBalanceAfter = (await aliceARCjettonContract.getGetWalletData()).balance;
        expect(aliceARCBalanceAfter).toEqual(exspct);


        const aliceBNKBalanceAfter = (await aliceBNKJettonContract.getGetWalletData()).balance;
        expect(aliceBNKBalanceAfter).toEqual(10n);
    });

    it('stake-unstake-stake-unstake  10 BNK and withdraw ARCS for for 300 days', async () => {
        console.log(fromNano(await alice.getBalance()))
        const aliceJettonWallet = await bankJetton.getGetWalletAddress(alice.address);
        const aliceBNKJettonContract = blockchain.openContract(BJW.BankJettonWallet.fromAddress(aliceJettonWallet));

        const aliceARCWalletAddress = await ARCJetton.getGetWalletAddress(alice.address);
        const aliceARCJettonContract = blockchain.openContract(AJW.ArcJettonWallet.fromAddress(aliceARCWalletAddress));

        const stakeStorageAddress = await bankJetton.getCalculateStakeAddress(alice.address);
        const stakeStorage = blockchain.openContract(StakeStorage.fromAddress(stakeStorageAddress));

        const stakeStorageBNKJettonWallet = await bankJetton.getGetWalletAddress(stakeStorage.address)
        const stakeStorageBNKJettonContract = blockchain.openContract(BJW.BankJettonWallet.fromAddress(stakeStorageBNKJettonWallet));

        const masterBNKJettonWallet = await bankJetton.getGetWalletAddress(bankJetton.address);
        const masterBNKJettonContract = blockchain.openContract(BJW.BankJettonWallet.fromAddress(masterBNKJettonWallet));

        const aliceBNKBalanceInit = (await aliceBNKJettonContract.getGetWalletData()).balance;
        expect(aliceBNKBalanceInit).toEqual(10n);

        const jettonTransfer: BJW.Stake = {
            $$type: 'Stake',
            query_id: 0n,
            amount: 10n,
        };

        const transferResult = await aliceBNKJettonContract.send(
            alice.getSender(),
            {
                value: toNano('0.5'),
            },
            jettonTransfer,
        );

        expect(transferResult.transactions).toHaveTransaction({
            from: masterBNKJettonContract.address,
            to: stakeStorageBNKJettonContract.address,
            success: true
        })

        const aliceBNKBalanceAfter0 = (await aliceBNKJettonContract.getGetWalletData()).balance;
        expect(aliceBNKBalanceAfter0).toEqual(0n);
        const stakeStorageBNKBalance = (await stakeStorageBNKJettonContract.getGetWalletData()).balance;
        expect(stakeStorageBNKBalance).toEqual(10n);

        expect(transferResult.transactions).toHaveTransaction({
            // from: aliceBNKJettonContract.address,
            to: stakeStorageBNKJettonContract.address,
            success: true,
        });

        blockchain.now = 1 + 60*60*24*300; // 300 days gone

        const amountTime2 = await stakeStorage.getAmountTime(alice.address);
        const exspct= (toNano("3.3"));
        expect(amountTime2.calculatedAmount).toEqual(exspct)


        // Unstake && claim reward
        const claimTX  = await bankJetton.send(
            alice.getSender(),
            {
                value: toNano('0.05'),
            },
            "Unstake"
        );

        expect(claimTX.transactions).toHaveTransaction({
            // from: stakeStorageBNKJettonContract.address,
            to: aliceBNKJettonContract.address,
            success: true
        })
        // console.log
        // console.log (claimTX);
        // Check that Alice's ARC jetton wallet balance is 3.3N
        const aliceARCBalanceAfter = (await aliceARCJettonContract.getGetWalletData()).balance;
        expect(aliceARCBalanceAfter).toEqual(exspct);


        const aliceBNKBalanceAfter = (await aliceBNKJettonContract.getGetWalletData()).balance;
        expect(aliceBNKBalanceAfter).toEqual(10n);
        const BNKstkBalanceInit1 = (await masterBNKJettonContract.getGetWalletData()).balance;
        expect(BNKstkBalanceInit1).toEqual(0n);
        const stakeStorageBNKBalance_ = (await stakeStorageBNKJettonContract.getGetWalletData()).balance;
        expect(stakeStorageBNKBalance_).toEqual(0n);


        const transferResult2 = await aliceBNKJettonContract.send(
            alice.getSender(),
            {
                value: toNano('0.5'),
            },
            jettonTransfer,
        );

        // console.log('bnkstkWalletAddress', bnkstkWalletAddress);
        const BNKstkBalanceInit2 = (await stakeStorageBNKJettonContract.getGetWalletData()).balance;
        expect(BNKstkBalanceInit2).toEqual(10n);


        // console.log(transferResult.transactions);

        // Check that Alice sent JettonTransfer to staking

        // console.log("alice: ", alice.address);
        // console.log("stakeStorageAddr: ", stakeStorageAddr);

        blockchain.now += 60*60*24*300; // 300 days gone
        const amountTime3 = await stakeStorage.getAmountTime(alice.address);
        const exspct2= (toNano("3.3"));
        expect(amountTime3.calculatedAmount).toEqual(exspct2)


        // Unstake && claim reward
        const claimTX2  = await bankJetton.send(
            alice.getSender(),
            {
                value: toNano('0.07'),
            },
            "Unstake"
            // {
            //     $$type: 'Unstake',
            //     applied_user_address: alice.address,
            //     // bnk_stake_wallet_address: bnkstkWalletAddress
            // }
        );
        // console.log
        // console.log (claimTX);
        // Check that Alice's ARC jetton wallet balance is 33N
        
        const aliceARCBalanceAfter2 = (await aliceARCJettonContract.getGetWalletData()).balance;
        expect(aliceARCBalanceAfter2 - aliceARCBalanceAfter).toEqual(exspct);


        const aliceBNKBalanceAfter2 = (await aliceBNKJettonContract.getGetWalletData()).balance;
        expect(aliceBNKBalanceAfter2).toEqual(10n);
        console.log(fromNano(await alice.getBalance()))
    });
});
