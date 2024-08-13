import {maxQueryId} from "../tests/imports/const";
import {storeJettonTransfer} from "../build/ArcJetton/tact_ArcJetton";
import {HLWSend} from "../utils/HLWv3-helpers";
import {getJettonTransferBuilder} from "../utils/jetton-helpers";
import {HighloadQueryId} from "../wrappers/HighloadQueryId";
import {HighloadWalletV3} from '../wrappers/HighloadWalletV3';
import { ARCjettonParams, BNKjettonParams, DEFAULT_TIMEOUT, SUBWALLET_ID } from './imports/const';
import {Address, beginCell, internal as internal_relaxed, OutActionSendMsg, SendMode, toNano} from '@ton/core';
import '@ton/test-utils';
import {NetworkProvider, compile} from '@ton/blueprint';
import {KeyPair, mnemonicToPrivateKey} from "ton-crypto";
import * as AJ from '../build/ArcJetton/tact_ArcJetton';
import { buildOnchainMetadata } from '../utils/jetton-helpers';

import 'dotenv/config'

let keyPair: KeyPair;
let highloadWalletV3: any

require('dotenv').config()

export async function getHLW() {
    const mnemonic = process.env.WALLET_MNEMONIC!.split(' ')//process.env.HLW_WALLET_MNEMONIC!.split(' ');
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const code = await compile('HighloadWalletV3');

    const HighloadWallet = HighloadWalletV3.createFromConfig(
        {
            publicKey: keyPair.publicKey,
            subwalletId: SUBWALLET_ID,
            timeout: DEFAULT_TIMEOUT
        },
        code
    )

    return {keyPair, HighloadWallet}
}


export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();
    const {keyPair, HighloadWallet} = await getHLW()

    const highloadWalletV3 = provider.open(HighloadWallet);
    // const address_HLW = Address.parse(process.env.HLWCONTRACT_ADDRESS!);
    // if (!(await provider.isContractDeployed(address_HLW))) {
    //     ui.write(`Error: HLW Contract at address ${address_HLW} is not deployed!`);
    //     return;
    // }
    const arcJettonMaster = provider.open(await AJ.ArcJetton.fromInit(highloadWalletV3.address, buildOnchainMetadata(ARCjettonParams)));



    let bitnumber = 82n
    let shift = 0n

    try {
        let outMsgs: OutActionSendMsg[];
        const recipients = [
            {address: 'UQAk5Tz3YE4OsRUeRnOKb3jq1YjGT9vhiw92bv6pRnn439SI', amount: 10},
            // {address: 'UQBVZhqyseLY0maGkoXwhUOOO7-4BCfDQ8UQf2YcBEbe3CoK', amount: 5}
        ]

        const batchShift = 250

        for (let i = 0; i < recipients.length / batchShift; ++i) {
            outMsgs = []

            for (let {address, amount} of recipients.slice(batchShift * i, (batchShift + 1) * i)) {
                outMsgs.push({
                    type: 'sendMsg',
                    mode: SendMode.IGNORE_ERRORS,
                    outMsg: internal_relaxed({
                        to: arcJettonMaster.address,
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
            await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId)

            ++bitnumber
        }
    } catch (err) {
        console.error(err);
    }
}