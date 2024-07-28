import { Address, beginCell, OutActionSendMsg, SendMode, toNano } from '@ton/core';
import '@ton/test-utils';
import { NetworkProvider, sleep } from '@ton/blueprint';

import { HLWSend } from '../utils/HLWv3-helpers';
import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { internal as internal_relaxed } from '@ton/core/dist/types/_helpers';
import { getHLW } from './highloadWallet';


export async function run(provider: NetworkProvider) {
    const ownerAddress = Address.parse('')
    let queryId = HighloadQueryId.fromShiftAndBitNumber(0n, 12n);
    const {keyPair, HighloadWallet} = await getHLW()

    const highloadWalletV3 = provider.open(HighloadWallet);

    const returnCoins: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.CARRY_ALL_REMAINING_BALANCE,
        outMsg: internal_relaxed({
            to: ownerAddress,
            value: 0n,
            body: beginCell().endCell()
        })
    };

    let outMsgs = [returnCoins]
    let createdAt = Math.floor(Date.now() / 1000 - 100);
    await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId, createdAt);
    while (!highloadWalletV3.getProcessed(queryId)) {
        await sleep(2000);
        console.log('wait for processing')
    }
    queryId = queryId.getNext();
    console.log(queryId)
}