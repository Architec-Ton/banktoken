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
    const totalBanksOffset = 107613n

    const jettonParams = {
        name: "BNK jetton",
        description: "This is description for BNK jetton",
        symbol: "BNK",
        image: "https://www.com/BankJetton.png"
    };

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1000;

        owner = await blockchain.treasury('owner', {balance: toNano(1000000)});
        alice = await blockchain.treasury('alice', {balance: toNano(2000000 * 3.2)});

        BNKJetton = blockchain.openContract(await BankJetton.fromInit(owner.address, buildOnchainMetadata(jettonParams)));
        const deployJettonResult = await BNKJetton.send(
            owner.getSender(),
            {
                value: toNano('1'),
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

        banksCrowdSaleV3 = blockchain.openContract(await BanksCrowdSaleV3.fromInit());
        const deployBanksCrowdSaleV3Result = await banksCrowdSaleV3.send(
            owner.getSender(),
            {
                value: toNano('100000'),
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

        const banks = 3000000n

        const jettonData = await BNKJetton.getGetJettonData()
        expect(jettonData.total_supply).toEqual(banks)

        const ownerJettonWallet = await BNKJetton.getGetWalletAddress(owner.address)
        const ownerJettonContract = blockchain.openContract(BankJettonWallet.fromAddress(ownerJettonWallet));
        const ownerBNKBalance = (await ownerJettonContract.getGetWalletData()).balance;
        expect(ownerBNKBalance).toEqual(banks);

        const jettonTransfer: JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            amount: 2800000n,
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
        expect(banksCrowdSaleV3BalanceAfter).toEqual(2800000n);

        expect(transfer.transactions).toHaveTransaction({
            from: ownerJettonContract.address,
            to: banksCrowdSaleV3JettonContract.address,
            success: true,
            deploy: true
        })

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

        const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBalanceAfter).toEqual(BigInt(banksAmount));

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

        await banksCrowdSaleV3.send(
            alice.getSender(),
            {
                value: toNano(banksAmount * 1.5),
            },
            null
        )

        const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBalanceAfter).toEqual(BigInt(banksAmount));

        expect(ownerBalanceBefore !== await owner.getBalance()).toEqual(true)
    });

    it('should return amount of banks after crowd sale + banksOffset', async () => {
        const banksAmount = 100;
        await banksCrowdSaleV3.send(
            alice.getSender(),
            {
                value: toNano(banksAmount * 1.5 + 1),
            },
            null
        )

        expect(await banksCrowdSaleV3.getTotalBanks()).toEqual(totalBanksOffset + BigInt(banksAmount))
    })

    it('should check getters on 100 random wallets', async () => {
        const banksAmount = 100;

        let randoms = [];
        for (let i = 0; i < 100; ++i) {
            randoms.push(await blockchain.treasury(i.toString(), {balance: toNano(100 * 1.6)}))
            await banksCrowdSaleV3.send(
                    randoms.at(-1).getSender(),
                    {
                        value: toNano(banksAmount * 1.5 + 1),
                    },
                    i % 2 == 0? null : "buyBank"
            )
        }

        for (let rnd of randoms) {
            const rndWallet = await BNKJetton.getGetWalletAddress(rnd.address)
            const rndContract = blockchain.openContract(BankJettonWallet.fromAddress(rndWallet))
            const balance = (await rndContract.getGetWalletData()).balance

            expect(balance).toEqual(BigInt(banksAmount));
        }

        expect(await banksCrowdSaleV3.getTotalBanks()).toEqual(totalBanksOffset + BigInt(banksAmount * 100))
    })

    it('check stop and resume sale', async () => {
        const banksAmount = 100;
        await banksCrowdSaleV3.send(
            alice.getSender(),
            {
                value: toNano(banksAmount * 1.5 + 1),
            },
            null
        )
        const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;

        await banksCrowdSaleV3.send(
            owner.getSender(),
            {
                value: toNano(0.05),
            },
            "stopSale"
        )

        const failedCrowdSale = await banksCrowdSaleV3.send(
            alice.getSender(),
            {
                value: toNano(banksAmount * 1.5 + 1),
            },
            null
        )

        expect(failedCrowdSale.transactions).toHaveTransaction(
            {
                from: alice.address,
                to: banksCrowdSaleV3.address,
                success: false
            }
        )
        expect(aliceBalanceAfter).toEqual(BigInt(banksAmount));

        await banksCrowdSaleV3.send(
            owner.getSender(),
            {
                value: toNano(0.05),
            },
            "resumeSale"
        )

        const carryCrowdSale = await banksCrowdSaleV3.send(
            alice.getSender(),
            {
                value: toNano(banksAmount * 1.5 + 1),
            },
            null
        )
        const aliceBalanceNow = (await aliceJettonContract.getGetWalletData()).balance;

        expect(carryCrowdSale.transactions).toHaveTransaction(
            {
                from: alice.address,
                to: banksCrowdSaleV3.address,
                success: true
            }
        )
        expect(aliceBalanceNow).toEqual(BigInt(banksAmount * 2));
    })

    it('should send banks and ref banks to alice and tony', async () => {
        const banksAmount = 100;

        await banksCrowdSaleV3.send(
            alice.getSender(),
            {
                value: toNano(banksAmount * 1.5),
            },
            null
        )

        const tony = await blockchain.treasury('tony', {balance: toNano(banksAmount * 1.6)})
        const tonyJettonWallet = await BNKJetton.getGetWalletAddress(tony.address)
        const tonyJettonContract = blockchain.openContract(BankJettonWallet.fromAddress(tonyJettonWallet))

        const refCrowdSale = await banksCrowdSaleV3.send(
            tony.getSender(),
            {
                value: toNano(banksAmount * 1.5),
            },
            {
                $$type: 'ReferralAddress',
                referral: alice.address
            }
        )

        expect(refCrowdSale.transactions).toHaveTransaction({
            from: banksCrowdSaleV3JettonContract.address,
            to: tonyJettonWallet,
            success: true,
        })
        expect(refCrowdSale.transactions).toHaveTransaction({
            from: banksCrowdSaleV3JettonContract.address,
            to: aliceJettonContract.address,
            success: true,
        })

        const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBalanceAfter).toEqual(BigInt(banksAmount * 2));
        const tonyBalanceAfter = (await tonyJettonContract.getGetWalletData()).balance;
        expect(tonyBalanceAfter).toEqual(BigInt(banksAmount));
    })

    it('should change owner and get access denied', async () => {
        const newOwner = await blockchain.treasury('multisig', {balance: toNano(100)})

        await banksCrowdSaleV3.send(
            owner.getSender(),
            {
                value: toNano(0.5),
            },
            {
                $$type: 'SetNewOwner',
                new_owner: newOwner.address
            }
        )

        const errorTry = await banksCrowdSaleV3.send(
            owner.getSender(),
            {
                value: toNano(0.5),
            },
            "stopSale"
        )

        expect(errorTry.transactions).toHaveTransaction({
            from: owner.address,
            to: banksCrowdSaleV3.address,
            success: false,
        })

        const goodTry = await banksCrowdSaleV3.send(
            newOwner.getSender(),
            {
                value: toNano(0.5),
            },
            "stopSale"
        )

        expect(goodTry.transactions).toHaveTransaction({
            from: newOwner.address,
            to: banksCrowdSaleV3.address,
            success: true,
        })

    })
});
