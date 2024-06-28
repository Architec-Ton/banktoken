import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, beginCell, Address } from '@ton/core';
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
    let parameter = 1n;
    let ARCJetton: SandboxContract<AJ.ArcJetton>;

    let ownerWalletAddress: Address;
    let ownerBNKJettonContract: SandboxContract<BJW.BankJettonWallet>;

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

        const stakeStorageAddr = await bankStaking.getCalculateStakeAddress(alice.address, bankJetton.address);

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

    it('stake 1 BNK for 1000 days', async () => {

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

        const stakeStorageAddr = await bankStaking.getCalculateStakeAddress(alice.address, bankJetton.address);


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

        const jettonTransfer: BJW.JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            amount: 10n,
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

        const stakeStorageAddr = await bankStaking.getCalculateStakeAddress(alice.address, bankJetton.address);


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

        const jettonTransfer: BJW.JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            amount: 100n,
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

        const stakeStorageAddr = await bankStaking.getCalculateStakeAddress(alice.address, bankJetton.address);


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

        const jettonTransfer: BJW.JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            amount: 1000n,
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

        const stakeStorageAddr = await bankStaking.getCalculateStakeAddress(alice.address, bankJetton.address);


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

        const jettonTransfer: BJW.JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            amount: 10_000n,
            destination: bankStaking.address,
            response_destination: bankStaking.address,
            custom_payload: null,
            forward_ton_amount: toNano('1'),
            forward_payload: beginCell().endCell(),
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

        const stakeStorageAddr = await bankStaking.getCalculateStakeAddress(alice.address, bankJetton.address);


        const stakeStorage = blockchain.openContract(await StakeStorage.fromAddress(stakeStorageAddr));

        blockchain.now = 1 + 60*60*24*30; // 30 days gone
        const amountTime2 = await stakeStorage.getAmountTime(alice.address);
        expect(amountTime2.calculatedAmount).toEqual(toNano("900"))

    });
});
