import { Blockchain, SandboxContract, TreasuryContract, printTransactionFees } from '@ton/sandbox';
//'@ton-community/sandbox';
import { Cell, beginCell, toNano, TupleReader, Dictionary } from '@ton/core';
// import { ExampleNFTCollection, RoyaltyParams } from '../wrappers/NFTExample_ExampleNFTCollection';
import { BankJetton, JettonBurn } from '../build/BankJetton/tact_BankJetton';
import { BankJettonWallet, JettonTransfer } from '../build/BankJetton/tact_BankJettonWallet';
// import '@ton-community/test-utils';
import '@ton/test-utils';
import { buildOnchainMetadata } from "../utils/jetton-helpers";


describe('BNK jetton test', () => {
    let blockchain: Blockchain;
    let owner: SandboxContract<TreasuryContract>;
    let alice: SandboxContract<TreasuryContract>;
    let bankJetton: SandboxContract<BankJetton>;
    const jettonParams = {
        name: "BNK jetton",
        description: "This is description for BNK jetton",
        symbol: "BNK",
        image: "https://www.com/BNKjetton.png",
        //uri: TODO - to show in ARCWallet
    };

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        owner = await blockchain.treasury('owner');
        alice = await blockchain.treasury('alice');
        // const jetton_content: Cell = beginCell().endCell();
        bankJetton = blockchain.openContract(await BankJetton.fromInit(owner.address, buildOnchainMetadata(jettonParams)));
        const deployResult = await bankJetton.send(
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
            to: bankJetton.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and nFTCollection are ready to use
    });

    it('should mint 1 token to Alice', async () => {
        // Mint 1 token to Alice
        const mintyResult = await bankJetton.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            'Mint:1',
        );
        //printTransactionFees(mintyResult.transactions);

        // Check that Alice send "Mint:1" msg to bankJetton
        expect(mintyResult.transactions).toHaveTransaction({
            from: alice.address,
            to: bankJetton.address,
            success: true,
        });

        // Check that bankJetton send 1 token to Alice's jetton wallet
        const aliceWalletAddress = await bankJetton.getGetWalletAddress(alice.address);
        expect(mintyResult.transactions).toHaveTransaction({
            from: bankJetton.address,
            to: aliceWalletAddress,
            success: true,
        });

        // Check that Alice's jetton wallet send JettonExcesses msg to Alice
        expect(mintyResult.transactions).toHaveTransaction({
            from: aliceWalletAddress,
            to: alice.address,
            success: true,
        });

        // Check that Alice's jetton wallet balance is 1
        const aliceJettonContract = blockchain.openContract(await BankJettonWallet.fromAddress(aliceWalletAddress));
        const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBalanceAfter).toEqual(0n + 1000000000n);
    });

    it('should Alice send 1 token to Bob', async () => {
        // Mint 1 token to Alice first to build her jetton wallet
        await bankJetton.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            'Mint:1',
        );
        // Alice's jetton wallet address
        const aliceWalletAddress = await bankJetton.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        const aliceJettonContract = blockchain.openContract(await BankJettonWallet.fromAddress(aliceWalletAddress));

        // Mint 1 token to Bob first to build his jetton wallet
        const bob = await blockchain.treasury('bob');
        const mintyResult = await bankJetton.send(
            bob.getSender(),
            {
                value: toNano('1'),
            },
            'Mint:1',
        );
        // Bob's jetton wallet address
        const bobWalletAddress = await bankJetton.getGetWalletAddress(bob.address);
        // Bob's jetton wallet
        const bobJettonContract = blockchain.openContract(await BankJettonWallet.fromAddress(bobWalletAddress));
        const bobBalanceBefore = (await bobJettonContract.getGetWalletData()).balance;

        // Alice transfer 1 token to Bob
        const jettonTransfer: JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            amount: 1n,
            destination: bob.address,
            response_destination: bob.address,
            custom_payload: null,
            forward_ton_amount: 0n,
            forward_payload: beginCell().endCell(),
        };
        const transfterResult = await aliceJettonContract.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            jettonTransfer,
        );
        //printTransactionFees(transfterResult.transactions);

        // Check that Alice send JettonTransfer msg to her jetton wallet
        expect(transfterResult.transactions).toHaveTransaction({
            from: alice.address,
            to: aliceWalletAddress,
            success: true,
        });

        // Check that Alice's jetton wallet send JettonInternalTransfer msg to Bob's jetton wallet
        expect(transfterResult.transactions).toHaveTransaction({
            from: aliceWalletAddress,
            to: bobWalletAddress,
            success: true,
        });

        // Check that Bob's jetton wallet send JettonExcesses msg to Bob
        expect(transfterResult.transactions).toHaveTransaction({
            from: bobWalletAddress,
            to: bob.address,
            success: true,
        });

        // Check that Bob's jetton wallet balance is added 1
        const bobBalanceAfter = (await bobJettonContract.getGetWalletData()).balance;
        expect(bobBalanceAfter).toEqual(bobBalanceBefore + 1n);
    });

    it('should Alice burn 1 token', async () => {
        // Mint 1 token to Alice first to build her jetton wallet
        const mintyResult = await bankJetton.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            'Mint:1',
        );

        const jettonBurn: JettonBurn = {
            $$type: 'JettonBurn',
            query_id: 0n,
            amount: 1n,
            response_destination: alice.address,
            custom_payload: null,
        };

        // Alice's jetton wallet address
        const aliceWalletAddress = await bankJetton.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        const aliceJettonContract = blockchain.openContract(await BankJettonWallet.fromAddress(aliceWalletAddress));
        // Alice's jetton wallet balance before burning
        const aliceBalanceBefore = (await aliceJettonContract.getGetWalletData()).balance;

        // Alice burn 1 token
        const burnResult = await aliceJettonContract.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            jettonBurn,
        );
        //printTransactionFees(burnResult.transactions);

        // Check that Alice send JettonBurn msg to her jetton wallet
        expect(burnResult.transactions).toHaveTransaction({
            from: alice.address,
            to: aliceWalletAddress,
            success: true,
        });

        // Check that Alice's jetton wallet send JettonBurnNotification msg to bankJetton
        expect(burnResult.transactions).toHaveTransaction({
            from: aliceWalletAddress,
            to: bankJetton.address,
            success: true,
        });

        // Check that bankJetton send JettonExcesses msg to Alice
        expect(burnResult.transactions).toHaveTransaction({
            from: bankJetton.address,
            to: alice.address,
            success: true,
        });

        // Check that Alice's jetton wallet balance is subtracted 1
        const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBalanceAfter).toEqual(aliceBalanceBefore - 1n);
    });

    it('get token data ', async () => {
        const jettondata = await bankJetton.getGetJettonData(); 

        // expect(jettondata).toEqual(jettonParams);

     
    });
});
