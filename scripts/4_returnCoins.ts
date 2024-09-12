import { Address, beginCell, OutActionSendMsg, SendMode } from '@ton/core';
import '@ton/test-utils';
import { NetworkProvider } from '@ton/blueprint';

import { HLWSend } from '../utils/HLWv3-helpers';
import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { internal as internal_relaxed } from '@ton/core/dist/types/_helpers';
import { getHLW } from './highloadWallet';


export async function run(provider: NetworkProvider) {
    let queryId = HighloadQueryId.fromShiftAndBitNumber(0n, 0n);
    const { keyPair, HighloadWallet } = await getHLW();

    const highloadWalletV3 = provider.open(HighloadWallet);
    console.log(highloadWalletV3.address);

    const returnCoins: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.CARRY_ALL_REMAINING_BALANCE,
        outMsg: internal_relaxed({
            to: Address.parse('0QCj0zI66mVKC_kkRZ-63e7uR9tcpHWxS-C-W-P_Xeroso3_'),
            value: 0n,
            body: beginCell().endCell()
        })
    };

    let outMsgs = [returnCoins];
    await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId);
}