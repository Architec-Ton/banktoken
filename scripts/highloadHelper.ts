import { HLWSend } from '../utils/HLWv3-helpers';
import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { getHLW } from './highloadWallet';

import { getMultisig } from './multisig';

import { buildOnchainMetadata } from '../utils/jetton-helpers';
import { ARCjettonParams, BNKjettonParams } from './imports/const';
import * as BJW from '../build/BankJetton/tact_BankJettonWallet';
import * as BJ from '../build/BankJetton/tact_BankJetton';
import * as AJW from '../build/ArcJetton/tact_ArcJettonWallet';
import * as AJ from '../build/ArcJetton/tact_ArcJetton';
import * as CS from '../build/BanksCrowdSaleV3/tact_BanksCrowdSaleV3';
import * as MS from '../build/Multisig/tact_Multisig';

import { internal as internal_relaxed } from '@ton/core/dist/types/_helpers';
import { Address, beginCell, OutActionSendMsg, SendMode, toNano } from '@ton/core';
import '@ton/test-utils';
import { NetworkProvider } from '@ton/blueprint';


export async function run(provider: NetworkProvider) {
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

    const highloadWalletV3ArcJettonWallet = await arcJettonMaster.getGetWalletAddress(highloadWalletV3.address);
    const highloadWalletV3ArcJettonContract = provider.open(AJW.ArcJettonWallet.fromAddress(highloadWalletV3ArcJettonWallet));

    const banksCrowdSaleV3Wallet = await bankJettonMaster.getGetWalletAddress(banksCrowdSaleV3.address);
    const banksCrowdSaleV3JettonContract = provider.open(BJW.BankJettonWallet.fromAddress(banksCrowdSaleV3Wallet));

    const returnCoins: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.CARRY_ALL_REMAINING_BALANCE,
        outMsg: internal_relaxed({
            to: Address.parse(''),
            value: 0n,
            body: beginCell().endCell()
        })
    };

    const tonAmount = 0;
    const tonDestination = Address.parse('');
    const tonTransfer: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: tonDestination,
            value: toNano(tonAmount),
            body: beginCell().endCell()
        })
    };

    const bankDestination = Address.parse('');
    const bankTransfer: BJW.JettonTransfer = {
        $$type: 'JettonTransfer',
        query_id: 0n,
        amount: 5n,
        destination: bankDestination,
        response_destination: bankDestination,
        custom_payload: beginCell().endCell(),
        forward_ton_amount: 0n,
        forward_payload: beginCell().endCell()
    };

    const bankTransferMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: highloadWalletV3BankJettonContract.address,
            value: toNano('0.07'),
            body: beginCell().store(BJW.storeJettonTransfer(bankTransfer)).endCell()
        })
    };

    const arcDestination = Address.parse('');
    const arcTransfer: AJW.JettonTransfer = {
        $$type: 'JettonTransfer',
        query_id: 0n,
        amount: toNano(5),
        destination: arcDestination,
        response_destination: arcDestination,
        custom_payload: beginCell().endCell(),
        forward_ton_amount: 0n,
        forward_payload: beginCell().endCell()
    };

    const arcTransferMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: highloadWalletV3ArcJettonContract.address,
            value: toNano('0.07'),
            body: beginCell().store(BJW.storeJettonTransfer(bankTransfer)).endCell()
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

    const setBankOffset: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: banksCrowdSaleV3.address,
            value: toNano('0.05'),
            init: banksCrowdSaleV3.init,
            body: beginCell().store(CS.storeSetBankOffset({
                $$type: 'SetBankOffset',
                offset: 0n
            })).endCell()
        })
    };

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

    const bankAmount = 0;
    const referral = Address.parse('');
    const buyBankMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: banksCrowdSaleV3.address,
            value: toNano(bankAmount * 1.5),
            body: beginCell().store(CS.storeReferralAddress({
                $$type: 'ReferralAddress',
                referral: referral
            })).endCell()
        })
    };

    let outMsgs: OutActionSendMsg[] = [];
    await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId);
}