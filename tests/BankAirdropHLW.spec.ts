import { buildOnchainMetadata, getJettonTransferBuilder } from '../utils/jetton-helpers';
import { DEFAULT_TIMEOUT, maxQueryId, SUBWALLET_ID } from './imports/const';
import { getSecureRandomBytes, KeyPair, keyPairFromSeed } from 'ton-crypto';
import { HighloadWalletV3 } from '../wrappers/HighloadWalletV3';
import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { BankJettonWallet } from '../build/BankJetton/tact_BankJettonWallet';
import { BankJetton, JettonTransfer, storeJettonTransfer } from '../build/BankJetton/tact_BankJetton';

import { beginCell, Cell, internal as internal_relaxed, OutActionSendMsg, SendMode, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { randomAddress } from '@ton/test-utils';

import { randomInt } from 'node:crypto';

async function HLWSend(highloadWalletV3: any, keyPair: KeyPair,
                       outMsgs: OutActionSendMsg[], queryId: HighloadQueryId, createdAt: number) {

    return await highloadWalletV3.sendBatch(keyPair.secretKey, outMsgs, SUBWALLET_ID, queryId, DEFAULT_TIMEOUT, createdAt);
}

describe('ARC Airdrop test', () => {
    let owner: SandboxContract<TreasuryContract>;
    let blockchain: Blockchain;

    let keyPair: KeyPair;
    let code: Cell;
    let highloadWalletV3: SandboxContract<HighloadWalletV3>;

    let BNKJetton: SandboxContract<BankJetton>;
    let HLWv3JettonContract: SandboxContract<BankJettonWallet>;

    const jettonParams = {
        name: "ARC jetton",
        description: "This is description for ARC jetton",
        symbol: "ARC",
        image_data: "https://www.com/BankJetton.png",
        decimals: '0'
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

        const banks = 3000000

        const jettonData = await BNKJetton.getGetJettonData()
        expect(jettonData.total_supply).toEqual(BigInt(banks))

        const ownerJettonWallet = await BNKJetton.getGetWalletAddress(owner.address)
        const ownerJettonContract = blockchain.openContract(BankJettonWallet.fromAddress(ownerJettonWallet));
        const ownerARCBalance = (await ownerJettonContract.getGetWalletData()).balance;
        expect(ownerARCBalance).toEqual(BigInt(banks));

        const jettonTransfer: JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            amount: 2700000n,
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

        const HLWv3JettonWallet = await BNKJetton.getGetWalletAddress(highloadWalletV3.address)
        HLWv3JettonContract = blockchain.openContract(BankJettonWallet.fromAddress(HLWv3JettonWallet));

        const HLWv3BalanceAfter = (await HLWv3JettonContract.getGetWalletData()).balance;
        expect(HLWv3BalanceAfter).toEqual(2700000n);
    }, 10000000);

    it('should airdrop to 254 addresses', async () => {
        const oldJettonData = await BNKJetton.getGetJettonData()

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
                            .store(storeJettonTransfer(getJettonTransferBuilder(holdersAddresses[i], amount, holdersAddresses[i], false)))
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

            const walletAddress = await BNKJetton.getGetWalletAddress(holdersAddresses[i]);
            expect(res.transactions).toHaveTransaction({
                from: HLWv3JettonContract.address,
                to: walletAddress,
                success: true,
            });

            const jettonContract = blockchain.openContract(BankJettonWallet.fromAddress(walletAddress));
            const balanceAfter = (await jettonContract.getGetWalletData()).balance;
            expect(balanceAfter).toEqual(amount);
        }

        expect(await highloadWalletV3.getProcessed(curQuery)).toBe(true);

        const curJettonData = await BNKJetton.getGetJettonData()
        expect(oldJettonData.total_supply).toEqual(curJettonData.total_supply)
    }, );


    it('should airdrop to 2024 addresses', async () => {
        const oldJettonData = await BNKJetton.getGetJettonData()

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
                                .store(storeJettonTransfer(getJettonTransferBuilder(address, amount, address, false)))
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
            const walletAddress = await BNKJetton.getGetWalletAddress(address);
            const jettonContract = blockchain.openContract(BankJettonWallet.fromAddress(walletAddress));
            const balanceAfter = (await jettonContract.getGetWalletData()).balance;
            expect(balanceAfter).toEqual(amount);
        }

        console.log("Shift: ", shift, "\tBitnumber: ", bitnumber)
        const curJettonData = await BNKJetton.getGetJettonData()
        expect(oldJettonData.total_supply).toEqual(curJettonData.total_supply)
    })
});
