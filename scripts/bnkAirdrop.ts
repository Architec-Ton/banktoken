import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { getHLW } from './highloadWallet';
import { getRecipients, HLWSend } from '../utils/HLWv3-helpers';

import { buildOnchainMetadata, getJettonTransferBuilder } from '../utils/jetton-helpers';
import { NetworkProvider } from '@ton/blueprint';
import { BNKjettonParams } from './imports/const';
import * as BJW from '../build/BankJetton/tact_BankJettonWallet';
import * as BJ from '../build/BankJetton/tact_BankJetton';

import { beginCell, OutActionSendMsg, SendMode, toNano } from '@ton/core';
import { internal as internal_relaxed } from '@ton/core/dist/types/_helpers';


export async function run(provider: NetworkProvider) {
    let queryId = HighloadQueryId.fromShiftAndBitNumber(0n, 0n);

    const { keyPair, HighloadWallet } = await getHLW();

    const highloadWalletV3 = provider.open(HighloadWallet);

    const bankJettonMaster = provider.open(await BJ.BankJetton.fromInit(highloadWalletV3.address, buildOnchainMetadata(BNKjettonParams)));
    const highloadWalletV3BankJettonWallet = await bankJettonMaster.getGetWalletAddress(highloadWalletV3.address);
    const highloadWalletV3BankJettonContract = provider.open(BJW.BankJettonWallet.fromAddress(highloadWalletV3BankJettonWallet));

    const batchShift = 250;

    const recipients = getRecipients('.csv');

    for (let i = 0; i < recipients.length / batchShift; ++i) {
        const outMsgsBanks: OutActionSendMsg[] = [];
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
        }

        queryId = await HLWSend(highloadWalletV3, keyPair, outMsgsBanks, queryId);
    }
}