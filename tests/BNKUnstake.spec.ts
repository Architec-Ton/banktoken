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

describe('BankUnStaking', () => {
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
            await AJ.ArcJetton.fromInit(owner.address, 
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
 

        bankStaking = blockchain.openContract(await BankStaking.fromInit(alice.address, bankJetton.address, ARCJetton.address));

        const deployResultBS = await bankStaking.send(
            deployer.getSender(),
            {
                value: toNano('10'),
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


    it('unstake  10 BNK and withdraw ARCS for for 300 days', async () => {
        // Mint 1 token to Alice first to build her jetton wallet
        
        const mintyResult = await bankJetton.send(
            alice.getSender(),
            {
                value: toNano('10'),
            },
            {   
                $$type: 'Mint',
                to: alice.address, 
                amount: 10n
            }
        );
        // console.log(mintyResult.transactions)
        expect(mintyResult.transactions).toHaveTransaction({
            from: alice.address,
            to: bankJetton.address,
            success: true,
        });
        

        // Alice's jetton wallet address
        const aliceWalletAddress = await bankJetton.getGetWalletAddress(alice.address);
        // console.log ("bankJetton", bankJetton.address);
        // console.log ("aliceWalletAddress", aliceWalletAddress);
        // console.log ('bankStaking.address', bankStaking.address);
        // Alice's jetton wallet
        const aliceBNKJettonContract = blockchain.openContract(await BJW.BankJettonWallet.fromAddress(aliceWalletAddress));
        const aliceBNKBalanceInit = (await aliceBNKJettonContract.getGetWalletData()).balance;
        expect(aliceBNKBalanceInit).toEqual(10n);

        const jettonBNKTransfer: BJW.JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            amount: 10n,
            destination: bankStaking.address,
            response_destination: bankStaking.address,
            custom_payload: null,
            forward_ton_amount: toNano('1'),
            forward_payload: beginCell().endCell(),
        };
        const transferResult = await aliceBNKJettonContract.send(
            alice.getSender(),
            {
                value: toNano('2'),
            },
            jettonBNKTransfer,
        );

        const bnkstkWalletAddress = await bankJetton.getGetWalletAddress(bankStaking.address);
        console.log('bnkstkWalletAddress', bnkstkWalletAddress);
        const BNKstkJettonContract = blockchain.openContract(await BJW.BankJettonWallet.fromAddress(bnkstkWalletAddress));
        const BNKstkBalanceInit = (await BNKstkJettonContract.getGetWalletData()).balance;
        expect(BNKstkBalanceInit).toEqual(10n);
       

        // console.log(transferResult.transactions);

        // Check that Alice sent JettonTransfer to staking

        const stakeStorageAddr = await bankStaking.getCalculateStakeAddress(alice.address, bankJetton.address);
        // console.log("alice: ", alice.address);
        // console.log("stakeStorageAddr: ", stakeStorageAddr);
        const stakeStorage = blockchain.openContract(await StakeStorage.fromAddress(stakeStorageAddr));

        blockchain.now = 1 + 60*60*24*300; // 300 days gone
        const amountTime2 = await stakeStorage.getAmountTime(alice.address);
        const exspct= (toNano("3.3"));
        expect(amountTime2.calculatedAmount).toEqual(exspct)
        

        // Unstake && claim reward 
        const claimTX  = await bankStaking.send(
            alice.getSender(),
            {
                value: toNano('10'),
            },
            // "Unstake"
            {
                $$type: 'Unstake',
                applied_user_address: alice.address, 
                bnk_stake_wallet_address: bnkstkWalletAddress
            }
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

    
});