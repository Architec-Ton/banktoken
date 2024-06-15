import {Address, beginCell, internal as internal_relaxed, OutActionSendMsg, SendMode, toNano} from '@ton/core';
import {HighloadWalletV3} from '../wrappers/HighloadWalletV3';
import '@ton/test-utils';
import {KeyPair, mnemonicToPrivateKey} from "ton-crypto";
import {DEFAULT_TIMEOUT, maxQueryId, SUBWALLET_ID} from "./imports/const";
import {NetworkProvider} from '@ton/blueprint';
import {HighloadQueryId} from "../wrappers/HighloadQueryId";
import 'dotenv/config'
import {JettonMint, storeJettonMint} from "../build/ArcJetton/tact_ArcJetton";

let keyPair: KeyPair;
let highloadWalletV3: any

require('dotenv').config()


export async function run(provider: NetworkProvider, args: string[]) {
    async function HLWSend(outMsgs: OutActionSendMsg[]) {
        const bitnumber = 12n
        let shift = 0n
        if (bitnumber > maxQueryId) {
            ++shift
        }
        const queryId = HighloadQueryId.fromShiftAndBitNumber(shift, bitnumber)

        const createdAt = Math.floor(Date.now() / 1000 - 100)

        const res = await highloadWalletV3.sendBatch(keyPair.secretKey, outMsgs, SUBWALLET_ID, queryId, DEFAULT_TIMEOUT, createdAt);
        console.log(res);
        console.log('Next bitnumber: ' + bitnumber, 'Next shift: ' + shift)

        expect(res.transactions).toHaveTransaction({
            on: highloadWalletV3.address,
            outMessagesCount: outMsgs.length
        });

        for (let i = 0; i < outMsgs.length; i++) {
            expect(res.transactions).toHaveTransaction({
                from: highloadWalletV3.address,
                body: outMsgs[i].outMsg.body
            })
        }
        expect(await highloadWalletV3.getProcessed(queryId)).toBe(true);
        console.log(highloadWalletV3.address)
    }

    const ui = provider.ui();
    keyPair = await mnemonicToPrivateKey(process.env.WALLET_MNEMONIC!.split(' '));

    const address_HLW = Address.parse(process.env.HLWCONTRACT_ADDRESS!);
    if (!(await provider.isContractDeployed(address_HLW))) {
        ui.write(`Error: HLW Contract at address ${address_HLW} is not deployed!`);
        return;
    }
    const address_jetton = Address.parse(process.env.JETTON_ADDRESS!);

    if (!(await provider.isContractDeployed(address_HLW))) {
        ui.write(`Error: HLW Contract at address ${address_HLW} is not deployed!`);
        return;
    }

    highloadWalletV3 = provider.open(
        HighloadWalletV3.createFromAddress(address_HLW)
    );


    let outMsgs: OutActionSendMsg[];
    try {
        const recipients = [
            {address: 'UQCjaozbXUT-iIqMjBfuRC0OoJUZhxwnzH8UiLPtdso5Ecyu', amount: 3},
            {address: 'UQBVZhqyseLY0maGkoXwhUOOO7-4BCfDQ8UQf2YcBEbe3CoK', amount: 5}
        ]

        const batchShift = 250

        for (let i = 0; i < recipients.length / batchShift; ++i) {
            outMsgs = []

            for (let {address, amount} of recipients.slice(batchShift * i, (batchShift + 1) * i)) {
                const src: JettonMint = {
                    $$type: 'JettonMint',
                    origin: Address.parse(address),
                    receiver: Address.parse(address),
                    amount: BigInt(amount),
                    custom_payload: null,
                    forward_ton_amount: 0n,
                    forward_payload: beginCell().endCell()
                }

                outMsgs.push({
                    type: 'sendMsg',
                    mode: SendMode.IGNORE_ERRORS,
                    outMsg: internal_relaxed({
                        to: address_jetton,
                        value: toNano('0.05'),
                        body:  beginCell()
                            .store(storeJettonMint(src))
                            .endCell()
                    }),
                })
            }

            await HLWSend(outMsgs)
        }
    } catch (err) {
        console.error(err);
    }
}