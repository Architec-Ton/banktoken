import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { getHLW } from './highloadWallet';
import { getRecipients, HLWSend } from '../utils/HLWv3-helpers';

import { buildOnchainMetadata } from '../utils/jetton-helpers';
import { ARCjettonParams } from './imports/const';
import * as AJ from '../build/ArcJetton/tact_ArcJetton';

import { beginCell, OutActionSendMsg, SendMode, toNano } from '@ton/core';
import { internal as internal_relaxed } from '@ton/core/dist/types/_helpers';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    let queryId = HighloadQueryId.fromShiftAndBitNumber(0n, 0n);

    const { keyPair, HighloadWallet } = await getHLW();

    const highloadWalletV3 = provider.open(HighloadWallet);

    const arcJettonMaster = provider.open(await AJ.ArcJetton.fromInit(highloadWalletV3.address, buildOnchainMetadata(ARCjettonParams)));

    const batchShift = 250;

    const recipients = getRecipients('nomis.csv');

    for (let i = 0; i < recipients.length / batchShift; ++i) {
        const outMsgsArcs: OutActionSendMsg[] = [];
        const current_recipients = recipients.slice(batchShift * i, batchShift * (i + 1));

        for (let { address, amount } of current_recipients) {
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
                                amount: toNano(amount * 10n)
                            }))
                            .endCell()
                })
            });
        }

        queryId = await HLWSend(highloadWalletV3, keyPair, outMsgsArcs, queryId);
    }
}