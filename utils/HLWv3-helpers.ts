import {HighloadQueryId} from "../wrappers/HighloadQueryId";
import {DEFAULT_TIMEOUT, SUBWALLET_ID} from "../scripts/imports/const";

import {KeyPair} from "ton-crypto";
import {OutActionSendMsg} from "@ton/core";

export async function HLWSend(highloadWalletV3: any, keyPair: KeyPair, outMsgs: OutActionSendMsg[], queryId: HighloadQueryId, createdAt: number) {
    const res = await highloadWalletV3.sendBatch(keyPair.secretKey, outMsgs, SUBWALLET_ID, queryId, DEFAULT_TIMEOUT, createdAt);

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
    // expect(await highloadWalletV3.getProcessed(queryId)).toBe(true);

    return res
}