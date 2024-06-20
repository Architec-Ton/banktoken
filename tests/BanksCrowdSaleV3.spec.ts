import { buildOnchainMetadata } from '../utils/jetton-helpers';
import { BankJetton } from '../build/BankJetton/tact_BankJetton';

import { BanksCrowdSaleV3 } from '../build/BanksCrowdSaleV3/tact_BanksCrowdSaleV3';
import '@ton/test-utils';

import { beginCell, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { BankJettonWallet } from '../build/BankJetton/tact_BankJettonWallet';
import { JettonTransfer } from '../build/ArcJetton/tact_ArcJetton';


describe('Banks crowd sale test', () => {
    let blockchain: Blockchain;
    let owner: SandboxContract<TreasuryContract>;
    let BNKJetton: SandboxContract<BankJetton>;
    let alice: SandboxContract<TreasuryContract>;
    let banksCrowdSaleV3: SandboxContract<BanksCrowdSaleV3>;
    let banksCrowdSaleV3JettonContract: SandboxContract<BankJettonWallet>;
    let aliceJettonContract: SandboxContract<BankJettonWallet>;

    const jettonParams = {
        name: "BNK jetton",
        description: "This is description for BNK jetton",
        symbol: "BNK",
        image: "https://www.com/BankJetton.png"
    };

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1000;

        owner = await blockchain.treasury('owner', {balance: toNano(10000)});
        alice = await blockchain.treasury('alice', {balance: toNano(2000000 * 3.2)});

        BNKJetton = blockchain.openContract(await BankJetton.fromInit(owner.address, buildOnchainMetadata(jettonParams)));
        const deployJettonResult = await BNKJetton.send(
            owner.getSender(),
            {
                value: toNano('1000'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployJettonResult.transactions).toHaveTransaction({
            from: owner.address,
            to: BNKJetton.address,
            deploy: true,
            success: true,
        });

        const aliceWallet = await BNKJetton.getGetWalletAddress(alice.address);
        aliceJettonContract = blockchain.openContract(BankJettonWallet.fromAddress(aliceWallet));

        banksCrowdSaleV3 = blockchain.openContract(await BanksCrowdSaleV3.fromInit(BNKJetton.address));
        const deployBanksCrowdSaleV3Result = await banksCrowdSaleV3.send(
            owner.getSender(),
            {
                value: toNano('1000'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployBanksCrowdSaleV3Result.transactions).toHaveTransaction({
            from: owner.address,
            to: banksCrowdSaleV3.address,
            deploy: true,
            success: true,
        });

        const banks = 3000000  // 2800000
        const mint = await BNKJetton.send(
            owner.getSender(),
            {
                value: toNano('1'),
            },
            {
                $$type: 'JettonMint',
                origin: owner.address,
                receiver: owner.address,
                amount: toNano(banks),
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell(),
            },
        )

        expect(mint.transactions).toHaveTransaction({
            from: owner.address,
            to: BNKJetton.address,
            success: true,
        });

        const jettonData = await BNKJetton.getGetJettonData()
        expect(jettonData.total_supply).toEqual(toNano(banks))

        const ownerJettonWallet = await BNKJetton.getGetWalletAddress(owner.address)
        const ownerJettonContract = blockchain.openContract(BankJettonWallet.fromAddress(ownerJettonWallet));
        const ownerBNKBalance = (await ownerJettonContract.getGetWalletData()).balance;
        expect(ownerBNKBalance).toEqual(toNano(banks));

        const jettonTransfer: JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            amount: toNano(2800000),
            destination: banksCrowdSaleV3.address,
            response_destination: banksCrowdSaleV3.address,
            custom_payload: beginCell().endCell(),
            forward_ton_amount: 0n,
            forward_payload: beginCell().endCell(),
        }

        const transfer = await ownerJettonContract.send(
            owner.getSender(),
            {
                value: toNano('1')
            },
            jettonTransfer
        )

        const banksCrowdSaleV3Wallet = await BNKJetton.getGetWalletAddress(banksCrowdSaleV3.address)
        banksCrowdSaleV3JettonContract = blockchain.openContract(BankJettonWallet.fromAddress(banksCrowdSaleV3Wallet));

        const banksCrowdSaleV3BalanceAfter = (await banksCrowdSaleV3JettonContract.getGetWalletData()).balance;
        expect(banksCrowdSaleV3BalanceAfter).toEqual(toNano(2800000));

        expect(transfer.transactions).toHaveTransaction({
            from: ownerJettonContract.address,
            to: banksCrowdSaleV3JettonContract.address,
            success: true,
            deploy: true
        })

        // get jettonWallet, calculate with initOf BankJettonWallet(myAddress(), jetton_master)
        const myJettonWallet = await banksCrowdSaleV3.getData()

        // set real jettonWallet
        await banksCrowdSaleV3.send(
            owner.getSender(),
            {
                value: toNano('1'),
            },
            {
                $$type: 'SetJettonWallet',
                jetton_wallet: banksCrowdSaleV3JettonContract.address,
            }
        )

        console.log(
            // BNKJetton.address,
            // "\nowner: ", owner.address, ownerJettonContract.address,
            myJettonWallet,
            "\ncrowdSale:", banksCrowdSaleV3.address, " jettonWallet:", banksCrowdSaleV3JettonContract.address,
            // "\nalice: ", alice.address, aliceJettonContract.address
            )

        // maybe change owner to null address
        // const lockJettonMaster = await BNKJetton.send(
        //     owner.getSender(),
        //     {
        //         // change jetton owner
        //     }
        // )
    });

    it('should transfer 1 Bank to Alice and 1.5 TON to owner', async () => {
        const ownerBalanceBefore = await owner.getBalance()
        const banksAmount = 1;

        const callCrowsSale = await banksCrowdSaleV3.send(
            alice.getSender(),
            {
                value: toNano(banksAmount * 1.5),
            },
            null
        )

        expect(callCrowsSale.transactions).toHaveTransaction({
            from: alice.address,
            to: banksCrowdSaleV3.address,
            success: true,
        })

        expect(callCrowsSale.transactions).toHaveTransaction({
            from: banksCrowdSaleV3.address,
            to: banksCrowdSaleV3JettonContract.address,
            success: true,
        })

        expect(callCrowsSale.transactions).toHaveTransaction({
            from: aliceJettonContract.address,
            to: alice.address,
            success: true,
        });

        const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBalanceAfter).toEqual(toNano(banksAmount));

        expect(callCrowsSale.transactions).toHaveTransaction({
            from: banksCrowdSaleV3.address,
            to: owner.address,
            success: true,
        })

        expect(ownerBalanceBefore !== await owner.getBalance()).toEqual(true)
    });

    it('should transfer 100 Bank to Alice and 100 * 1.5 TON to owner', async () => {
        const ownerBalanceBefore = await owner.getBalance()
        const banksAmount = 100;

        const callCrowsSale = await banksCrowdSaleV3.send(
            alice.getSender(),
            {
                value: toNano(banksAmount * 1.5),
            },
            null
        )

        expect(callCrowsSale.transactions).toHaveTransaction({
            from: alice.address,
            to: banksCrowdSaleV3.address,
            success: true,
        })

        expect(callCrowsSale.transactions).toHaveTransaction({
            from: banksCrowdSaleV3.address,
            to: banksCrowdSaleV3JettonContract.address,
            success: true,
        })

        expect(callCrowsSale.transactions).toHaveTransaction({
            from: aliceJettonContract.address,
            to: alice.address,
            success: true,
        });

        const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBalanceAfter).toEqual(toNano(banksAmount));

        expect(callCrowsSale.transactions).toHaveTransaction({
            from: banksCrowdSaleV3.address,
            to: owner.address,
            success: true,
        })

        expect(ownerBalanceBefore !== await owner.getBalance()).toEqual(true)
    });
});
