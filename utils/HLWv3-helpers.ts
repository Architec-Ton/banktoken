import { HighloadWalletV3 } from '../wrappers/HighloadWalletV3';
import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { KeyPair } from 'ton-crypto';
import { DEFAULT_TIMEOUT, SUBWALLET_ID } from '../scripts/imports/const';

import * as BJ from '../build/BankJetton/tact_BankJetton';
import { getJettonTransferBuilder } from './jetton-helpers';
import { BankJettonWallet } from '../build/BankJetton/tact_BankJettonWallet';
import * as AJ from '../build/ArcJetton/tact_ArcJetton';
import { ArcJetton } from '../build/ArcJetton/tact_ArcJetton';

import { Address, beginCell, OpenedContract, OutActionSendMsg, SendMode, toNano } from '@ton/core';
import { sleep } from '@ton/blueprint';
import { internal as internal_relaxed } from '@ton/core/dist/types/_helpers';

import fs from 'node:fs';


export function getRecipients(rows: string[], amount=0n) {
    const recipients = [];

    for (let csvrow of rows) {
        const columns = csvrow.split(';');
        recipients.push({
            address: Address.parse(columns[0]),
            amount: amount ? amount : BigInt(columns[1])
        });
    }

    return recipients
}

export function BankTransferMsgBuilder(bankJettonContract: OpenedContract<BankJettonWallet>, owner: any) {
    return (address: Address, amount: bigint) => {
        return {
            to: bankJettonContract.address,
            value: toNano('0.07'),
            body:
                beginCell()
                    .store(BJ.storeJettonTransfer(getJettonTransferBuilder(address, amount, owner.address, false)))
                    .endCell()
        };
    };
}

export async function HLWAirdrop(highloadWalletV3: OpenedContract<HighloadWalletV3>, keyPair: KeyPair, queryId: HighloadQueryId,
                                 highloadWalletV3BankJettonContract: OpenedContract<BankJettonWallet>,
                                 arcJettonMaster: OpenedContract<ArcJetton>, filename: string, amount: bigint) {
    const batchShift = 250;

    const fileAirdrop = fs.readFileSync('./airdrop_files/' + filename, 'utf8');
    const rows = fileAirdrop.split('\n');

    const recipients = getRecipients(rows, amount)

    for (let i = 0; i < recipients.length / batchShift; ++i) {
        const outMsgsBanks: OutActionSendMsg[] = [];
        const outMsgsArcs: OutActionSendMsg[] = [];
        const current_recipients = recipients.slice(batchShift * i, batchShift * (i + 1));

        for (let { address, amount } of current_recipients) {
            outMsgsBanks.push({
                type: 'sendMsg',
                mode: SendMode.IGNORE_ERRORS,
                outMsg: internal_relaxed({
                    to: highloadWalletV3BankJettonContract.address,
                    value: toNano('0.07'),
                    body:
                        beginCell()
                            .store(BJ.storeJettonTransfer(getJettonTransferBuilder(address, amount, highloadWalletV3.address, false)))
                            .endCell()
                })
            });

            // let multi = 100n
            // if (nomises.has(address.toString())) {
            //     multi = 110n
            // }
            outMsgsArcs.push({
                type: 'sendMsg',
                mode: SendMode.IGNORE_ERRORS,
                outMsg: internal_relaxed({
                    to: arcJettonMaster.address,
                    value: toNano('0.07'),
                    body:
                        beginCell()
                            .store(AJ.storeMint({
                                $$type: 'Mint',
                                to: address,
                                amount: toNano(amount * 100n)// * multi)
                            }))
                            .endCell()
                })
            });
        }

        let createdAt = Math.floor(Date.now() / 1000 - 100);
        await HLWSend(highloadWalletV3, keyPair, outMsgsBanks, queryId, createdAt);
        while (!highloadWalletV3.getProcessed(queryId)) {
            await sleep(2000);console.log('wait for processing')
        }
        queryId = queryId.getNext();
        console.log(queryId)

        createdAt = Math.floor(Date.now() / 1000 - 100);
        await HLWSend(highloadWalletV3, keyPair, outMsgsArcs, queryId, createdAt);
        while (!highloadWalletV3.getProcessed(queryId)) {
            await sleep(2000);console.log('wait for processing')
        }
        queryId = queryId.getNext();
        console.log(queryId)
    }
}

export async function HLWSend(highloadWalletV3: any, keyPair: KeyPair, outMsgs: OutActionSendMsg[], queryId: HighloadQueryId, createdAt: number) {
    return await highloadWalletV3.sendBatch(keyPair.secretKey, outMsgs, SUBWALLET_ID, queryId, DEFAULT_TIMEOUT, createdAt);
}