import { beginCell, OutActionSendMsg, SendMode, toNano } from '@ton/core';
import '@ton/test-utils';
import { NetworkProvider } from '@ton/blueprint';

import { HLWSend } from '../utils/HLWv3-helpers';
import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { internal as internal_relaxed } from '@ton/core/dist/types/_helpers';
import { getHLW } from './highloadWallet';
import * as BJW from '../build/BankJetton/tact_BankJettonWallet';
import * as BJ from '../build/BankJetton/tact_BankJetton';
import { buildOnchainMetadata } from '../utils/jetton-helpers';
import { ARCjettonParams, BNKjettonParams } from './imports/const';
import * as AJ from '../build/ArcJetton/tact_ArcJetton';
import * as CS from '../build/BanksCrowdSaleV3/tact_BanksCrowdSaleV3';


export async function run(provider: NetworkProvider) {
    let queryId = HighloadQueryId.fromShiftAndBitNumber(0n, 0n);
    const { keyPair, HighloadWallet } = await getHLW();

    const highloadWalletV3 = provider.open(HighloadWallet);
    console.log(highloadWalletV3.address);

    const bankJettonMaster = provider.open(await BJ.BankJetton.fromInit(highloadWalletV3.address, buildOnchainMetadata(BNKjettonParams)));

    const arcJettonMaster = provider.open(await AJ.ArcJetton.fromInit(highloadWalletV3.address, buildOnchainMetadata(ARCjettonParams)));

    const banksCrowdSaleV3 = provider.open(await CS.BanksCrowdSaleV3.fromInit(bankJettonMaster.address));

    const highloadWalletV3BankJettonWallet = await bankJettonMaster.getGetWalletAddress(highloadWalletV3.address);
    const highloadWalletV3BankJettonContract = provider.open(BJW.BankJettonWallet.fromAddress(highloadWalletV3BankJettonWallet));

    // const returnCoins: OutActionSendMsg = {
    //     type: 'sendMsg',
    //     mode: SendMode.CARRY_ALL_REMAINING_BALANCE,
    //     outMsg: internal_relaxed({
    //         to: Address.parse('0QCj0zI66mVKC_kkRZ-63e7uR9tcpHWxS-C-W-P_Xeroso3_'),
    //         value: 0n,
    //         body: beginCell().endCell()
    //     })
    // };

    const bankTransferToCrowdSale: BJW.JettonTransfer = {
        $$type: 'JettonTransfer',
        query_id: 0n,
        amount: 5n,
        destination: banksCrowdSaleV3.address,
        response_destination: banksCrowdSaleV3.address,
        custom_payload: beginCell().endCell(),
        forward_ton_amount: 0n,
        forward_payload: beginCell().endCell()
    };

    const bankTransferToCrowdsaleMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: highloadWalletV3BankJettonContract.address,
            value: toNano('0.07'),
            body: beginCell().store(BJW.storeJettonTransfer(bankTransferToCrowdSale)).endCell()
        })
    };

    const changeArcMinterMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: arcJettonMaster.address,
            value: toNano('0.05'),
            body:
                beginCell()
                    .store(AJ.storeChangeMinter({
                        $$type: 'ChangeMinter',
                        newMinter: bankJettonMaster.address,
                        isMinter: true
                    }))
                    .endCell()
        })
    };

    const addJettonAddressMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: arcJettonMaster.address,
            value: toNano('0.05'),
            body:
                beginCell()
                    .store(BJ.storeAddingJettonAddress({
                        $$type: 'AddingJettonAddress',
                        this_contract_jettonWallet: arcJettonMaster.address
                    }))
                    .endCell()
        })
    };


    let outMsgs = [bankTransferToCrowdsaleMsg, changeArcMinterMsg, addJettonAddressMsg];
    queryId = await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId);
}