import {maxQueryId} from "../tests/imports/const";
import {storeJettonTransfer} from "../build/ArcJetton/tact_ArcJetton";
import {HLWSend} from "../utils/HLWv3-helpers";
import {getJettonTransferBuilder} from "../utils/jetton-helpers";
import {HighloadQueryId} from "../wrappers/HighloadQueryId";
import {HighloadWalletV3} from '../wrappers/HighloadWalletV3';

import {Address, beginCell, internal as internal_relaxed, OutActionSendMsg, SendMode, toNano} from '@ton/core';
import '@ton/test-utils';
import {NetworkProvider} from '@ton/blueprint';
import {KeyPair, mnemonicToPrivateKey} from "ton-crypto";

import 'dotenv/config'

let keyPair: KeyPair;
let highloadWalletV3: any

require('dotenv').config()


export async function run(provider: NetworkProvider, args: string[]) {
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

    let bitnumber = 0n
    let shift = 0n

    try {
        let outMsgs: OutActionSendMsg[];
        const recipients = [
            {address: 'UQCjaozbXUT-iIqMjBfuRC0OoJUZhxwnzH8UiLPtdso5Ecyu', amount: 3},
            {address: 'UQBVZhqyseLY0maGkoXwhUOOO7-4BCfDQ8UQf2YcBEbe3CoK', amount: 5}
        ]

        const batchShift = 250

        for (let i = 0; i < recipients.length / batchShift; ++i) {
            outMsgs = []

            for (let {address, amount} of recipients.slice(batchShift * i, (batchShift + 1) * i)) {
                outMsgs.push({
                    type: 'sendMsg',
                    mode: SendMode.IGNORE_ERRORS,
                    outMsg: internal_relaxed({
                        to: address_jetton,
                        value: toNano('0.05'),
                        body:  beginCell()
                            .store(storeJettonTransfer(getJettonTransferBuilder(Address.parse(address), amount)))
                            .endCell()
                    }),
                })
            }

            if (bitnumber > maxQueryId) {
                ++shift
                bitnumber = 0n
            }
            const queryId = HighloadQueryId.fromShiftAndBitNumber(shift, bitnumber)
            const createdAt = Math.floor(Date.now() / 1000 - 100)
            await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId, createdAt)

            ++bitnumber
        }
    } catch (err) {
        console.error(err);
    }
}