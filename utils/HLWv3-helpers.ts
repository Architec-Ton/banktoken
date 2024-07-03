import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { DEFAULT_TIMEOUT, SUBWALLET_ID } from '../scripts/imports/const';

import { KeyPair } from 'ton-crypto';
import { OutActionSendMsg } from '@ton/core';

export async function HLWSend(highloadWalletV3: any, keyPair: KeyPair, outMsgs: OutActionSendMsg[], queryId: HighloadQueryId, createdAt: number) {
    return await highloadWalletV3.sendBatch(keyPair.secretKey, outMsgs, SUBWALLET_ID, queryId, DEFAULT_TIMEOUT, createdAt)
}