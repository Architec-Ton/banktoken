import {buildOnchainMetadata, getJettonTransferBuilder} from "../utils/jetton-helpers";
import {HLWSend} from "../utils/HLWv3-helpers";
import {DEFAULT_TIMEOUT, SUBWALLET_ID, maxQueryId} from "./imports/const";
import {getSecureRandomBytes, KeyPair, keyPairFromSeed} from "ton-crypto";
import {HighloadWalletV3} from "../wrappers/HighloadWalletV3";
import {HighloadQueryId} from "../wrappers/HighloadQueryId";
import {ArcJettonWallet} from "../build/ArcJetton/tact_ArcJettonWallet";
import {ArcJetton, JettonTransfer, storeJettonTransfer} from '../build/ArcJetton/tact_ArcJetton';

import {beginCell, Cell, OutActionSendMsg, SendMode, toNano, internal as internal_relaxed} from '@ton/core';
import {compile} from "@ton/blueprint";
import {Blockchain, SandboxContract, TreasuryContract} from '@ton/sandbox';
import {randomAddress} from "@ton/test-utils";
import * as BJ /* { BankJetton, JettonBurn } */ from '../build/BankJetton/tact_BankJetton';

import {randomInt} from "node:crypto";


describe('ARC Airdrop test', () => {
    let owner: SandboxContract<TreasuryContract>;
    let blockchain: Blockchain;

    let keyPair: KeyPair;
    let code: Cell;
    let highloadWalletV3: SandboxContract<HighloadWalletV3>;

    let ARCJetton: SandboxContract<ArcJetton>;
    let HLWv3JettonContract: SandboxContract<ArcJettonWallet>;
    let bankJetton: SandboxContract<BJ.BankJetton>;

    const jettonParams = {
        name: "ARC jetton",
        description: "This is description for ARC jetton",
        symbol: "ARC",
        image: "https://www.com/ARCjetton.png"
    };

    const BNKjettonParams = {
        name: 'BNK jetton',
        description: 'This is description for BNK jetton',
        symbol: 'BNK',
        image: 'https://www.com/BNKjetton.json',
    };

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1000;
        keyPair = keyPairFromSeed(await getSecureRandomBytes(32));
        code = await compile('HighloadWalletV3');

        highloadWalletV3 = blockchain.openContract(
            HighloadWalletV3.createFromConfig(
                {
                    publicKey: keyPair.publicKey,
                    subwalletId: SUBWALLET_ID,
                    timeout: DEFAULT_TIMEOUT
                },
                code
            )
        );

        const deployer = await blockchain.treasury('deployer');

        const deployHLWResult = await highloadWalletV3.sendDeploy(deployer.getSender(), toNano('999999'));

        expect(deployHLWResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: highloadWalletV3.address,
            deploy: true
        });

        owner = await blockchain.treasury('owner', {balance: toNano(10000)});
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

        // expect(deployResultBNK.transactions).toHaveTransaction({
        //     from: owner.address,
        //     to: bankJetton.address,
        //     deploy: true,
        //     success: true,
        // });



        ARCJetton = blockchain.openContract(await ArcJetton.fromInit(owner.address,  buildOnchainMetadata(jettonParams)));
        const deployJettonResult = await ARCJetton.send(
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
            to: ARCJetton.address,
            deploy: true,
            success: true,
        });

        const banks = 100000
        const mintXHundred = await ARCJetton.send(
            owner.getSender(),
            {
                value: toNano('1'),
            },
            {
                $$type: 'Mint',
                to: owner.address,
                amount: toNano(banks * 100),
            },
        )

        expect(mintXHundred.transactions).toHaveTransaction({
            from: owner.address,
            to: ARCJetton.address,
            success: true,
        });

        const jettonData = await ARCJetton.getGetJettonData()
        expect(jettonData.total_supply).toEqual(toNano(banks * 100))

        const ownerJettonWallet = await ARCJetton.getGetWalletAddress(owner.address)
        const ownerJettonContract = blockchain.openContract(ArcJettonWallet.fromAddress(ownerJettonWallet));
        const ownerARCBalance = (await ownerJettonContract.getGetWalletData()).balance;
        expect(ownerARCBalance).toEqual(toNano(banks * 100));

        const jettonTransfer: JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            amount: toNano(banks * 100),
            destination: highloadWalletV3.address,
            response_destination: highloadWalletV3.address,
            custom_payload: beginCell().endCell(),
            forward_ton_amount: 0n,
            forward_payload: beginCell().endCell(),
        }

        await ownerJettonContract.send(
            owner.getSender(),
            {
                value: toNano('1')
            },
            jettonTransfer
        )

        const HLWv3JettonWallet = await ARCJetton.getGetWalletAddress(highloadWalletV3.address)
        HLWv3JettonContract = blockchain.openContract(ArcJettonWallet.fromAddress(HLWv3JettonWallet));

        const HLWv3BalanceAfter = (await HLWv3JettonContract.getGetWalletData()).balance;
        expect(HLWv3BalanceAfter).toEqual(toNano(banks * 100));
    });

    it('should airdrop to 254 addresses', async () => {
        const oldJettonData = await ARCJetton.getGetJettonData()

        const curQuery = new HighloadQueryId();

        const num = 254
        const amount = 100n

        let holdersAddresses = Array(num)
        let outMsgs: OutActionSendMsg[] = new Array(num);

        for (let i = 0; i < num; i++) {
            holdersAddresses[i] = randomAddress()

            outMsgs[i] = {
                type: 'sendMsg',
                mode: SendMode.NONE,
                outMsg: internal_relaxed({
                    to: HLWv3JettonContract.address,
                    value: toNano('1'),
                    body:
                        beginCell()
                            .store(storeJettonTransfer(getJettonTransferBuilder(holdersAddresses[i], amount)))
                            .endCell()
                }),
            }
        }

        const res = await HLWSend(highloadWalletV3, keyPair, outMsgs, curQuery, 1000);

        expect(res.transactions).toHaveTransaction({
            on: highloadWalletV3.address,
            outMessagesCount: num
        });

        for (let i = 0; i < num; i++) {
            expect(res.transactions).toHaveTransaction({
                from: highloadWalletV3.address,
                to: HLWv3JettonContract.address,
                body: outMsgs[i].outMsg.body
            })

            const walletAddress = await ARCJetton.getGetWalletAddress(holdersAddresses[i]);
            expect(res.transactions).toHaveTransaction({
                from: HLWv3JettonContract.address,
                to: walletAddress,
                success: true,
            });

            const jettonContract = blockchain.openContract(ArcJettonWallet.fromAddress(walletAddress));
            const balanceAfter = (await jettonContract.getGetWalletData()).balance;
            expect(balanceAfter).toEqual(toNano(amount));
        }

        expect(await highloadWalletV3.getProcessed(curQuery)).toBe(true);

        const curJettonData = await ARCJetton.getGetJettonData()
        expect(oldJettonData.total_supply).toEqual(curJettonData.total_supply)
    });


    it('should airdrop to 2024 addresses', async () => {
        const oldJettonData = await ARCJetton.getGetJettonData()

        let bitnumber = 0n
        let shift = 0n

        let outMsgs: OutActionSendMsg[];
        const recipients = []
        const batchShift = 250

        for (let i = 0; i < 2024; i++) {
            recipients.push({
                address: randomAddress(),
                amount: BigInt(randomInt(10, 100))
            })
        }

        for (let i = 0; i < recipients.length / batchShift; ++i) {
            outMsgs = []
            const current_recipients = recipients.slice(batchShift * i, batchShift * (i + 1))

            for (let {address, amount} of current_recipients) {
                outMsgs.push({
                    type: 'sendMsg',
                    mode: SendMode.NONE,
                    outMsg: internal_relaxed({
                        to: HLWv3JettonContract.address,
                        value: toNano('1'),
                        body:
                            beginCell()
                                .store(storeJettonTransfer(getJettonTransferBuilder(address, amount)))
                                .endCell()
                    }),
                })
            }

            if (bitnumber > maxQueryId) {
                ++shift
                bitnumber = 0n
            }
            const queryId = HighloadQueryId.fromShiftAndBitNumber(shift, bitnumber)
            const createdAt = blockchain.now - 100

            await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId, createdAt)

            expect(await highloadWalletV3.getProcessed(queryId)).toBe(true);

            ++bitnumber
        }

        for (let {address, amount} of recipients) {
            const walletAddress = await ARCJetton.getGetWalletAddress(address);
            const jettonContract = blockchain.openContract(ArcJettonWallet.fromAddress(walletAddress));
            const balanceAfter = (await jettonContract.getGetWalletData()).balance;
            expect(balanceAfter).toEqual(toNano(amount));
        }

        console.log("Shift: ", shift, "\tBitnumber: ", bitnumber)
        const curJettonData = await ARCJetton.getGetJettonData()
        expect(oldJettonData.total_supply).toEqual(curJettonData.total_supply)
    })
});
