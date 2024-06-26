import { Blockchain, SandboxContract, TreasuryContract, printTransactionFees } from '@ton/sandbox';
//'@ton-community/sandbox';
import { Cell, beginCell, toNano } from '@ton/core';
// import { ExampleNFTCollection, RoyaltyParams } from '../wrappers/NFTExample_ExampleNFTCollection';
import { BankJetton, JettonBurn } from '../build/BankJetton/tact_BankJetton';
import { BankJettonWallet, JettonTransfer } from '../build/BankJetton/tact_BankJettonWallet';
// import '@ton-community/test-utils';
import '@ton/test-utils';


describe('BNK  jetton test', () => {
    let blockchain: Blockchain;
    let owner: SandboxContract<TreasuryContract>;
    let alice: SandboxContract<TreasuryContract>;
    let jettonMaster: SandboxContract<BankJetton>;
    let ownerJettonContract: SandboxContract<BankJettonWallet>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        owner = await blockchain.treasury('owner');
        alice = await blockchain.treasury('alice');
        const jetton_content: Cell = beginCell().endCell();
        jettonMaster = blockchain.openContract(await BankJetton.fromInit(owner.address, jetton_content));
        const deployResult = await jettonMaster.send(
            owner.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        const ownerWalletAddress = await jettonMaster.getGetWalletAddress(owner.address);
        ownerJettonContract = blockchain.openContract(await BankJettonWallet.fromAddress(ownerWalletAddress));
        const ownerBNKBalanceInit = (await ownerJettonContract.getGetWalletData()).balance;
        expect(ownerBNKBalanceInit).toEqual(3_000_000n);

        // expect(deployResult.transactions).toHaveTransaction({
        //     from: owner.address,
        //     to: jettonMaster.address,
        //     deploy: true,
        //     success: true,
        // })

    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and nFTCollection are ready to use
    });

    it('should send 1 token to Alice', async () => {
        // Mint 1 token to Alice
   
        const sendyResult = await ownerJettonContract.send(
            owner.getSender(),
            {
                value: toNano('1'),
            },
                      {   
                $$type: 'JettonTransfer',
                query_id: 0n,
                destination: alice.address, 
                response_destination: alice.address,
                amount:  1n,
                custom_payload: null,
                forward_ton_amount: 0n,
                forward_payload:null
            }
        );
        //printTransactionFees(sendyResult.transactions);

        // Check that Alice send "Mint:1" msg to JettonMaster
        // expect(sendyResult.transactions).toHaveTransaction({
        //     from: owner.address,
        //     to: jettonMaster.address,
        //     success: true,
        // });

        // // Check that JettonMaster send 1 token to Alice's jetton wallet
         const aliceWalletAddress = await jettonMaster.getGetWalletAddress(alice.address);
        // expect(sendyResult.transactions).toHaveTransaction({
        //     from: jettonMaster.address,
        //     to: aliceWalletAddress,
        //     success: true,
        // });

        // // Check that Alice's jetton wallet send JettonExcesses msg to Alice
        // expect(sendyResult.transactions).toHaveTransaction({
        //     from: aliceWalletAddress,
        //     to: alice.address,
        //     success: true,
        // });

        // Check that Alice's jetton wallet balance is 1
        const aliceJettonContract = blockchain.openContract(await BankJettonWallet.fromAddress(aliceWalletAddress));
        const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBalanceAfter).toEqual(0n + 1000000000n);
    });

    it('should Alice send 1 token to Bob', async () => {
        // Mint 1 token to Alice first to build her jetton wallet
        const sendyResult1 = await ownerJettonContract.send(
            owner.getSender(),
            {
                value: toNano('1'),
            },
                      {   
                $$type: 'JettonTransfer',
                query_id: 0n,
                destination: alice.address, 
                response_destination: alice.address,
                amount:  1n,
                custom_payload: null,
                forward_ton_amount: 0n,
                forward_payload:null
            }
        );
        //pr
        // Alice's jetton wallet address
        const aliceWalletAddress = await jettonMaster.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        const aliceJettonContract = blockchain.openContract(await BankJettonWallet.fromAddress(aliceWalletAddress));

        // Mint 1 token to Bob first to build his jetton wallet
        const bob = await blockchain.treasury('bob');
        const sendyResult = await ownerJettonContract.send(
            owner.getSender(),
            {
                value: toNano('1'),
            },
                      {   
                $$type: 'JettonTransfer',
                query_id: 0n,
                destination: bob.address, 
                response_destination: bob.address,
                amount:  1n,
                custom_payload: null,
                forward_ton_amount: 0n,
                forward_payload:null
            }
        );
        //pr
        // Bob's jetton wallet address
        const bobWalletAddress = await jettonMaster.getGetWalletAddress(bob.address);
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
        const sendyResult = await ownerJettonContract.send(
            owner.getSender(),
            {
                value: toNano('1'),
            },
                      {   
                $$type: 'JettonTransfer',
                query_id: 0n,
                destination: alice.address, 
                response_destination: alice.address,
                amount:  1n,
                custom_payload: null,
                forward_ton_amount: 0n,
                forward_payload:null
            }
        );
        //pr

        const jettonBurn: JettonBurn = {
            $$type: 'JettonBurn',
            query_id: 0n,
            amount: 1n,
            response_destination: alice.address,
            custom_payload: null,
        };

        // Alice's jetton wallet address
        const aliceWalletAddress = await jettonMaster.getGetWalletAddress(alice.address);
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

        // Check that Alice's jetton wallet send JettonBurnNotification msg to JettonMaster
        expect(burnResult.transactions).toHaveTransaction({
            from: aliceWalletAddress,
            to: jettonMaster.address,
            success: true,
        });

        // Check that JettonMaster send JettonExcesses msg to Alice
        expect(burnResult.transactions).toHaveTransaction({
            from: jettonMaster.address,
            to: alice.address,
            success: true,
        });

        // Check that Alice's jetton wallet balance is subtracted 1
        const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBalanceAfter).toEqual(aliceBalanceBefore - 1n);
    });
});
