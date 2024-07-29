import { beginCell, OutActionSendMsg, SendMode, toNano } from '@ton/core';
import '@ton/test-utils';
import { NetworkProvider } from '@ton/blueprint';
import { ARCjettonParams, BNKjettonParams } from './imports/const';

import { HLWSend } from '../utils/HLWv3-helpers';
import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { internal as internal_relaxed } from '@ton/core/dist/types/_helpers';
import { buildOnchainMetadata } from '../utils/jetton-helpers';

import * as MS from '../build/Multisig/tact_Multisig';
import * as BJ from '../build/BankJetton/tact_BankJetton';
import * as AJ from '../build/ArcJetton/tact_ArcJetton';
import * as CS from '../build/BanksCrowdSaleV3/tact_BanksCrowdSaleV3';
import * as BJW from '../build/BankJetton/tact_BankJettonWallet';
import { getMultisig } from './multisigMembers';
import { getHLW } from './highloadWallet';


export async function run(provider: NetworkProvider) {
    const totalBanksOffset = 0n;

    let queryId = HighloadQueryId.fromShiftAndBitNumber(0n, 0n);
    const { keyPair, HighloadWallet } = await getHLW();

    const highloadWalletV3 = provider.open(HighloadWallet);

    const members = getMultisig();
    const multisig = provider.open(await MS.Multisig.fromInit(members, 3n, 3n));

    const bankJettonMaster = provider.open(await BJ.BankJetton.fromInit(highloadWalletV3.address, buildOnchainMetadata(BNKjettonParams)));

    const arcJettonMaster = provider.open(await AJ.ArcJetton.fromInit(highloadWalletV3.address, buildOnchainMetadata(ARCjettonParams)));

    const banksCrowdSaleV3 = provider.open(await CS.BanksCrowdSaleV3.fromInit(bankJettonMaster.address));

    const highloadWalletV3BankJettonWallet = await bankJettonMaster.getGetWalletAddress(highloadWalletV3.address);
    const highloadWalletV3BankJettonContract = provider.open(BJW.BankJettonWallet.fromAddress(highloadWalletV3BankJettonWallet));

    const banksCrowdSaleV3Wallet = await bankJettonMaster.getGetWalletAddress(banksCrowdSaleV3.address);
    const banksCrowdSaleV3JettonContract = provider.open(BJW.BankJettonWallet.fromAddress(banksCrowdSaleV3Wallet));

    const bankTransferToCrowdSale: BJW.JettonTransfer = {
        $$type: 'JettonTransfer',
        query_id: 0n,
        amount: 3_000_000n - totalBanksOffset,
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

    const addJettonAddress: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: bankJettonMaster.address,
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

    const setBanksCrowdSaleV3JettonWallet: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: banksCrowdSaleV3.address,
            value: toNano('0.05'),
            init: banksCrowdSaleV3.init,
            body: beginCell().store(CS.storeSetJettonWallet({
                $$type: 'SetJettonWallet',
                jetton_wallet: banksCrowdSaleV3JettonContract.address
            })).endCell()
        })
    };

    let outMsgs = [bankTransferToCrowdsaleMsg, setBanksCrowdSaleV3JettonWallet, addJettonAddress];
    queryId = await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId);

    const changeBankOwnerMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: bankJettonMaster.address,
            value: toNano('0.05'),
            body:
                beginCell()
                    .store(BJ.storeChangeOwner({
                        $$type: 'ChangeOwner',
                        queryId: 0n,
                        newOwner: multisig.address
                    }))
                    .endCell()
        })
    };

    const changeCrowdSaleOwnerMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: banksCrowdSaleV3.address,
            value: toNano('0.05'),
            body:
                beginCell()
                    .store(CS.storeChangeOwner({
                        $$type: 'ChangeOwner',
                        queryId: 0n,
                        newOwner: multisig.address
                    }))
                    .endCell()
        })
    };

    const changeArcOwnerMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: arcJettonMaster.address,
            value: toNano('0.05'),
            body:
                beginCell()
                    .store(AJ.storeChangeOwner({
                        $$type: 'ChangeOwner',
                        queryId: 0n,
                        newOwner: multisig.address
                    }))
                    .endCell()
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

    outMsgs = [changeArcMinterMsg, changeCrowdSaleOwnerMsg, changeBankOwnerMsg, changeArcOwnerMsg];
    queryId = await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId);
}