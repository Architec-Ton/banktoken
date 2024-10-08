import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, toNano } from '@ton/core';
import '@ton/test-utils';
import { buildOnchainMetadata } from '../utils/jetton-helpers';
import * as BJ from '../build/BankJetton/tact_BankJetton';
import * as BJW from '../build/BankJetton/tact_BankJettonWallet';
import * as AJ from '../build/ArcJetton/tact_ArcJetton';
import { StakeStorage } from '../wrappers/StakeStorage';

describe('Bank Staking', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    // let bankStaking: SandboxContract<BankStaking>;
    let owner: SandboxContract<TreasuryContract>;
    let alice: SandboxContract<TreasuryContract>;
    let bankJetton: SandboxContract<BJ.BankJetton>;
    let parameter = 1n;
    let ARCJetton: SandboxContract<AJ.ArcJetton>;

    let ownerWalletAddress: Address;
    let ownerBNKJettonContract: SandboxContract<BJW.BankJettonWallet>;

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
        // console.log("bankJetton:", bankJetton.address);

        expect(deployResultBNK.transactions).toHaveTransaction({
            from: owner.address,
            to: bankJetton.address,
            deploy: true,
            success: true,
        });

        ARCJetton = blockchain.openContract(
            await AJ.ArcJetton.fromInit(owner.address,
                // bankStaking.address, 
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

        ownerWalletAddress = await bankJetton.getGetWalletAddress(owner.address);
        ownerBNKJettonContract = blockchain.openContract( BJW.BankJettonWallet.fromAddress(ownerWalletAddress));

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
    });

    it('stake BNK', async () => {
        // Mint 1 token to Alice first to build her jetton wallet


        // Alice's jetton wallet address
        const aliceWalletAddress = await bankJetton.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        console.log ("aliceWalletAddress:", aliceWalletAddress)
        const aliceJettonContract = blockchain.openContract(await BJW.BankJettonWallet.fromAddress(aliceWalletAddress));

        const jettonStake: BJW.Stake = {
            $$type: 'Stake',
            query_id: 0n,
            amount: 1n,
            
        };
        const transferResult = await aliceJettonContract.send(
            alice.getSender(),
            {
                value: toNano('2'),
            },
            jettonStake,
        );
        //printTransactionFees(transferResult.transactions);

        // Check that Alice sent JettonTransfer to staking

        const stakeStorageAddr = await bankJetton.getCalculateStakeAddress(alice.address);

        const stakeStorage = blockchain.openContract(await StakeStorage.fromAddress(stakeStorageAddr));
        const amountTime = await stakeStorage.getAmountTime(alice.address);
        expect(amountTime.stakedAmount).toEqual(1n);

        //checking iterator (point to itself now)
        const pn =  await stakeStorage.getPrevnextcells()
        const stakeStorageP = blockchain.openContract(await StakeStorage.fromAddress(pn.previous));
        const amountTimeP = await stakeStorageP.getAmountTime(alice.address);
        expect(amountTimeP.stakedAmount).toEqual(1n);
        const stakeStorageN = blockchain.openContract(await StakeStorage.fromAddress(pn.next));
        const amountTimeN = await stakeStorageN.getAmountTime(alice.address);
        expect(amountTimeN.stakedAmount).toEqual(1n);

    });

    it('avoid double staking BNK', async () => {
        // send 1 token to Alice first to build her jetton wallet


        // Alice's jetton wallet address
        const aliceWalletAddress = await bankJetton.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        console.log ("aliceWalletAddress:", aliceWalletAddress)
        const aliceJettonContract = blockchain.openContract(await BJW.BankJettonWallet.fromAddress(aliceWalletAddress));
        const aliceBNKBalanceInit = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBNKBalanceInit).toEqual(100000n);
        
        const jettonStake: BJW.Stake = {
            $$type: 'Stake',
            query_id: 0n,
            amount: 1n,
            
        };
        const transferResult = await aliceJettonContract.send(
            alice.getSender(),
            {
                value: toNano('2'),
            },
            jettonStake,
        );
        //printTransactionFees(transferResult.transactions);

        // Check that Alice sent JettonTransfer to staking
        const aliceBNKBalanceafterSt1 = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBNKBalanceafterSt1).toEqual(99999n);
        const stakeStorageAddr = await bankJetton.getCalculateStakeAddress(alice.address);

       
        const stakeStorage = blockchain.openContract(await StakeStorage.fromAddress(stakeStorageAddr));
        const amountTime = await stakeStorage.getAmountTime(alice.address);
        expect(amountTime.stakedAmount).toEqual(1n);

        const stakeStorageBNKJettonWallet = await bankJetton.getGetWalletAddress(stakeStorage.address)
        const stakeStorageBNKJettonContract = blockchain.openContract(BJW.BankJettonWallet.fromAddress(stakeStorageBNKJettonWallet));
        const stakestorBNKBalanceafterSt1 = (await stakeStorageBNKJettonContract.getGetWalletData()).balance;
        expect(stakestorBNKBalanceafterSt1).toEqual(1n);

        //sending BNK again when stake closed 
        const transferResult2 = await aliceJettonContract.send(
            alice.getSender(),
            {
                value: toNano('2'),
            },
            jettonStake,
        );
        //printTransactionFees(transferResult.transactions);
        const amountTime2 = await stakeStorage.getAmountTime(alice.address);
        expect(amountTime2.stakedAmount).toEqual(1n);
        
        // Check that Alice got back  BNK avoid double staking
        // expect(transferResult.transactions).toHaveTransaction({
        //     from: aliceJettonContract.address,
        //     to: stakeStorageBNKJettonContract.address,
        //     success: true
        // })
        const aliceBNKBalanceafterSt2 = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBNKBalanceafterSt2).toEqual(99999n);

    });

    it('stake 1 BNK for 1000 days', async () => {

        // Alice's jetton wallet address
        const aliceWalletAddress = await bankJetton.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        const aliceJettonContract = blockchain.openContract(await BJW.BankJettonWallet.fromAddress(aliceWalletAddress));

        const jettonTransfer: BJW.Stake = {
            $$type: 'Stake',
            query_id: 0n,
            amount: 1n,
            
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

        const stakeStorageAddr = await bankJetton.getCalculateStakeAddress(alice.address);


        const stakeStorage = blockchain.openContract(await StakeStorage.fromAddress(stakeStorageAddr));
        const amountTime = await stakeStorage.getAmountTime(alice.address);

        blockchain.now = 1 + 60*60*24*1000; // 1000 days gone
        const amountTime2 = await stakeStorage.getAmountTime(alice.address);
        const exspct= (toNano("1"));
        expect(amountTime2.calculatedAmount).toEqual(exspct);

    });

    it('stake 10 BNK for 300 days', async () => {

        // Alice's jetton wallet address
        const aliceWalletAddress = await bankJetton.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        const aliceJettonContract = blockchain.openContract(await BJW.BankJettonWallet.fromAddress(aliceWalletAddress));
        const jettonTransfer: BJW.Stake = {
            $$type: 'Stake',
            query_id: 0n,
            amount: 10n,
            
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

        const stakeStorageAddr = await bankJetton.getCalculateStakeAddress(alice.address);


        const stakeStorage = blockchain.openContract(await StakeStorage.fromAddress(stakeStorageAddr));

        blockchain.now = 1 + 60*60*24*300; // 300 days gone
        const amountTime2 = await stakeStorage.getAmountTime(alice.address);
        expect(amountTime2.calculatedAmount).toEqual(toNano("3.3"))

        // const claimTX  = await ARCJetton.send(
        //     alice.getSender(),
        //     {
        //         value: toNano(1),
        //     },
        //     "Claim"
        // );

        // console.log (claimTX);
        //         // Check that Alice's jetton wallet balance is 1
        // const aliceARCWalletAddress = await ARCJetton.getGetWalletAddress(alice.address);
        // const aliceARCjettonContract = blockchain.openContract(await AJW.ArcJettonWallet.fromAddress(aliceARCWalletAddress));
        // const aliceARCBalanceAfter = (await aliceARCjettonContract.getGetWalletData()).balance;
        // expect(aliceARCBalanceAfter).toEqual(0n + 1000000000n);
    });

    it('stake 100 BNK for 30 days', async () => {
        // Alice's jetton wallet address
        const aliceWalletAddress = await bankJetton.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        const aliceJettonContract = blockchain.openContract(await BJW.BankJettonWallet.fromAddress(aliceWalletAddress));

        const jettonTransfer: BJW.Stake = {
            $$type: 'Stake',
            query_id: 0n,
            amount: 100n,
            
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

        const stakeStorageAddr = await bankJetton.getCalculateStakeAddress(alice.address);


        const stakeStorage = blockchain.openContract(await StakeStorage.fromAddress(stakeStorageAddr));

        blockchain.now = 1 + 60*60*24*30; // 30 days gone
        const amountTime2 = await stakeStorage.getAmountTime(alice.address);
        const exspct= (toNano("6.6"));
        expect(amountTime2.calculatedAmount).toEqual(exspct)
        //66000000000n
        //6600000000n

    });

    it('stake 1000 BNK for 30 days', async () => {
        // Alice's jetton wallet address
        const aliceWalletAddress = await bankJetton.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        const aliceJettonContract = blockchain.openContract(await BJW.BankJettonWallet.fromAddress(aliceWalletAddress));

        const jettonTransfer: BJW.Stake = {
            $$type: 'Stake',
            query_id: 0n,
            amount: 1000n,
            
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

        const stakeStorageAddr = await bankJetton.getCalculateStakeAddress(alice.address);


        const stakeStorage = blockchain.openContract(await StakeStorage.fromAddress(stakeStorageAddr));

        blockchain.now = 1 + 60*60*24*30; // 30 days gone
        const amountTime2 = await stakeStorage.getAmountTime(alice.address);
        expect(amountTime2.calculatedAmount).toEqual(toNano("75"))

    });

    it('stake 10000 BNK for 30 days', async () => {
        // Alice's jetton wallet address
        const aliceWalletAddress = await bankJetton.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        const aliceJettonContract = blockchain.openContract(await BJW.BankJettonWallet.fromAddress(aliceWalletAddress));

        const jettonTransfer: BJW.Stake = {
            $$type: 'Stake',
            query_id: 0n,
            amount: 10_000n,
            
        };
        await aliceJettonContract.send(
            alice.getSender(),
            {
                value: toNano('2'),
            },
            jettonTransfer,
        );
        //printTransactionFees(transferResult.transactions);

        // Check that Alice sent JettonTransfer to staking

        const stakeStorageAddr = await bankJetton.getCalculateStakeAddress(alice.address);


        const stakeStorage = blockchain.openContract(await StakeStorage.fromAddress(stakeStorageAddr));

        blockchain.now = 1 + 60*60*24*30; // 30 days gone
        const amountTime2 = await stakeStorage.getAmountTime(alice.address);
        expect(amountTime2.calculatedAmount).toEqual(toNano("900"))

    });

   
});
